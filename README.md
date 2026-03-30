# SAC Uto Tour List – Python Scraper

This is a scraper that runs on [Morph](https://morph.io). To get started [see the documentation](https://morph.io/documentation)

-> [https://morph.io/daald-docker/sac_uto_touren](https://morph.io/daald-docker/sac_uto_touren)

The original web page is awful, if you have to decide which tours you want to subscribe and when. I once wrote an alternative frontend, but I never finished and it doesn't work anymore with the current data structure.

Let me know if you are using this data for something.



## Description

A scraper for the tour list of [SAC Section Uto](https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/).
Scraped data is stored in a local SQLite database.

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

Python 3.10+ and the following packages:

```bash
pip install -r requirements.txt
```

For tests (optional):

```bash
pip install pytest
```

---

## Usage

### Scrape all tours

```bash
python scraper.py
```

The scraper automatically paginates through all available tours and writes the
results to `data.sqlite` in the current directory.

### Process a single tour URL directly

Useful for testing or debugging a specific tour:

```bash
python scraper.py "https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/.html?page=detail&touren_nummer=5947"
```

In single-tour mode no database writes are performed – data is printed to stdout.

---

## Tests

```bash
# with pytest
pytest test_sacdateparser.py -v

# or with the Python standard library only
python -m unittest test_sacdateparser -v
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
- At most 2 detail pages are fetched concurrently to avoid hammering the server.
- Currently, the default process is to download all pages, even unchanged. The plan is to implement
  a pre-condition based on the overview list to avoid unnecessary reload of everything. For this, the
  python migration was the preparation step.
