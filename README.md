
# Alle Touren scrapen
python scraper.py

# Einzelne Tour-URL direkt testen
python scraper.py "https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/.html?page=detail&touren_nummer=5947"




# mit pytest (falls installiert)
pytest test_sacdateparser.py -v

# nur mit Python-Stdlib
python -m unittest test_sacdateparser -v

