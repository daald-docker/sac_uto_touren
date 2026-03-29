# SAC UTO Tourenliste – Python Scraper

Ein Scraper für die Tourenliste der [SAC Sektion Uto](https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/).
Die gescrapten Daten werden in einer lokalen SQLite-Datenbank gespeichert.

> Die originale Website ist ziemlich unübersichtlich, wenn man entscheiden möchte,
> für welche Touren man sich anmelden will und wann die Anmeldefristen laufen.
> Dieser Scraper macht die Daten maschinenlesbar zugänglich.

Dies ist ein Python-Port des ursprünglichen Node.js-Scrapers unter
[daald-docker/sac_uto_touren](https://github.com/daald-docker/sac_uto_touren). Er wurde zwecks Wartbarkeit nach Python portiert - mit Unterstützung von Claude AI

---

## Dateien

| Datei                   | Beschreibung                                                         |
|-------------------------|----------------------------------------------------------------------|
| `scraper.py`            | Hauptskript – lädt Touren-Liste und Detailseiten, schreibt in SQLite |
| `sacdateparser.py`      | Hilfsfunktionen zum Parsen der deutschsprachigen Datumsstrings       |
| `test_sacdateparser.py` | Unit-Tests für den Datumsparser                                      |

---

## Voraussetzungen

Python 3.10+ sowie folgende Pakete:

```bash
pip install -r requirements.txt
```

Für die Tests (optional):

```bash
pip install pytest
```

---

## Verwendung

### Alle Touren scrapen

```bash
python3 scraper.py
```

Der Scraper paginiert automatisch über alle verfügbaren Touren und schreibt das
Ergebnis in `data.sqlite` im aktuellen Verzeichnis.

### Einzelne Tour direkt verarbeiten

Nützlich zum Testen oder Debuggen einer bestimmten Tour-URL:

```bash
python3 scraper.py "https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/?page=detail&touren_nummer=116434"
```

Im Einzelmodus wird kein Datenbankschreibzugriff durchgeführt – die Daten werden
auf der Konsole ausgegeben.

---

## Tests

```bash
# mit pytest
pytest test_sacdateparser.py -v

# oder nur mit der Python-Standardbibliothek
python -m unittest test_sacdateparser -v
```

---

## Datenbankschema

Die Ergebnisse landen in `data.sqlite`, Tabelle `data`:

| Spalte                                                  | Beschreibung                                                 |
|---------------------------------------------------------|--------------------------------------------------------------|
| `id`                                                    | Tour-Nummer (aus der URL)                                    |
| `active`                                                | `1` wenn die Tour im letzten Lauf noch auf der Website stand |
| `lastSeen`                                              | Unix-Timestamp (ms) des letzten erfolgreichen Abrufs         |
| `date_from` / `date_to`                                 | Tourdatum (ISO 8601)                                         |
| `status`                                                | `open`, `full`, `cancelled`, `ok`                            |
| `type`                                                  | Tourentyp (z. B. `Ss`, `Hw`)                                 |
| `level`                                                 | Schwierigkeitsstufe (z. B. `WT4`)                            |
| `grp`                                                   | Gruppe (z. B. `Senioren`)                                    |
| `title`                                                 | Tourname                                                     |
| `leiter`                                                | Tourenleitung                                                |
| `url`                                                   | Link zur Detailseite                                         |
| `altitude`                                              | Auf-/Abstieg und Marschzeit                                  |
| `mtype`                                                 | Anlasstyp (z. B. `Tour`, `Kurs`)                             |
| `type_ext`                                              | Typ/Zusatz mit Langbezeichnung                               |
| `level2`                                                | Anforderungen (technisch)                                    |
| `arrival`                                               | Reiseroute (z. B. `ÖV`)                                      |
| `text`                                                  | Route / Detailbeschreibung                                   |
| `extra_info`                                            | Zusatzinformationen                                          |
| `equipment`                                             | Benötigte Ausrüstung                                         |
| `subscription_period_start` / `subscription_period_end` | Anmeldezeitraum (ISO 8601)                                   |

---

## Hinweise

- Der Scraper wartet bei HTTP-Fehlern (5xx) automatisch und wiederholt den Abruf.
- Touren mit einem offensichtlich fehlerhaften Datum (`Do 0. …`) werden übersprungen
  bzw. wiederholt abgerufen – das ist ein bekanntes serverseitiges Race-Condition-Problem
  der Quellseite.
- Es werden maximal 2 Detailseiten gleichzeitig abgerufen, um den Server zu schonen.
- Aktuell werden bei jedem Durchlauf sämtliche Seiten geladen. Es ist geplant, dieses neu-laden
  an Bedingungen zu knüpfen wie sich ändernde Stati
