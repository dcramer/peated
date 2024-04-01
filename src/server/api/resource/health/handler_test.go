package health_test

import (
	"net/http"
	"peated/test"
	"testing"

	"github.com/stretchr/testify/suite"
)

type HealthHandlerTestSuite struct {
	test.HandlerTestSuite
}

func TestHandler(t *testing.T) {
	suite.Run(t, new(HealthHandlerTestSuite))
}

func (suite *HealthHandlerTestSuite) TestHandler_Get() {
	response := suite.Request("GET", "/_health", nil)

	suite.Equal(http.StatusOK, response.Code)
	suite.Equal("ok", response.Body.String())
}
