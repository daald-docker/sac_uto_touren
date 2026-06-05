# CLAUDE.md

## Commands

```bash
# Run scraper (default: 5% oldest + 5% random sampling)
uv run scraper.py

# Fetch all optional tours (no sampling)
uv run scraper.py -a

# Custom sampling percentage (total, split half-half)
uv run scraper.py -p 20

# Fetch a single tour detail page (no DB writes, prints to stdout)
uv run scraper.py "https://sac-uto.ch/...?page=detail&touren_nummer=1234"

# Dump first 3 listing pages to stdout (no DB interaction)
uv run scraper.py --dump-mastertable

# Run tests
uv run pytest test_sacdateparser.py -v

# Build Docker image
docker build -t sac-uto-scraper .

# Run Docker container (mounts ./data as persistent DB volume)
docker run --rm -v "$(pwd)/data:/data" sac-uto-scraper
```

## Architecture

**Two-phase scrape:** `collect_tours()` paginates the listing page to get all tours (lightweight), then detail pages are fetched selectively. The listing parser uses CSS class selectors (`droptours-*`) rather than positional column indices.

**Sampling strategy:**

Tours are split into:
- `must_fetch` – new tours (no DB record), listing checksum changed, either tour date within 3 days, or subscription period active (from 5 days before start through 3 days after end)
- `optional` – unchanged tours; only those previously marked `active=1` are sampled:
  - **Oldest already-fetched:** oldest `p/2`% (min 10) sorted by `detail_fetched_at` — gradual refresh of stale detail data
  - **Random never-fetched:** random `p/2`% from tours with no `detail_fetched_at` — picks up tours whose details were never loaded
- All remaining tours get their listing fields updated without a detail fetch

`-a` bypasses sampling and fetches all optional tours. `-p` sets the total percentage (default: 10).

**DB persistence in Docker:** `entrypoint.sh` copies `/data/data.sqlite` → `/tmp/data.sqlite` before the run, writes back on success. The DB path is set via `SCRAPER_DB_FILE` (default: `data.sqlite`).

**Retry logic:** `fetch_page()` retries up to 3 times with exponential backoff. `update_detail()` retries once on application-level errors (server error pages, malformed dates like `Do 0.`).

## Key files

| File | Purpose |
|---|---|
| `scraper.py` | Main scraper – listing + detail fetch, DB writes, CLI |
| `sacdateparser.py` | Parses German date strings from the tour portal |
| `test_sacdateparser.py` | Unit tests for the date parser |
| `entrypoint.sh` | Docker entrypoint – handles DB copy in/out |
| `Dockerfile` | Uses `uv` for dependency management, runs as non-root |
