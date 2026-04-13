"""
scraper.py – Python equivalent of scraper.js
Scraper for SAC UTO tours (https://sac-uto.ch)
Originally developed for morph.io.

Dependencies:
    pip install requests beautifulsoup4
"""

import sys
import sqlite3
import time
from urllib.parse import urlparse, parse_qs

import requests
from bs4 import BeautifulSoup

import sacdateparser

# ---------------------------------------------------------------------------
# Global counters
# ---------------------------------------------------------------------------
num_tours_total = 0
num_tours_done = 0

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/65.0.3325.183 Safari/537.36 Vivaldi/1.96.1147.36"
    )
}

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def init_database() -> sqlite3.Connection:
    """Sets up the SQLite database and returns the connection."""
    if sys.version_info >= (3, 12):
        db = sqlite3.connect("data.sqlite", autocommit=False)
    else:
        db = sqlite3.connect("data.sqlite")
    db.execute("""
        CREATE TABLE IF NOT EXISTS data (
            id                        INTEGER PRIMARY KEY,
            active                    INTEGER,
            lastSeen                  INTEGER,
            date_from                 TEXT,
            date_to                   TEXT,
            status                    TEXT,
            type                      TEXT,
            level                     TEXT,
            grp                       TEXT,
            title                     TEXT,
            leiter                    TEXT,
            url                       TEXT,
            altitude                  TEXT,
            mtype                     TEXT,
            type_ext                  TEXT,
            level2                    TEXT,
            arrival                   TEXT,
            text                      TEXT,
            equipment                 TEXT,
            subscription_period_start TEXT,
            subscription_period_end   TEXT,
            extra_info                TEXT
        )
    """)
    # Add extra_info column retroactively if missing (for existing DBs)
    try:
        db.execute("ALTER TABLE data ADD COLUMN extra_info TEXT")
    except sqlite3.OperationalError:
        pass  # Column already exists

    return db


def update_row(db: sqlite3.Connection, tour: dict) -> None:
    """Writes a tour record to the database (or prints it to the console)."""
    if db is None:
        print("REC:", tour)
        return

    db.execute("""
        INSERT OR REPLACE INTO data (
            id, active, lastSeen,
            date_from, date_to,
            status, type, level, grp,
            title, leiter, url,
            altitude, mtype, type_ext, level2,
            arrival, text, extra_info,
            equipment,
            subscription_period_start,
            subscription_period_end
        ) VALUES (
            :id, :active, :lastSeen,
            :date_from, :date_to,
            :status, :type, :level, :group,
            :title, :leiter, :url,
            :altitude, :mtype, :type_ext, :level2,
            :arrival, :text, :extra_info,
            :equipment,
            :subscription_period_start,
            :subscription_period_end
        )
    """, tour)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def fetch_page(url: str, retries: int = 3) -> str:
    """Fetches a page and returns the HTML body."""
    attempt=1
    while True:
        try:
            # TODO use session for request
            resp = requests.get(url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            print(f"Error fetching {url} (attempt {attempt}:", e)
            if attempt<retries:
                time.sleep(2 ** attempt)
                # TODO reset session
            else:
                raise e
            attempt+=1


# ---------------------------------------------------------------------------
# Detail page
# ---------------------------------------------------------------------------

def update_detail(db: sqlite3.Connection, tour: dict, retry: int = 1) -> bool:
    """
    Fetches the detail page of a tour, extracts all fields,
    and writes the record to the DB.
    Returns True on success.
    """
    global num_tours_done

    body = fetch_page(tour["url"])
    if body is None:
        print(f"Could not load page: {tour['url']}")
        if retry > 0:
            print("Retrying ...")
            return update_detail(db, tour, retry - 1)
        print("Aborting.")
        sys.exit(1)

    soup = BeautifulSoup(body, "html.parser")

    # Error handling
    title_tag = soup.find("title")
    page_title = title_tag.get_text().strip() if title_tag else ""
    load_error = False

    if page_title == "Oops, an error occurred!":
        callout = soup.select_one(".callout-body")
        msg = callout.get_text().strip() if callout else ""
        print(f"Error on tour {tour.get('id')}: <{page_title}> <{msg}>")
        load_error = True

    if page_title in ("500 Internal Server Error", "502 Bad Gateway", "504 Gateway Time-out"):
        body_text = soup.get_text().strip()[:200]
        print(f"Error on tour {tour.get('id')}: <{page_title}> <{body_text}>")
        load_error = True

    if load_error:
        if retry > 0:
            print("Retrying ...")
            return update_detail(db, tour, retry - 1)
        print("Aborting.")
        sys.exit(1)

    num_tours_done += 1
    print(
        f"Processing tour {tour.get('id')}, "
        f"{num_tours_done} of {num_tours_total}\t\t{tour['url']}"
    )

    # Title and leader
    h2 = soup.find("h2")
    tour["title"] = h2.get_text().strip() if h2 else tour.get("title", "")
    leiter_el = soup.select_one(".droptours-address-name")
    tour["leiter"] = leiter_el.get_text().strip() if leiter_el else ""

    # Key-value table
    kv: dict[str, str] = {}
    for row in soup.select("table#droptours-detail tr"):
        cells = row.find_all("td")
        if len(cells) < 2:
            continue
        if cells[0].get("colspan"):
            continue
        key = cells[0].get_text().strip()
        value = cells[1].get_text().strip()
        kv[key] = value

    assert "Datum" in kv, f"Field 'Datum' not existing. Page: {body[:500]}"
    datum = kv["Datum"]

    # Special case: server error with date "Do 0."
    if datum.startswith("Do 0."):
        if retry > 0:
            print(f"Retrying due to unexpected start date '{datum}'")
            return update_detail(db, tour, retry - 1)
        print(f"Skipping tour with unexpected start date '{datum}': {tour['url']}")
        return False

    dd = sacdateparser.parse_date2(datum)
    tour["date_from"] = dd["from"]
    tour["date_to"] = dd["to"]

    tour["group"] = kv.get("Gruppe", tour.get("group"))
    tour["mtype"] = kv.get("Anlasstyp")
    tour["type_ext"] = kv.get("Typ/Zusatz:")
    tour["level2"] = kv.get("Anforderungen")
    tour["altitude"] = kv.get("Auf-, Abstieg/Marschzeit")
    tour["arrival"] = kv.get("Reiseroute")
    tour["text"] = kv.get("Route / Details")
    tour["extra_info"] = kv.get("Zusatzinfo")
    tour["equipment"] = kv.get("Ausrüstung")

    dd2 = sacdateparser.parse_anmeldung(kv.get("Anmeldung"))
    tour["subscription_period_start"] = dd2.get("from")
    tour["subscription_period_end"] = dd2.get("to")

    update_row(db, tour)
    return True


# ---------------------------------------------------------------------------
# Main page (list view) – paginated
# ---------------------------------------------------------------------------

def load_process_list(db: sqlite3.Connection, offset: int = 0) -> None:
    """
    Processes the paginated tour list and fetches the detail page
    for each entry.
    """
    global num_tours_total

    list_url = (
        "https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/"
        f"?page=touren&year=&typ=&gruppe=&anlasstyp=&suchstring=&offset={offset}"
    )

    body = fetch_page(list_url)

    print(f"Processing main list {list_url}")
    soup = BeautifulSoup(body, "html.parser")

    rows = soup.select("table.table tr")

    assert  offset > 0 or len(rows)>1,"Empty index page or changed format"

    detail_tours: list[dict] = []

    for row in rows:
        cells = row.find_all(True, recursive=False)
        if not cells:
            continue
        first = cells[0]

        # Skip header rows (th) or colspan cells
        if first.name != "td" or first.get("colspan"):
            continue

        tour: dict = {}
        tour["active"] = 1
        tour["lastSeen"] = int(time.time() * 1000)

        # Column 0: date / status
        tour["rawDate"] = first.get_text().strip()
        classes = first.get("class") # returns a list
        if "status_3" in classes:
            tour["status"] = "full"
        elif "status_2" in classes:
            tour["status"] = "cancelled"
        elif "without_register" in classes:
            tour["status"] = "ok"
        elif "status_1" in classes or "status_0" in classes:
            tour["status"] = "open"
        else:
            tour["status"] = ""

        tds = row.find_all("td")
        assert len(tds) >= 8, "Unexpected number of cells in row: {row!r}"

        tour["type"] = tds[1].get_text().strip()
        # tds[2] = icon (skipped)
        tour["level"] = tds[3].get_text().strip()
        tour["rawDuration"] = tds[4].get_text().strip()
        tour["group"] = tds[5].get_text().strip()
        # tds[6] = ? (skipped)
        title_td = tds[7]
        tour["title"] = title_td.get_text().strip()

        link = title_td.find("a")
        assert link
        tour["url"] = link.get("href")
        assert tour["url"]

        # Tour ID from query string
        parsed = urlparse(tour["url"])
        qs = parse_qs(parsed.query)
        tour["id"] = qs.get("touren_nummer")[0]
        assert tour["id"], "No id found in tour url %s"%tour["url"]

        if len(tds) > 8:
            tour["leiter"] = tds[8].get_text().strip()
        else:
            tour["leiter"] = ""

        num_tours_total += 1
        detail_tours.append(tour)

    for t in detail_tours:
        try:
            update_detail(db, t)
            sys.stdout.flush()
        except Exception as exc:
            print(f"Error on tour {t.get('id')}: {exc}")
            raise exc

    # Load next page if enough results
    if len(detail_tours) > 40:
        load_process_list(db, offset + max(len(detail_tours), 40))

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    args = sys.argv[1:]

    if args:
        # Process a single tour URL directly (as in the original)
        update_detail(None, {"url": args[0]})
    else:
        db = init_database()

        # Mark all active records as inactive before re-scraping
        db.execute("UPDATE data SET active=0")

        load_process_list(db)

        # Commit after each page

        print("Committing and closing database connection.")
        db.commit()
        db.close()
