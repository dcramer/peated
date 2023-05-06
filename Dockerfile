# base node image
FROM docker.io/node:lts-alpine as base

RUN npm install -g npm

# set for base and all layer that inherit from it
ENV NODE_ENV production

FROM base as deps

WORKDIR /app

ADD . .
ADD package.json package-lock.json .
ADD apps/web/package.json apps/web/package.json
ADD apps/api/package.json apps/api/package.json
ADD packages/shared/package.json packages/shared/package.json
RUN npm install --workspaces

ADD . .

FROM base as build-web

WORKDIR /app

COPY --from=deps /app/web/apps/node_modules ./node_modules
RUN npm run build

FROM pierrezemb/gostatic as final-web
COPY --from=build-web /app/apps/web/dist /srv/http/

# FROM pierrezemb/gostatic as build-api
# COPY --from=base /app/apps/web/dist /srv/http/
