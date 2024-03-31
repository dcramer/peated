package db

import (
	"context"
	"fmt"
	"peated/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

const fmtDBString = "host=%s user=%s password=%s dbname=%s port=%d sslmode=disable"

func Init(ctx context.Context, c *config.Config) (*gorm.DB, error) {
	var logLevel gormlogger.LogLevel
	if c.Debug {
		logLevel = gormlogger.Info
	} else {
		logLevel = gormlogger.Error
	}

	dbString := fmt.Sprintf(fmtDBString, c.Database.Host, c.Database.Username, c.Database.Password, c.Database.Name, c.Database.Port)
	db, err := gorm.Open(postgres.Open(dbString), &gorm.Config{Logger: gormlogger.Default.LogMode(logLevel)})
	if err != nil {
		return nil, err
	}

	return db, nil
}
