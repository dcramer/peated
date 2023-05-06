deploy: deploy-api deploy-web

deploy-api:
	flyctl deploy --remote-only -a peated-api \
		--config fly.api.toml \
		--build-target api \
		--build-arg VERSION=$(git rev-parse HEAD) \
		-e VERSION=$(git rev-parse HEAD)

deploy-web:
	flyctl deploy --remote-only -a peated-web \
		--config fly.web.toml \
		--build-target web \
		--build-arg SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN} \
		--build-arg SENTRY_ORG=${SENTRY_ORG} \
		--build-arg SENTRY_PROJECT=${SENTRY_PROJECT} \
		--build-arg VERSION=$(git rev-parse HEAD) \
