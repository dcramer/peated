# Peated

The application that powers peated.com.

For more details, take a look at https://peated.com/about

A Discord is available if you want to contribute: https://discord.gg/d7GFPfy88Z

## Dev

Setup the required frameworks:

1. (pnpm)[https://pnpm.io/installation]
2. (Docker)[https://docs.docker.com/get-docker/] (with Docker Compose)

Bootstrap the environment:

```
docker compose up -d
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
pnpm cli users create you@example.com password -a
```

Load some mock data:

```
pnpm cli mocks load-all you@example.com
```

Run the dev server, which spins up both the `web` and the `api` services:

```
npm run dev
```

## Runbooks

### Configure GCP CLI

https://cloud.google.com/kubernetes-engine/docs/how-to/cluster-access-for-kubectl

```shell
# bind default project
gcloud config set project cask-382601

# configure kubectl
gcloud container clusters get-credentials default --region=us-central1
```

### Shell on Pod

```shell
kubectl exec -it deploy/peated-api -- bash
```

### Run Arbitrary Command

```shell
gcloud alpha run jobs execute cli --args bottles,generate-descriptions,3298 --wait
```
