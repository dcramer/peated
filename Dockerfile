FROM node:24.18.0-slim AS base
# set for base and all layer that inherit from it
ENV NODE_ENV="production" \
    DEBIAN_FRONTEND="noninteractive" \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.3.0 --activate
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        fftw-dev \
        g++ \
        gcc \
        libc-dev \
        libc6 \
        make \
    && rm -rf /var/lib/apt/lists/*

FROM base AS base-env
WORKDIR /app

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml .
COPY apps/cli/package.json ./apps/cli/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/server/package.json ./apps/server/package.json
# given packages are mostly universally shared code, this simplifies our logic
COPY packages ./packages

RUN --mount=type=cache,id=pnpm,target=/pnpm/store NODE_ENV=development SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 pnpm install --frozen-lockfile
COPY . .
# We run this again as Docker seems to wipe our node_modules, but they're cached
RUN --mount=type=cache,id=pnpm,target=/pnpm/store NODE_ENV=development SKIP_INSTALL_SIMPLE_GIT_HOOKS=1 pnpm install --frozen-lockfile

# needs bound before build
ARG SENTRY_DSN
ARG API_SERVER
ARG URL_PREFIX
ARG GOOGLE_CLIENT_ID
ARG FATHOM_SITE_ID
ARG VERSION
ARG SENTRY_PROJECT
ARG SENTRY_ORG
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_DSN=$SENTRY_DSN \
    API_SERVER=$API_SERVER \
    URL_PREFIX=$URL_PREFIX \
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
    FATHOM_SITE_ID=$FATHOM_SITE_ID \
    VERSION=$VERSION \
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

# override the command
# e.g. pnpm --filter @peated/server start:worker
CMD ["exit", "1"]
