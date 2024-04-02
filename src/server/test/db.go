package test

import (
	"context"
	"peated/database"

	"github.com/stretchr/testify/suite"
	"gorm.io/gorm"
)

type DatabaseTestSuite struct {
	suite.Suite

	ctx    context.Context
	dbConn *gorm.DB
	DB     *gorm.DB
}

func (suite *DatabaseTestSuite) SetupSuite() {
	suite.ctx = context.Background()

	db, err := database.Init(suite.ctx, NewConfig())
	if err != nil {
		panic(err)
	}

	suite.dbConn = db.Session(&gorm.Session{
		SkipDefaultTransaction: true,
	})
}

func (suite *DatabaseTestSuite) SetupTest() {
	suite.DB = suite.dbConn.Begin()
}

func (suite *DatabaseTestSuite) TearDownTest() {
	suite.DB.Rollback()
}
