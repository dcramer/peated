package test

import (
	"context"
	"fmt"
	"log"
	"os"
	"path"
	"peated/config"
	"runtime"
	"time"

	"github.com/pressly/goose/v3"
	"github.com/stretchr/testify/suite"
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
	// 	// TODO: how do we improve this
	_, filename, _, _ := runtime.Caller(0)
	dir := path.Join(path.Dir(filename), "..")
	fmt.Printf("dir %s", dir)
	err := os.Chdir(dir)
	if err != nil {
		return err
	}

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

type DatabaseTestSuite struct {
	suite.Suite

	ctx       context.Context
	container *postgres.PostgresContainer
	dbConn    *gorm.DB
	DB        *gorm.DB
}

// TODO: lets just use our local container and bootstrap a test db?
func (suite *DatabaseTestSuite) SetupSuite() {
	suite.ctx = context.Background()

	container, err := SetupContainer(suite.ctx)
	if err != nil {
		log.Fatal(err.Error())
		panic(err)
	}

	db, err := InitDatabase(suite.ctx, container)
	if err != nil {
		panic(err)
	}

	suite.container = container
	suite.dbConn = db
}

func (suite *DatabaseTestSuite) SetupTest() {
	suite.DB = suite.dbConn.Begin()
}

func (suite *DatabaseTestSuite) TearDownTest() {
	suite.DB.Rollback()
}

func (suite *DatabaseTestSuite) TearDownSuite() {
	if err := suite.container.Terminate(suite.ctx); err != nil {
		log.Fatalf("failed to terminate container: %s", err)
	}
}
