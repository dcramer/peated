package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"peated/api/resource/auth"
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

	user := fixture.DefaultUser(ctx, suite.DB)

	response := suite.RequestWithHandler("GET", "/auth", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(ctx, test.NewConfig(), user))
	})

	var data auth.AuthDTO

	suite.Equal(http.StatusOK, response.Code)
	err := json.NewDecoder(response.Body).Decode(&data)
	suite.Require().NoError(err)
	suite.NotEqual(data.User.Email, user.Email)
	suite.Equal(data.AccessToken, "")
}
