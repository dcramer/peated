FROM node:18-slim as base
# set for base and all layer that inherit from it
ENV NODE_ENV production
ENV PNPM_HOME "/pnpm"
ENV PATH "$PNPM_HOME:$PATH"
RUN corepack enable
RUN apt update -y && apt install -y libc-dev fftw-dev gcc g++ make libc6
RUN npm install -g -f pnpm

FROM base as base-env
WORKDIR /app
ARG SENTRY_DSN
ENV SENTRY_DSN $SENTRY_DSN
ARG SENTRY_PROJECT
ENV SENTRY_PROJECT $SENTRY_PROJECT
ARG API_SERVER
ENV API_SERVER $API_SERVER
ARG GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_ID $GOOGLE_CLIENT_ID

ADD package.json pnpm-lock.yaml pnpm-workspace.yaml .
ADD packages ./packages
ADD apps/web/package.json ./apps/web/package.json
ADD apps/api/package.json ./apps/api/package.json
ADD apps/scraper/package.json ./apps/scraper/package.json

FROM base-env as prod-deps
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base-env AS build
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
ADD . .
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
    pnpm build

ARG VERSION
ENV VERSION $VERSION

RUN echo $VERSION > VERSION

# web service
FROM prod-deps as web
COPY --from=build /app/ /app/

ENV HOST 0.0.0.0
ENV PORT 3000

EXPOSE 3000

WORKDIR /app/apps/web

CMD ["pnpm", "start"]

# scraper service
FROM prod-deps as scraper
COPY --from=build /app/ /app/

WORKDIR /app/apps/scraper

CMD ["pnpm", "start"]

# api service
FROM prod-deps as api
COPY --from=build /app/ /app/

ENV HOST 0.0.0.0
ENV PORT 4000

EXPOSE 4000

WORKDIR /app/apps/api

CMD ["pnpm", "start"]
