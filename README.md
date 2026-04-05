# SAC UTO Tour List - Ruby wrapper for python

A scraper for the tour list of [SAC Section Uto](https://sac-uto.ch/de/aktivitaeten/touren-und-kurse/).
Scraped data is stored in a local SQLite database.

> The original website is awful when you're trying to decide which tours to sign up for
> and when the registration deadlines are. This scraper makes the data machine-readable.

This is a Python port of the original Node.js scraper at
[daald-docker/sac_uto_touren](https://github.com/daald-docker/sac_uto_touren). For maintainability,
I migrated it now to python. Thanks to Claude AI.

**But:** This branch is not python, it's ruby. Why? It's because https://morph.io/ doesn't maintain their system. As a result, I didn't find a way to directly run python code. Because of this, I now have to run a ruby wrapper which calls the actual python code from [another branch](https://github.com/daald-docker/sac_uto_touren/tree/main-python-2026).