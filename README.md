# SAC UTO Tour List – Python Scraper

A scraper for the tour list of [SAC Section Uto](https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/).
Scraped data is stored in a local SQLite database.

> The original website is awful when you're trying to decide which tours to sign up for
> and when the registration deadlines are. This scraper makes the data machine-readable.

This is a Python port of the original Node.js scraper at
[daald-docker/sac_uto_touren](https://github.com/daald-docker/sac_uto_touren). For maintainability,
I migrated it now to python. Thanks to Claude AI.

---

## Files

| File                    | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `scraper.py`            | Main script – fetches tour list and detail pages, writes to SQLite |
| `sacdateparser.py`      | Helper functions for parsing German-language date strings          |
| `test_sacdateparser.py` | Unit tests for the date parser                                     |

---

## Requirements

[uv](https://docs.astral.sh/uv/) — dependencies are declared in `pyproject.toml` and locked in `uv.lock`.

---

## Usage

### Scrape all tours

```bash
uv run scraper.py
```

The scraper paginates through all available tours. Tours whose listing data changed
or whose date is within 3 days are always re-fetched. For the rest, a sample of
detail pages is refreshed: by default 5% of the oldest already-fetched tours and
5% of random not-yet-fetched tours (10% total).

```bash
uv run scraper.py -p 20   # use 20% total (10% oldest + 10% random)
uv run scraper.py -a      # fetch detail pages for all optional tours
```

Results are written to `data.sqlite` in the current directory.

### Process a single tour URL directly

Useful for testing or debugging a specific tour:

```bash
uv run scraper.py "https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/.html?page=detail&touren_nummer=5947"
```

In single-tour mode no database writes are performed – data is printed to stdout.

---

## Tests

```bash
uv run pytest test_sacdateparser.py -v
```

---

## Database schema

Results are written to `data.sqlite`, table `data`:

| Column                                                  | Description                                                          |
|---------------------------------------------------------|----------------------------------------------------------------------|
| `id`                                                    | Tour number (from the URL)                                           |
| `active`                                                | `1` if the tour was still present on the website during the last run |
| `lastSeen`                                              | Unix timestamp (ms) of the last successful fetch                     |
| `date_from` / `date_to`                                 | Tour date (ISO 8601)                                                 |
| `status`                                                | `open`, `full`, `cancelled`, or `ok`                                 |
| `type`                                                  | Tour type (e.g. `Ss`, `Hw`)                                          |
| `level`                                                 | Difficulty rating (e.g. `WT4`)                                       |
| `grp`                                                   | Group (e.g. `Senioren`)                                              |
| `title`                                                 | Tour name                                                            |
| `leiter`                                                | Tour leader                                                          |
| `url`                                                   | Link to the detail page                                              |
| `altitude`                                              | Ascent/descent and hiking time                                       |
| `mtype`                                                 | Event type (e.g. `Tour`, `Kurs`)                                     |
| `type_ext`                                              | Type/supplement with long description                                |
| `level2`                                                | Technical requirements                                               |
| `arrival`                                               | Travel route (e.g. `ÖV`)                                             |
| `text`                                                  | Route / detailed description                                         |
| `extra_info`                                            | Additional information                                               |
| `equipment`                                             | Required equipment                                                   |
| `subscription_period_start` / `subscription_period_end` | Registration period (ISO 8601)                                       |

---

## Notes

- The scraper automatically retries on HTTP errors (5xx) with exponential backoff.
- Tours with a clearly malformed date (`Do 0. …`) are skipped or retried – this is a
  known server-side race condition on the source website.
- Detail pages are fetched sequentially to avoid hammering the server.
