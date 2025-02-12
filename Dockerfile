FROM node:22-slim as base
# set for base and all layer that inherit from it
ENV NODE_ENV="production" \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt update -y && apt install -y libc-dev fftw-dev gcc g++ make libc6 ca-certificates

FROM base as base-env
WORKDIR /app
# these are used for sourcemap publishing, and to prevent cache busting
# on docker layers - they SHOULD NOT CHANGE between targets
ARG SENTRY_DSN
ARG API_SERVER
ARG URL_PREFIX
ARG GOOGLE_CLIENT_ID
ARG FATHOM_SITE_ID
ENV SENTRY_DSN=$SENTRY_DSN \
    API_SERVER=$API_SERVER \
    URL_PREFIX=$URL_PREFIX \
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
    FATHOM_SITE_ID=$FATHOM_SITE_ID

ADD .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml .
ADD apps/cli/package.json ./apps/cli/package.json
ADD apps/web/package.json ./apps/web/package.json
ADD apps/server/package.json ./apps/server/package.json
# given packages are mostly universally shared code, this simplifies our logic
ADD packages .

# ensure latest corepack otherwise we could hit cert issues
RUN npm i -g corepack@latest

RUN --mount=type=cache,id=pnpm,target=/pnpm/store NODE_ENV=development pnpm install --frozen-lockfile
ADD . .
# We run this again as Docker seems to wipe our node_modules, but they're cached
RUN --mount=type=cache,id=pnpm,target=/pnpm/store NODE_ENV=development pnpm install --frozen-lockfile

# needs bound before build
ARG VERSION
ARG SENTRY_PROJECT
ARG SENTRY_ORG
ARG SENTRY_AUTH_TOKEN
ENV VERSION=$VERSION \
    SENTRY_RELEASE=$VERSION \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT \
    SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

RUN pnpm build:docker

# TODO: it'd be nice to optimize the build, but we're beholden with a ton of node_modules from having to use hoisting
# Prune node_modules to prod deps
# RUN --mount=type=cache,id=pnpm,target=/pnpm/store NODE_ENV=development pnpm install --prod --frozen-lockfile
# Wipe the store
# RUN rm -rf /pnpm/store

ENV HOST=0.0.0.0 \
    PORT=4000

EXPOSE 4000

WORKDIR /app

ARG VERSION
ENV VERSION $VERSION

# override the command
# e.g. pnpm start:worker
CMD ["exit", "1"]
