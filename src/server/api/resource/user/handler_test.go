package user_test

import (
	"context"
	"encoding/json"
	"net/http"
	"peated/api/resource/user"
	"peated/database"
	"peated/database/model"
	"peated/test"
	"peated/test/fixture"
	"strconv"
	"testing"

	"github.com/stretchr/testify/suite"
)

type UserHandlerTestSuite struct {
	test.HandlerTestSuite
}

func TestHandler(t *testing.T) {
	suite.Run(t, new(UserHandlerTestSuite))
}

func (suite *UserHandlerTestSuite) TestHandler_List_Unauthenticated() {
	response := suite.Request("GET", "/users", nil)

	suite.Require().Equal(http.StatusUnauthorized, response.Code)
}

func (suite *UserHandlerTestSuite) TestHandler_List_RequireQuery() {
	ctx := context.Background()

	user1 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})

	response := suite.RequestWithHandler("GET", "/users", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(ctx, test.NewConfig(), user1))
	})

	suite.Require().Equal(http.StatusBadRequest, response.Code)
}

func (suite *UserHandlerTestSuite) TestHandler_List_Query() {
	ctx := context.Background()

	user1 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = database.Ptr("foo")
	})
	fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = database.Ptr("bar")
	})

	response := suite.RequestWithHandler("GET", "/users?query=FOO", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(ctx, test.NewConfig(), user1))
	})

	suite.Require().Equal(http.StatusOK, response.Code)
	var data user.UsersResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Require().Equal(len(data.Users), 1)
	suite.Equal(data.Users[0].ID, strconv.FormatUint(user1.ID, 10))
}

func (suite *UserHandlerTestSuite) TestHandler_List_Admin() {
	ctx := context.Background()

	user1 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = database.Ptr("foo")
		u.Admin = true
	})
	user2 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = database.Ptr("bar")
	})

	response := suite.RequestWithHandler("GET", "/users", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(ctx, test.NewConfig(), user1))
	})

	suite.Require().Equal(http.StatusOK, response.Code)
	var data *user.UsersResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Require().Equal(len(data.Users), 2)
	suite.Equal(data.Users[0].ID, strconv.FormatUint(user2.ID, 10))
	suite.Equal(data.Users[1].ID, strconv.FormatUint(user1.ID, 10))
}

func (suite *UserHandlerTestSuite) TestHandler_ByUsername() {
	ctx := context.Background()

	fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	user1 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})

	response := suite.Request("GET", "/users/"+user1.Username, nil)
	suite.Require().Equal(http.StatusOK, response.Code)
	var data user.UserResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.User.ID, strconv.FormatUint(user1.ID, 10))
}

func (suite *UserHandlerTestSuite) TestHandler_ById_NotFound() {
	response := suite.Request("GET", "/users/foobar", nil)

	suite.Require().Equal(http.StatusNotFound, response.Code)
}
