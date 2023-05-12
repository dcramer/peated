FROM node:18-alpine as base

# set for base and all layer that inherit from it
ENV NODE_ENV production

RUN npm install -g pnpm

FROM base as build

WORKDIR /app

ADD . .
# ADD package.json pnpm-lock.yaml pnpm-workspace.yaml .
# ADD packages ./packages
# ADD apps/web/package.json ./apps/web/package.json
# ADD apps/api/package.json ./apps/api/package.json
RUN pnpm install

ARG VERSION
ENV VERSION $VERSION
ENV VITE_VERSION $VERSION

ARG SENTRY_DSN
ENV SENTRY_DSN $SENTRY_DSN
ENV VITE_SENTRY_DSN $SENTRY_DSN

ARG SENTRY_ORG
ENV SENTRY_ORG $SENTRY_ORG

ARG SENTRY_PROJECT
ENV SENTRY_PROJECT $SENTRY_PROJECT

ARG API_SERVER
ENV API_SERVER $API_SERVER
ENV VITE_API_SERVER $API_SERVER

ARG GOOGLE_CLIENT_ID
ENV GOOGLE_CLIENT_ID $GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID $GOOGLE_CLIENT_ID

RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/SENTRY_AUTH_TOKEN)" \
    pnpm build

# web service
FROM nginx:alpine as web

COPY --from=build /app/apps/web/dist /usr/share/nginx/html

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx/nginx.conf /etc/nginx/conf.d

EXPOSE 8043

CMD ["nginx", "-g", "daemon off;"]

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
