package auth_test

import (
	"context"
	"net/http"
	"peated/api/resource/common/err"
	"peated/test"
	"peated/test/fixture"
	"testing"

	"github.com/stretchr/testify/suite"
)

type AuthHandlerTestSuite struct {
	test.HandlerTestSuite
}

func TestHandler(t *testing.T) {
	suite.Run(t, new(AuthHandlerTestSuite))
}

func (suite *AuthHandlerTestSuite) TestHandler_GetUnauthenticated() {
	response := suite.Request("GET", "/auth", nil)

	suite.Equal(http.StatusUnauthorized, response.Code)
	suite.Equal(err.RespInvalidCredentials, response.Body.Bytes())
}

func (suite *AuthHandlerTestSuite) TestHandler_GetAuthenticated() {
	ctx := context.Background()
	response := suite.RequestWithHandler("GET", "/auth", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(ctx, suite.DB, test.NewConfig()))
	})

	suite.Equal(http.StatusOK, response.Code)
	// suite.Equal(err.RespInvalidCredentials, response.Body.Bytes())
}
