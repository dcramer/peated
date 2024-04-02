PG_CONTAINER=docker exec -t peated-postgres-1

test: reset-test-db
	go test ./...

reset-test-db:
	$(MAKE) drop-test-db
	$(MAKE) create-test-db
	$(MAKE) migrate-test-db

drop-test-db:
	$(PG_CONTAINER) dropdb --if-exists -h 127.0.0.1 -p 5432 -U postgres test_peated

create-test-db:
	$(PG_CONTAINER) createdb -E utf-8 -h 127.0.0.1 -p 5432 -U postgres test_peated || exit 0

migrate-test-db:
	DB_NAME=test_peated go run peated/cmd/migrate up
