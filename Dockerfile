FROM node:18-slim as base
# set for base and all layer that inherit from it
ENV NODE_ENV="production" \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt update -y && apt install -y libc-dev fftw-dev gcc g++ make libc6
RUN npm install -g -f pnpm

FROM base as base-env
WORKDIR /app
# these are used for sourcemap publishing, and to prevent cache busting
# on docker layers - they SHOULD NOT CHANGE between targets
ARG SENTRY_DSN
ARG SENTRY_WEB_PROJECT
ARG API_SERVER
ARG GOOGLE_CLIENT_ID
ENV SENTRY_DSN=$SENTRY_DSN \
    SENTRY_WEB_PROJECT=$SENTRY_WEB_PROJECT \
    API_SERVER=$API_SERVER \
    GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID

ADD package.json pnpm-lock.yaml pnpm-workspace.yaml packages .
ADD apps/web/package.json ./apps/web/package.json
ADD apps/api/package.json ./apps/api/package.json
ADD apps/worker/package.json ./apps/worker/package.json
ADD packages/shared/package.json ./packages/shared/package.json
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
ENV VERSION $VERSION

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
    pnpm build

RUN echo $VERSION > VERSION

# web service
FROM base-env as web
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/ /app/

ENV HOST=0.0.0.0 \
    PORT=3000

EXPOSE 3000

WORKDIR /app/apps/web

CMD ["pnpm", "start"]

# worker service
FROM base-env as worker
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/ /app/

WORKDIR /app/apps/worker

CMD ["pnpm", "start"]

# api service
FROM base-env as api
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/ /app/

ENV HOST=0.0.0.0 \
    PORT=4000

EXPOSE 4000

WORKDIR /app/apps/api

CMD ["pnpm", "start"]
