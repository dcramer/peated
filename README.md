# Peated

The application that powers peated.app.

For more details, take a look at https://peated.app/about

A Discord is available if you want to contribute: https://discord.gg/d7GFPfy88Z

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
