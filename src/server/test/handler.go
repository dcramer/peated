package test

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"peated/api/router"
	"peated/util/logger"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func NewHandler(db *gorm.DB) *gin.Engine {
	config := NewConfig()
	logger := logger.New(config.Debug)

	router := router.New(
		logger,
		config,
		db,
	)

	return router
}

type HandlerTestSuite struct {
	DatabaseTestSuite
}

// func (suite *HandlerTestSuite) SetupTest() {
// 	(*DatabaseTestSuite).SetupTest(suite)
// }

// func (suite *HandlerTestSuite) TearDownTest() {
// 	(*DatabaseTestSuite).TearDownTest()

// 	suite.DB.Rollback()
// }

func (suite *HandlerTestSuite) Request(method string, url string, body io.Reader) *httptest.ResponseRecorder {
	// TODO: this should be bound once in SetupTest but we need to have it also run the DatabaseTestSuite setup
	server := NewHandler(suite.DB)

	req, err := http.NewRequest(method, url, body)
	req.Header.Set("Content-Type", "application/json")
	suite.Require().NoError(err)

	response := httptest.NewRecorder()
	server.ServeHTTP(response, req)
	return response
}

func (suite *HandlerTestSuite) RequestWithHandler(method string, url string, body io.Reader, handler func(*http.Request)) *httptest.ResponseRecorder {
	// TODO: this should be bound once in SetupTest but we need to have it also run the DatabaseTestSuite setup
	server := NewHandler(suite.DB)

	req, err := http.NewRequest(method, url, body)
	req.Header.Set("Content-Type", "application/json")
	suite.Require().NoError(err)

	handler(req)

	response := httptest.NewRecorder()
	server.ServeHTTP(response, req)
	return response
}

func (suite *HandlerTestSuite) JSONResponseEqual(response *httptest.ResponseRecorder, value gin.H) {
	var payload gin.H
	err := json.Unmarshal(response.Body.Bytes(), &payload)
	suite.Require().NoError(err)
	suite.Equal(value, payload)
}
