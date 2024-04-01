package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"peated/api/resource/auth"
	"peated/api/resource/common/err"
	"peated/db/model"
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

func (suite *AuthHandlerTestSuite) TestHandler_Read_Unauthenticated() {
	response := suite.Request("GET", "/auth", nil)

	suite.Require().Equal(http.StatusUnauthorized, response.Code)
	suite.Equal(err.RespInvalidCredentials, response.Body.Bytes())
}

func (suite *AuthHandlerTestSuite) TestHandler_Read_Authenticated() {
	ctx := context.Background()

	user := fixture.DefaultUser(ctx, suite.DB)

	response := suite.RequestWithHandler("GET", "/auth", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(ctx, test.NewConfig(), user))
	})

	var data auth.AuthDTO

	suite.Require().Equal(http.StatusOK, response.Code)
	err := json.NewDecoder(response.Body).Decode(&data)
	suite.Require().NoError(err)
	suite.NotEqual(data.User.Email, user.Email)
	suite.Equal(data.AccessToken, "")
}

func (suite *AuthHandlerTestSuite) TestHandler_EmailPassword_ValidCredentials() {
	ctx := context.Background()

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Email = "foo@example.com"
		err := u.SetPassword([]byte("bar"))
		suite.Require().NoError(err)
	})

	response := suite.Request("POST", "/auth/basic", bytes.NewBuffer([]byte(`{"email": "foo@example.com", "password": "bar"}`)))

	var data auth.AuthDTO

	suite.Require().Equal(http.StatusOK, response.Code)
	err := json.NewDecoder(response.Body).Decode(&data)
	suite.Require().NoError(err)
	suite.NotEqual(data.User.Email, user.Email)
	suite.NotEqual(data.AccessToken, "")
}

func (suite *AuthHandlerTestSuite) TestHandler_EmailPassword_InvalidCredentials() {
	ctx := context.Background()

	fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Email = "foo@example.com"
	})

	response := suite.Request("POST", "/auth/basic", bytes.NewBuffer([]byte(`{"username": "foo@example.com", "password": "baz"}`)))

	suite.Require().Equal(http.StatusUnauthorized, response.Code)
	suite.Equal(err.RespInvalidCredentials, response.Body.Bytes())
}
