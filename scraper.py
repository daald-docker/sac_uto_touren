"""
scraper.py – Python equivalent of scraper.js
Scraper for SAC UTO tours (https://sac-uto.ch)
Originally developed for morph.io.

Dependencies:
    pip install requests beautifulsoup4
"""

import argparse
import hashlib
import math
import os
import random
import sqlite3
import sys
import time
from datetime import date
from urllib.parse import urlparse, parse_qs

import requests
from bs4 import BeautifulSoup
from requests import Session

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
# Checksum helpers
# ---------------------------------------------------------------------------

def compute_checksum(tour: dict) -> str:
    """Checksum of the fields available on the main listing page."""
    fields = (
        tour.get("rawDate", ""),
        tour.get("status", ""),
        tour.get("type", ""),
        tour.get("level", ""),
        tour.get("rawDuration", ""),
        tour.get("group", ""),
        tour.get("title", ""),
        tour.get("leiter", ""),
    )
    return hashlib.md5("\x00".join(fields).encode()).hexdigest()


def is_within_3_days(date_str: str | None) -> bool:
    if not date_str:
        return False
    try:
        return abs((date.fromisoformat(date_str) - date.today()).days) <= 3
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def init_database() -> sqlite3.Connection:
    """Sets up the SQLite database and returns the connection."""
    db_path = os.environ.get("SCRAPER_DB_FILE", "data.sqlite")
    if sys.version_info >= (3, 12):
        db = sqlite3.connect(db_path, autocommit=False)
    else:
        db = sqlite3.connect(db_path)
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
    for col_def in (
        "extra_info TEXT",
        "checksum TEXT",
        "detail_fetched_at INTEGER",
    ):
        try:
            db.execute(f"ALTER TABLE data ADD COLUMN {col_def}")
        except sqlite3.OperationalError:
            pass  # column already exists

    return db


def update_row(db: sqlite3.Connection, tour: dict) -> None:
    """Writes a full tour record to the database (or prints it to the console)."""
    if db is None:
        print("REC:", tour)
        return
    assert 'id' in tour
    assert tour['id'] is not None
    assert isinstance(tour['id'], str)

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
            subscription_period_end,
            checksum, detail_fetched_at
        ) VALUES (
            :id, :active, :lastSeen,
            :date_from, :date_to,
            :status, :type, :level, :group,
            :title, :leiter, :url,
            :altitude, :mtype, :type_ext, :level2,
            :arrival, :text, :extra_info,
            :equipment,
            :subscription_period_start,
            :subscription_period_end,
            :checksum, :detail_fetched_at
        )
    """, tour)


def update_listing_only(db: sqlite3.Connection, tour: dict) -> None:
    """Updates only listing-derived fields for a tour that doesn't need a detail re-fetch."""
    db.execute("""
        UPDATE data SET
            active   = :active,
            lastSeen = :lastSeen,
            checksum = :checksum,
            status   = :status,
            type     = :type,
            level    = :level,
            grp      = :group,
            title    = :title,
            leiter   = :leiter,
            url      = :url
        WHERE id = :id
    """, tour)


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def fetch_page(url: str, session: requests.Session, retries: int = 3) -> str:
    """Fetches a page and returns the HTML body."""
    attempt = 1
    while True:
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            print(f"Error fetching {url} (attempt {attempt}:", e)
            if attempt < retries:
                time.sleep(2 ** attempt)
            else:
                raise e
            attempt += 1


# ---------------------------------------------------------------------------
# Detail page
# ---------------------------------------------------------------------------

def update_detail(db: sqlite3.Connection, tour: dict, session: requests.Session, retry: int = 1) -> bool:
    """
    Fetches the detail page of a tour, extracts all fields,
    and writes the record to the DB.
    Returns True on success.
    """
    global num_tours_done

    assert 'id' in tour
    assert tour['id'] is not None
    assert isinstance(tour['id'], str)
    body = fetch_page(tour["url"], session)
    if body is None:
        print(f"Could not load page: {tour['url']}")
        if retry > 0:
            print("Retrying ...")
            return update_detail(db, tour, session, retry - 1)
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
            return update_detail(db, tour, session, retry - 1)
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
            return update_detail(db, tour, session, retry - 1)
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

    tour["detail_fetched_at"] = int(time.time() * 1000)
    update_row(db, tour)
    return True


# ---------------------------------------------------------------------------
# Main page (list view) – paginated
# ---------------------------------------------------------------------------

def collect_tours(session: Session, offset: int = 0) -> list[dict]:
    """
    Collects all tours from the paginated tour listing and returns them.
    Does not fetch detail pages.
    """
    global num_tours_total

    list_url = (
        "https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/"
        f"?page=touren&year=&typ=&gruppe=&anlasstyp=&suchstring=&offset={offset}"
    )

    body = fetch_page(list_url, session)

    print(f"Processing main list {list_url}")
    soup = BeautifulSoup(body, "html.parser")

    rows = soup.select("table.table tr")

    assert offset > 0 or len(rows) > 1, "Empty index page or changed format"

    tours: list[dict] = []

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
        classes = first.get("class") or []
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
        assert tour["id"], "No id found in tour url %s" % tour["url"]

        if len(tds) > 8:
            tour["leiter"] = tds[8].get_text().strip()
        else:
            tour["leiter"] = ""

        num_tours_total += 1
        tours.append(tour)

    if len(tours) > 40:
        tours.extend(collect_tours(session, offset + max(len(tours), 40)))

    return tours


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?", help="Fetch a single tour URL directly")
    parser.add_argument("-a", action="store_true", help="Fetch all optional tours")
    parser.add_argument("-p", type=float, default=10.0, metavar="PCT",
                        help="Total sampling percentage split half-half between oldest and random (default: 10)")
    parsed = parser.parse_args()

    session = requests.Session()
    session.headers.update(HEADERS)

    if parsed.url:
        update_detail(None, {"url": parsed.url}, session)
    else:
        db = init_database()

        # Snapshot existing records before resetting active flags so we can
        # check which tours were previously active when deciding the sample.
        db_rows = db.execute(
            "SELECT id, checksum, date_from, date_to, detail_fetched_at, active FROM data"
        ).fetchall()
        existing: dict[str, dict] = {
            str(row[0]): {
                "checksum": row[1],
                "date_from": row[2],
                "date_to": row[3],
                "detail_fetched_at": row[4],
                "active": row[5],
            }
            for row in db_rows
        }

        # Mark all active records as inactive before re-scraping
        db.execute("UPDATE data SET active=0")

        all_tours = collect_tours(session)

        must_fetch: list[dict] = []
        optional: list[dict] = []

        for tour in all_tours:
            checksum = compute_checksum(tour)
            tour["checksum"] = checksum
            ex = existing.get(tour["id"])

            if (
                ex is None
                or ex["checksum"] != checksum
                or is_within_3_days(ex["date_from"])
                or is_within_3_days(ex["date_to"])
            ):
                must_fetch.append(tour)
            else:
                optional.append(tour)

        if parsed.a:
            to_fetch_optional = optional
            skip_fetch = []
            print(
                f"Tours: {len(all_tours)} total, {len(must_fetch)} must-fetch, "
                f"{len(to_fetch_optional)} all-optional, 0 listing-only"
            )
        else:
            half = parsed.p / 2 / 100

            # Only sample from tours that were previously active.
            previously_active = [t for t in optional if existing[t["id"]]["active"] == 1]

            # half% oldest already-fetched (min 10) + half% random not-yet-fetched.
            already_fetched = [t for t in previously_active if existing[t["id"]]["detail_fetched_at"]]
            already_fetched.sort(key=lambda t: existing[t["id"]]["detail_fetched_at"])
            oldest_n = max(10, math.ceil(len(already_fetched) * half))
            to_fetch_oldest = already_fetched[:oldest_n]

            oldest_ids = {t["id"] for t in to_fetch_oldest}
            not_yet_fetched = [t for t in previously_active if t["id"] not in oldest_ids]
            random_n = math.ceil(len(not_yet_fetched) * half)
            to_fetch_random = random.sample(not_yet_fetched, min(random_n, len(not_yet_fetched)))

            to_fetch_optional = to_fetch_oldest + to_fetch_random
            sampled_ids = {t["id"] for t in to_fetch_optional}
            skip_fetch = [t for t in optional if t["id"] not in sampled_ids]

            print(
                f"Tours: {len(all_tours)} total, {len(must_fetch)} must-fetch, "
                f"{len(to_fetch_oldest)}/{len(already_fetched)} oldest + "
                f"{len(to_fetch_random)}/{len(not_yet_fetched)} random not-yet-fetched, "
                f"{len(skip_fetch)} listing-only"
            )

        num_tours_total = len(must_fetch) + len(to_fetch_optional)
        for tour in must_fetch + to_fetch_optional:
            try:
                update_detail(db, tour, session)
                sys.stdout.flush()
            except Exception as exc:
                print(f"Error on tour {tour.get('id')}: {exc}")
                raise exc

        for tour in skip_fetch:
            update_listing_only(db, tour)

        print("Committing and closing database connection.")
        db.commit()
        db.close()
