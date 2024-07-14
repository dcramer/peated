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

## Bottle Naming

The way we want bottles in the system is a little subjective, so we're trying to define rules that can both be easily managed by an individual, as well as code.

1. Must not include the brand. We have a separate attribute to track the brand name.
2. Should not include the vintage (1989) or category (Single Malt), except when no other descriptors are available.
3. Should not include generalized information that is otherwise not key to bottle identification. An example of something that should be excluded is the "Limited Edition".
4. Must include the age statement when its a key component. The age statement should be written as AGE-years-old. (TODO: this needs better defined).
5. Must not include the regional information. For example, "Single Malt Scotch", the "Scotch" term should never be included.

Wrote a bit about this problem here: https://cra.mr/cta-structuring-unstructured-data
