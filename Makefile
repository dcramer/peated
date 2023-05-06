deploy: deploy-api deploy-web

deploy-api:
	flyctl deploy -a peated-api \
		--config fly.api.toml \
		--build-target api \
		--build-arg VERSION=$(git rev-parse HEAD) \
		-e VERSION=$(git rev-parse HEAD)

deploy-web:
	flyctl deploy -a peated-web \
		--config fly.web.toml \
		--build-target web \
		--build-arg VERSION=$(git rev-parse HEAD) \
		-e VERSION=$(git rev-parse HEAD)
