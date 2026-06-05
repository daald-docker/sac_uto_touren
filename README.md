# SAC UTO Tour List - Ruby wrapper for python

A scraper for the tour list of [SAC Section Uto](https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/).
Scraped data is stored in a local SQLite database.

Write your own tool for selecting tours if you don't like the original page.


## Ruby wrapper for python

This branch is not python, it's ruby. Why? It's because https://morph.io/ doesn't maintain their system. As a result, I didn't find a way to directly run
python code. Because of this, I now have to run a ruby wrapper which calls the actual python code from
[another branch](https://github.com/daald-docker/sac_uto_touren/tree/main-python-2026).
