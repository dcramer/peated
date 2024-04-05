package bottle_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"peated/api/resource/bottle"
	"peated/api/resource/common/err"
	"peated/database/model"
	"peated/test"
	"peated/test/fixture"
	"strconv"
	"testing"

	"github.com/stretchr/testify/suite"
)

type BottleHandlerTestSuite struct {
	test.HandlerTestSuite
}

func TestHandler(t *testing.T) {
	suite.Run(t, new(BottleHandlerTestSuite))
}

func (suite *BottleHandlerTestSuite) TestHandler_List() {
	ctx := context.Background()

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {})

	response := suite.Request("GET", "/bottles", nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data bottle.BottlesResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Require().Equal(len(data.Bottles), 1)
	suite.Equal(data.Bottles[0].ID, strconv.FormatUint(bottle1.ID, 10))
}

func (suite *BottleHandlerTestSuite) TestHandler_ById() {
	ctx := context.Background()

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {})

	response := suite.Request("GET", fmt.Sprintf("/bottles/%d", bottle1.ID), nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data bottle.BottleResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.Bottle.ID, strconv.FormatUint(bottle1.ID, 10))
}

func (suite *BottleHandlerTestSuite) TestHandler_ById_NotFound() {
	response := suite.Request("GET", "/bottles/1", nil)

	suite.ResponseStatusEqual(response, http.StatusNotFound)
}

func (suite *BottleHandlerTestSuite) TestHandler_ById_Tombstone() {
	ctx := context.Background()

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {})
	suite.DB.Create(&model.BottleTombstone{
		BottleID:    bottle1.ID * 10,
		NewBottleID: bottle1.ID,
	})

	response := suite.Request("GET", fmt.Sprintf("/bottles/%d", bottle1.ID*10), nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data bottle.BottleResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.Bottle.ID, strconv.FormatUint(bottle1.ID, 10))
}

func (suite *BottleHandlerTestSuite) TestHandler_Create_Unauthenticated() {
	response := suite.Request("POST", "/bottles", nil)

	suite.ResponseStatusEqual(response, http.StatusUnauthorized)
	suite.JSONResponseEqual(response, err.RespAuthRequired)
}

func (suite *BottleHandlerTestSuite) TestHandler_Create_NonMod() {
	ctx := context.Background()

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Mod = true
	})

	response := suite.RequestWithHandler("POST", "/bottles", bytes.NewBuffer([]byte(`{"name": "foo"}`)), func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
	})

	suite.ResponseStatusEqual(response, http.StatusCreated)
	var data bottle.BottleResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.Bottle.Name, "foo")
}

func (suite *BottleHandlerTestSuite) TestHandler_Delete_NonMod() {
	ctx := context.Background()

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {})

	response := suite.RequestWithHandler("DELETE", fmt.Sprintf("/bottles/%d", bottle1.ID), nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
	})

	suite.ResponseStatusEqual(response, http.StatusForbidden)
	suite.JSONResponseEqual(response, err.RespNoPermission)
}

func (suite *BottleHandlerTestSuite) TestHandler_Delete_Mod() {
	ctx := context.Background()

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {})

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Mod = true
	})

	response := suite.RequestWithHandler("DELETE", fmt.Sprintf("/bottles/%d", bottle1.ID), nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
	})

	suite.ResponseStatusEqual(response, http.StatusNoContent)
}

// func (suite *BottleHandlerTestSuite) TestHandler_Update_NonMod() {
// 	ctx := context.Background()

// 	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {})

// 	response := suite.RequestWithHandler("PUT", fmt.Sprintf("/bottles/%d", bottle1.ID), bytes.NewBuffer([]byte("{}")), func(r *http.Request) {
// 		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
// 	})

// 	suite.ResponseStatusEqual(response, http.StatusForbidden)
// 	suite.JSONResponseEqual(response, err.RespNoPermission)
// }

// func (suite *BottleHandlerTestSuite) TestHandler_Update_Mod() {
// 	ctx := context.Background()

// 	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {})

// 	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
// 		u.Mod = true
// 	})

// 	response := suite.RequestWithHandler("PUT", fmt.Sprintf("/bottles/%d", bottle1.ID), bytes.NewBuffer([]byte("{\"name\": \"TestHandler Update Mod\"}")), func(r *http.Request) {
// 		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
// 	})

// 	suite.ResponseStatusEqual(response, http.StatusOK)
// 	var data bottle.BottleResponse
// 	err := json.Unmarshal(response.Body.Bytes(), &data)
// 	suite.Require().NoError(err)
// 	suite.Equal(data.Bottle.Name, "TestHandler Update Mod")
// }
