package auth_test

import (
	"net/http"
	"peated/api/resource/common/err"
	"peated/test"
	"testing"

	"github.com/stretchr/testify/suite"
)

type AuthHandlerTestSuite struct {
	test.HandlerTestSuite
}

func TestHealthHandler(t *testing.T) {
	suite.Run(t, new(AuthHandlerTestSuite))
}

func (suite *AuthHandlerTestSuite) TestHandler_Get() {
	response := suite.Request("GET", "/auth", nil)

	suite.Equal(http.StatusUnauthorized, response.Code)
	suite.Equal(err.RespInvalidCredentials, response.Body.Bytes())
}
