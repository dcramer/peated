package entity_test

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"peated/api/resource/common/err"
	"peated/database/model"
	"peated/test"
	"peated/test/fixture"
)

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

	err := suite.DB.First(&entity2).Error
	suite.Require().Error(err)
}
