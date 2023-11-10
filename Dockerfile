FROM node:18-slim as base
# set for base and all layer that inherit from it
ENV NODE_ENV="production" \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt update -y && apt install -y libc-dev fftw-dev gcc g++ make libc6 ca-certificates
RUN npm install -g -f pnpm

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

ADD package.json pnpm-lock.yaml pnpm-workspace.yaml packages .
ADD apps/web/package.json ./apps/web/package.json
ADD apps/server/package.json ./apps/server/package.json
ADD apps/worker/package.json ./apps/worker/package.json
ADD packages/tsconfig/package.json ./packages/tsconfig/package.json
ADD packages/design/package.json ./packages/design/package.json

FROM base-env as prod-deps
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base-env AS build
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
ADD . .

# needs bound before build
ARG VERSION
ARG SENTRY_PROJECT
ARG SENTRY_ORG
ENV VERSION=$VERSION \
    SENTRY_RELEASE=$VERSION \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
    pnpm build

# web service
FROM base-env as web
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/ /app/

ENV HOST=0.0.0.0 \
    PORT=3000

EXPOSE 3000

WORKDIR /app/apps/web

ARG VERSION
ENV VERSION $VERSION

CMD ["pnpm", "start"]

# worker service
FROM base-env as worker
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/ /app/

WORKDIR /app/apps/worker

ARG VERSION
ENV VERSION $VERSION

CMD ["pnpm", "start"]

# api service
FROM base-env as api
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/ /app/

ENV HOST=0.0.0.0 \
    PORT=4000

EXPOSE 4000

WORKDIR /app/apps/server

ARG VERSION
ENV VERSION $VERSION

CMD ["pnpm", "start"]
