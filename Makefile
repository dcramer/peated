PG_CONTAINER=docker exec -t peated-postgres-1

setup:
	pnpm run setup

reset-db:
	$(MAKE) drop-db
	$(MAKE) create-db

reset-test-db:
	$(MAKE) drop-db-test
	$(MAKE) create-db-test

drop-db: drop-db-dev drop-db-test

drop-db-dev:
	$(PG_CONTAINER) dropdb --if-exists -h 127.0.0.1 -p 5432 -U postgres peated

drop-db-test:
	$(PG_CONTAINER) dropdb --if-exists -h 127.0.0.1 -p 5432 -U postgres test_peated

create-db: create-db-dev create-db-test

create-db-dev:
	$(PG_CONTAINER) createdb -E utf-8 -h 127.0.0.1 -p 5432 -U postgres peated || exit 0

create-db-test:
	$(PG_CONTAINER) createdb -E utf-8 -h 127.0.0.1 -p 5432 -U postgres test_peated || exit 0
