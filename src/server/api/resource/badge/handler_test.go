package badge_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"peated/api/resource/common/err"
	"peated/db/model"
	"peated/test"
	"peated/test/fixture"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/suite"
)

type BadgeHandlerTestSuite struct {
	test.HandlerTestSuite
}

func TestHandler(t *testing.T) {
	suite.Run(t, new(BadgeHandlerTestSuite))
}

func (suite *BadgeHandlerTestSuite) TestHandler_List() {
	response := suite.Request("GET", "/badges", nil)

	suite.Require().Equal(http.StatusOK, response.Code)
	// suite.JSONResponseEqual(response, err.RespInsufficientPermission)
}

func (suite *BadgeHandlerTestSuite) TestHandler_Create_Unauthenticated() {
	response := suite.Request("POST", "/badges", nil)

	suite.Require().Equal(http.StatusUnauthorized, response.Code)
	suite.JSONResponseEqual(response, err.RespAuthRequired)
}

func (suite *BadgeHandlerTestSuite) TestHandler_Create_NonAdmin() {
	response := suite.RequestWithHandler("POST", "/badges", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
	})

	suite.Require().Equal(http.StatusForbidden, response.Code)
	suite.JSONResponseEqual(response, err.RespNoPermission)
}

func (suite *BadgeHandlerTestSuite) TestHandler_Create_Admin() {
	ctx := context.Background()

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Admin = true
	})

	response := suite.RequestWithHandler("POST", "/badges", bytes.NewBuffer([]byte(`{"name": "foo", "type": "region"}`)), func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
	})

	suite.Require().Equal(http.StatusCreated, response.Code)
	var payload gin.H
	err := json.Unmarshal(response.Body.Bytes(), &payload)
	suite.Require().NoError(err)
	suite.Equal(payload["name"], "foo")

}
