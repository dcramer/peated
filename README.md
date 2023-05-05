# peated

Schema Notes:

- Do we need the bottle series? Also sometimes series are for specific retailers, does that matter? e.g. Bottled for Healthy Spirits, Bottle #1345
- Should we have bottled dates or just bottled years?
- Is CaskType possible to constrain to an enum? Same question for Category.
- Tags make up a lot of flavor profiles - should things like the way its coal fired be focused on tasting notes more so than bottle or distiller information?

https://www.whiskybase.com/ is a good example of what the kind of db we need. Initial scraper to populate a DB (will need further enriched with other sources) is in `cask-scraper`

## Dev

Bootstrap the environment:

```
docker-compose up -d
npm run db:migrate
```

Note: If you need to tweak default settings, `cp .env.example .env` and go to town.

Create a local user to avoid setting up Google credentials:

```
npm run create-user -w server
```

Run the dev server, which spins up both the `web` and the `server` services:

```
nf start
```
