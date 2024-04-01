package test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"peated/api/router"
	"peated/config"
	"peated/util/logger"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"
)

func NewServer(db *gorm.DB) *chi.Mux {
	config := config.New()
	logger := logger.New(true)

	router := router.New(
		logger,
		config,
		db,
	)

	return router
}

type HandlerTestSuite struct {
	DatabaseTestSuite

	Server *chi.Mux
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
	server := NewServer(suite.DB)

	req, _ := http.NewRequest(method, url, body)

	response := httptest.NewRecorder()
	server.ServeHTTP(response, req)
	return response
}
