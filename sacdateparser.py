"""
sacdateparser.py – Python equivalent of sacdateparser.js
Parses German-language date strings from the SAC-UTO tour portal.
"""

import re

MONTH_NAMES = [None, 'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
               'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']


def parse_month(s: str) -> int:
    """Converts a month name or month number to an integer (1–12)."""
    s = s.strip()
    try:
        n = int(s)
        assert 1 <= n <= 12
        return n
    except ValueError:
        pass
    if s == "MÃ¤rz":  # Charset error on page around Dec 2024
        return 3
    # Compare only the first 3 characters (e.g. "Sept" → "Sep")
    prefix = s[:3]
    try:
        n = MONTH_NAMES.index(prefix)
    except ValueError:
        raise ValueError(f"Unknown month name: {s}")
    assert 1 <= n <= 12
    return n


def _parse_date2_int(d: str, m: str, y: str, original: str) -> str:
    """Builds an ISO date string (YYYY-MM-DD) from day, month, year."""
    n_month = parse_month(m)
    y_int = int(y)
    d_int = int(d)
    assert y_int >= 2000, f"Could not parse date in {original} ({d},{m},{y})"
    assert d_int >= 1,    f"Could not parse date in {original} ({d},{m},{y})"
    return f"{y_int}-{n_month:02d}-{d_int:02d}"


def parse_date2(s: str) -> dict:
    """
    Parses date strings of the form:
      "Mi 15. Aug. 2018 1 Tag"
      "Fr 30. Mär.  bis Mo 2. Apr. 2018"

    Returns {'from': 'YYYY-MM-DD', 'to': 'YYYY-MM-DD'}.
    """
    assert s != '', "parse_date2: empty string"

    # Replace all non-word characters (except ö/ä/ü) with spaces, then split
    block = re.sub(r'[^\dA-Za-zöäü]+', ' ', s).strip().split()

    # block[3] == 'bis'  →  date range
    # e.g. "Fr 30. Mär.  bis Mo 2. Apr. 2018"
    # after cleaning: ['Fr', '30', 'Mär', 'bis', 'Mo', '2', 'Apr', '2018']
    if block[3] == 'bis':
        return {
            'from': _parse_date2_int(block[1], block[2], block[7], s),
            'to':   _parse_date2_int(block[5], block[6], block[7], s),
        }
    else:
        return {
            'from': _parse_date2_int(block[1], block[2], block[3], s),
            'to':   _parse_date2_int(block[1], block[2], block[3], s),
        }


def parse_anmeldung_datestr(s: str, token: str) -> str:
    """
    Parses a substring of the form "von Mi 22. Mai 2019" or "bis Sa 25. Mai 2019".
    """
    # Replace all commas, dots and multiple spaces with a single space
    block = re.sub(r'[,.\s]+', ' ', s).strip().split()
    assert block[0] == token, f"no '{token}' in date '{s}'"
    assert len(block) == 5,   f"unexpected number of elements in date '{s}'"
    # block: [token, weekday, day, month, year]
    month = parse_month(block[3])
    year  = int(block[4])
    day   = int(block[2])
    return f"{year:04d}-{month:02d}-{day:02d}"


def parse_anmeldung(s) -> dict:
    """
    Parses registration period strings, e.g.:
      "Schriftlich, Internet von Mi 22. Mai 2019 bis Sa 25. Mai 2019, Max. TN 15"
      "Internet von Mi 22. Mai 2019 bis Sa 25. Mai 2019"
      "von Mi 1. Jan. 2025 bis So 2. März 2025"
      "Internet von Do 1. Nov. 2018, Max. TN 4"
      "von So 2. Jun. 2019 bis Fr 28. Jun. 2019, Max. TN 6"
      "bis Fr 16. Sept. 2022, Max. TN 8"

    Returns a dict with optional keys 'from' and/or 'to'.
    """
    if s is None:
        return {}

    res = {}

    # Strip ", Max. TN …" from the end
    i = s.find(', Max. TN ')
    if i > 0:
        s = s[:i]

    # Process "bis …" first (from the right)
    i = s.find('bis ')
    if i >= 0:
        res['to'] = parse_anmeldung_datestr(s[i:], 'bis')
        s = s[:i]

    # Process "von …"
    i = s.find('von ')
    if i >= 0:
        res['from'] = parse_anmeldung_datestr(s[i:], 'von')

    # TODO make sure there's no unhandled extra text in input string

    return res
