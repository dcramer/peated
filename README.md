# peated

https://www.whiskybase.com/ is a good example of what the kind of db we need. Initial scraper to populate a DB (will need further enriched with other sources) is in `scraper`

## Dev

Bootstrap the environment:

```
docker-compose up -d
pnpm setup
```

Note: If you need to tweak default settings, `cp .env.example .env` and go to town.

Setup the database:

```
make create-db
pnpm db migrate
```

Create a local user to avoid setting up Google credentials:

```
pnpm user create you@example.com password -a
```

Load some mock data:

```
pnpm mocks load-all you@example.com
```

Run the dev server, which spins up both the `web` and the `api` services:

```
npm run dev
```
