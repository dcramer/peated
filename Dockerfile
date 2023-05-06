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

FROM base as build-web

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./node_modules/@peated/shared

ADD apps/web/ .

RUN npm run build

FROM base as build-api

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared ./node_modules/@peated/shared

ADD apps/api/prisma .
RUN npx prisma generate

ADD apps/api/ .

RUN npm run build

# web service
FROM pierrezemb/gostatic as web

COPY --from=build-web /app/dist /srv/http/

# api service
FROM build-api as api

WORKDIR /app

COPY --from=build-api /app/node_modules ./node_modules

ADD apps/api/ .

ENV PORT 4000

EXPOSE 4000

CMD ["npm", "start"]
