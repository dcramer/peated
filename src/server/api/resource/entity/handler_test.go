package entity_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"peated/api/resource/common/err"
	"peated/api/resource/entity"
	"peated/database/model"
	"peated/test"
	"peated/test/fixture"
	"strconv"
	"testing"

	"github.com/stretchr/testify/suite"
)

type EntityHandlerTestSuite struct {
	test.HandlerTestSuite
}

func TestHandler(t *testing.T) {
	suite.Run(t, new(EntityHandlerTestSuite))
}

func (suite *EntityHandlerTestSuite) TestHandler_List() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	response := suite.Request("GET", "/entities", nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data entity.EntitiesResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Require().Equal(len(data.Entities), 1)
	suite.Equal(data.Entities[0].ID, strconv.FormatUint(entity1.ID, 10))
}

func (suite *EntityHandlerTestSuite) TestHandler_List_Type() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {
		var types []string
		types = append(types, "brand")
		b.Type = types
	})

	response := suite.Request("GET", "/entities?type=brand", nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data entity.EntitiesResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Require().Equal(len(data.Entities), 1)
	suite.Equal(data.Entities[0].ID, strconv.FormatUint(entity1.ID, 10))

	response = suite.Request("GET", "/entities?type=distiller", nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	err = json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Require().Equal(len(data.Entities), 0)
}

func (suite *EntityHandlerTestSuite) TestHandler_ById() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	response := suite.Request("GET", fmt.Sprintf("/entities/%d", entity1.ID), nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data entity.EntityResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.Entity.ID, strconv.FormatUint(entity1.ID, 10))
}

func (suite *EntityHandlerTestSuite) TestHandler_ById_NotFound() {
	response := suite.Request("GET", "/entities/1", nil)

	suite.ResponseStatusEqual(response, http.StatusNotFound)
}

func (suite *EntityHandlerTestSuite) TestHandler_Create_Unauthenticated() {
	response := suite.Request("POST", "/entities", nil)

	suite.ResponseStatusEqual(response, http.StatusUnauthorized)
	suite.JSONResponseEqual(response, err.RespAuthRequired)
}

func (suite *EntityHandlerTestSuite) TestHandler_Create_NonMod() {
	response := suite.RequestWithHandler("POST", "/entities", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
	})

	suite.ResponseStatusEqual(response, http.StatusForbidden)
	suite.JSONResponseEqual(response, err.RespNoPermission)
}

func (suite *EntityHandlerTestSuite) TestHandler_Create_Mod() {
	ctx := context.Background()

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Mod = true
	})

	response := suite.RequestWithHandler("POST", "/entities", bytes.NewBuffer([]byte(`{"name": "foo", "type": ["brand"]}`)), func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
	})

	suite.ResponseStatusEqual(response, http.StatusCreated)
	var data entity.EntityResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.Entity.Name, "foo")
}

func (suite *EntityHandlerTestSuite) TestHandler_Delete_NonMod() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	response := suite.RequestWithHandler("DELETE", fmt.Sprintf("/entities/%d", entity1.ID), nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
	})

	suite.ResponseStatusEqual(response, http.StatusForbidden)
	suite.JSONResponseEqual(response, err.RespNoPermission)
}

func (suite *EntityHandlerTestSuite) TestHandler_Delete_Mod() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Mod = true
	})

	response := suite.RequestWithHandler("DELETE", fmt.Sprintf("/entities/%d", entity1.ID), nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
	})

	suite.ResponseStatusEqual(response, http.StatusNoContent)
}

func (suite *EntityHandlerTestSuite) TestHandler_Update_NonMod() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	response := suite.RequestWithHandler("PUT", fmt.Sprintf("/entities/%d", entity1.ID), bytes.NewBuffer([]byte("{}")), func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
	})

	suite.ResponseStatusEqual(response, http.StatusForbidden)
	suite.JSONResponseEqual(response, err.RespNoPermission)
}

func (suite *EntityHandlerTestSuite) TestHandler_Update_Mod() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Mod = true
	})

	response := suite.RequestWithHandler("PUT", fmt.Sprintf("/entities/%d", entity1.ID), bytes.NewBuffer([]byte("{\"name\": \"TestHandler Update Mod\"}")), func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
	})

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data entity.EntityResponse
	err := json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.Entity.Name, "TestHandler Update Mod")
}

func (suite *EntityHandlerTestSuite) TestHandler_Merge_NonMod() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	response := suite.RequestWithHandler("POST", fmt.Sprintf("/entities/%d/merge", entity1.ID), bytes.NewBuffer([]byte("{}")), func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
	})

	suite.ResponseStatusEqual(response, http.StatusForbidden)
	suite.JSONResponseEqual(response, err.RespNoPermission)
}

func (suite *EntityHandlerTestSuite) TestHandler_Merge_Mod() {
	ctx := context.Background()

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})
	entity2 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {})

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Mod = true
	})

	response := suite.RequestWithHandler("POST", fmt.Sprintf("/entities/%d/merge", entity1.ID), bytes.NewBuffer([]byte(fmt.Sprintf("{\"entityIds\": [%d]}", entity2.ID))), func(r *http.Request) {
		r.Header.Set("Authorization", fixture.NewAuthorization(r.Context(), test.NewConfig(), user))
	})

	suite.ResponseStatusEqual(response, http.StatusNoContent)
}
