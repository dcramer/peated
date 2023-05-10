FROM node:18-alpine as base

# set for base and all layer that inherit from it
ENV NODE_ENV production

FROM base as deps

WORKDIR /app

ADD package.json package-lock.json .
ADD packages ./packages
ADD apps/web/package.json ./apps/web/package.json
ADD apps/api/package.json ./apps/api/package.json
RUN npm install --workspaces

# build web
FROM base as build-web

WORKDIR /app

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

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./node_modules/@peated/shared

ADD apps/web/ .

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
    npm run build

# build api
FROM base as build-api

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./node_modules/@peated/shared

ADD apps/api/ .

RUN npm run build

# web service
FROM nginx:alpine as web

COPY --from=build-web /app/dist /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf /etc/nginx/conf.d

EXPOSE 8043

CMD ["nginx", "-g", "daemon off;"]

# api service
FROM build-api as api

WORKDIR /app

COPY --from=build-api /app/node_modules ./node_modules

ADD apps/api/ .

ARG VERSION
ENV VERSION $VERSION

RUN echo $VERSION > VERSION

ENV HOST 0.0.0.0
ENV PORT 4000

EXPOSE 4000

CMD ["npm", "start"]
