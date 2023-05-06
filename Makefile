deploy: deploy-api deploy-web

deploy-api:
	flyctl deploy -a peated-api \
		--remote-only \
		--config fly.api.toml \
		--build-target api \
		--build-arg SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
		--build-arg SENTRY_ORG=${SENTRY_ORG} \
		--build-arg SENTRY_PROJECT=${SENTRY_PROJECT} \
		--build-arg VERSION=$(shell git rev-parse --short HEAD) \
		-e VERSION=$(shell git rev-parse --short HEAD)

deploy-web:
	flyctl deploy -a peated-web \
		--remote-only \
		--config fly.web.toml \
		--build-target web \
		--build-arg SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
		--build-arg SENTRY_ORG=${SENTRY_ORG} \
		--build-arg SENTRY_PROJECT=${SENTRY_PROJECT} \
		--build-arg VERSION=$(shell git rev-parse --short HEAD) \
		--build-arg API_SERVER=https://api.peated.app
