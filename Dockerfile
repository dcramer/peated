FROM node:alpine AS base
RUN apk update && apk add git
RUN npm i -g turbo

# Prune the workspace for the `web` app
FROM base as pruner
WORKDIR /app
COPY . .
RUN turbo prune --scope=web --docker
 
# Add pruned lockfile and package.json's of the pruned subworkspace
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-json.lock ./package-json.lock
# Install only the deps needed to build the target
RUN npm install
 
# Copy source code of pruned subworkspace and build
FROM base as builder
WORKDIR /app
COPY --from=pruner /app/.git ./.git
COPY --from=pruner /app/out/full/ .
COPY --from=installer /app/ .
RUN turbo run build --scope=web
 
# Start the app
FROM builder as runner
EXPOSE 3000
RUN ['npm', '--cwd', 'web', 'start']

