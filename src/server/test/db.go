package test

import (
	"context"
	"log"
	"peated/config"
	"time"

	"github.com/pressly/goose/v3"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"
	gormPostgres "gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

func SetupContainer(ctx context.Context) (*postgres.PostgresContainer, error) {
	c := config.NewDB()

	postgresContainer, err := postgres.RunContainer(ctx,
		testcontainers.WithImage("ghcr.io/baosystems/postgis:15-3.3"),
		// postgres.WithInitScripts(filepath.Join("testdata", "init-user-db.sh")),
		// postgres.WithConfigFile(filepath.Join("testdata", "my-postgres.conf")),
		postgres.WithDatabase(c.Name),
		postgres.WithUsername(c.Username),
		postgres.WithPassword(c.Password),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(5*time.Second)),
	)
	if err != nil {
		return postgresContainer, err
	}

	if err := RunMigrations(ctx, postgresContainer); err != nil {
		return postgresContainer, err
	}

	return postgresContainer, nil

}

func RunMigrations(ctx context.Context, c *postgres.PostgresContainer) error {
	connectionString, err := c.ConnectionString(ctx)
	if err != nil {
		return err
	}
	db, err := goose.OpenDBWithDriver("pgx", connectionString)
	if err != nil {
		log.Fatalf(err.Error())
	}

	defer func() {
		if err := db.Close(); err != nil {
			log.Fatalf(err.Error())
		}
	}()

	if err := goose.Up(db, "migrations", goose.WithNoColor(false)); err != nil {
		return err
	}

	return nil
}

func InitDatabase(ctx context.Context, c *postgres.PostgresContainer) (*gorm.DB, error) {
	connectionString, err := c.ConnectionString(ctx)
	if err != nil {
		return nil, err
	}
	db, err := gorm.Open(gormPostgres.Open(connectionString), &gorm.Config{Logger: gormlogger.Default.LogMode(gormlogger.Info)})
	if err != nil {
		return nil, err
	}

	return db, nil
}
