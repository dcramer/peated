deploy: deploy-api deploy-web

deploy-api:
	flyctl deploy -a peated-api \
		--remote-only \
		--config fly.api.toml \
		--build-arg SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
		--build-arg VERSION=$(shell git rev-parse --short HEAD) \
		-e VERSION=$(shell git rev-parse --short HEAD)

deploy-web:
	flyctl deploy -a peated-web \
		--remote-only \
		--config fly.web.toml \
		--build-arg SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
		--build-arg VERSION=$(shell git rev-parse --short HEAD) \
