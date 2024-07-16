FROM node:20-slim as base
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

ADD .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml packages .
ADD apps/cli/package.json ./apps/cli/package.json
ADD apps/mobile/package.json ./apps/mobile/package.json
ADD apps/web/package.json ./apps/web/package.json
ADD apps/server/package.json ./apps/server/package.json
ADD packages/tsconfig/package.json ./packages/tsconfig/package.json
ADD packages/design/package.json ./packages/design/package.json

FROM base-env as build
WORKDIR /app
ADD .npmrc .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
ADD . .

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

RUN pnpm build

ENV HOST=0.0.0.0 \
    PORT=4000

EXPOSE 4000

WORKDIR /app

ARG VERSION
ENV VERSION $VERSION

# override the command
# e.g. pnpm start:worker
CMD ["exit", "1"]
