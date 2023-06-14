FROM node:18-alpine as base

# set for base and all layer that inherit from it
ENV NODE_ENV production

RUN apk update && apk add vips vips-dev libc-dev fftw-dev gcc g++ make libc6-compat libheif libde265 libspng

RUN npm install -g pnpm

FROM base as build

WORKDIR /app

ADD package.json pnpm-lock.yaml pnpm-workspace.yaml .
ADD packages ./packages
ADD apps/web/package.json ./apps/web/package.json
ADD apps/api/package.json ./apps/api/package.json
ADD apps/scraper/package.json ./apps/scraper/package.json
RUN pnpm install

ARG VERSION
ENV VERSION $VERSION

ARG SENTRY_DSN
ENV SENTRY_DSN $SENTRY_DSN

ARG SENTRY_ORG
ENV SENTRY_ORG $SENTRY_ORG

ARG SENTRY_PROJECT
ENV SENTRY_PROJECT $SENTRY_PROJECT

ARG API_SERVER
ENV API_SERVER $API_SERVER

ARG GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_ID $GOOGLE_CLIENT_ID

ADD . .

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
    pnpm build

# web service
FROM build as web

WORKDIR /app

COPY --from=build /app/ ./

ARG VERSION
ENV VERSION $VERSION

RUN echo $VERSION > VERSION

ENV HOST 0.0.0.0
ENV PORT 3000

EXPOSE 3000

WORKDIR /app/apps/web

CMD ["pnpm", "start"]

# api service
FROM build as api

WORKDIR /app

COPY --from=build /app/ ./

ARG VERSION
ENV VERSION $VERSION

RUN echo $VERSION > VERSION

ENV HOST 0.0.0.0
ENV PORT 4000

EXPOSE 4000

WORKDIR /app/apps/api

CMD ["pnpm", "start"]
