package entity_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"peated/api/resource/common/err"
	"peated/api/resource/entity"
	"peated/database/column/spatial"
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

	location, err := spatial.NewPoint("-122.4194", "37.7749")
	suite.Require().NoError(err)

	entity1 := fixture.NewEntity(ctx, suite.DB, func(b *model.Entity) {
		b.Location = location
	})

	response := suite.Request("GET", fmt.Sprintf("/entities/%d", entity1.ID), nil)

	suite.ResponseStatusEqual(response, http.StatusOK)
	var data entity.EntityResponse
	err = json.Unmarshal(response.Body.Bytes(), &data)
	suite.Require().NoError(err)
	suite.Equal(data.Entity.ID, strconv.FormatUint(entity1.ID, 10))
	suite.Equal(data.Entity.Location.Lng, -122.4194)
	suite.Equal(data.Entity.Location.Lat, 37.7749)
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

func (suite *EntityHandlerTestSuite) TestHandler_Create_NonAdmin() {
	response := suite.RequestWithHandler("POST", "/entities", nil, func(r *http.Request) {
		r.Header.Set("Authorization", fixture.DefaultAuthorization(r.Context(), suite.DB, test.NewConfig()))
	})

	suite.ResponseStatusEqual(response, http.StatusForbidden)
	suite.JSONResponseEqual(response, err.RespNoPermission)
}

func (suite *EntityHandlerTestSuite) TestHandler_Create_Admin() {
	ctx := context.Background()

	user := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.Admin = true
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
