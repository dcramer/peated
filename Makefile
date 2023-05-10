PG_CONTAINER=docker exec -t peated-postgres-1

reset-db:
	$(MAKE) drop-db
	$(MAKE) create-db

drop-db:
	$(PG_CONTAINER) dropdb --if-exists -h 127.0.0.1 -p 5432 -U postgres peated
	$(PG_CONTAINER) dropdb --if-exists -h 127.0.0.1 -p 5432 -U postgres test_peated

create-db:
	$(PG_CONTAINER) createdb -E utf-8 -h 127.0.0.1 -p 5432 -U postgres peated || exit 0
	$(PG_CONTAINER) createdb -E utf-8 -h 127.0.0.1 -p 5432 -U postgres test_peated || exit 0
