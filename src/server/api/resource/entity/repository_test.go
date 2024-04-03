package entity_test

import (
	"context"
	"peated/api/resource/entity"
	"peated/database/model"
	"peated/test"
	"peated/test/fixture"
	"testing"

	"github.com/stretchr/testify/suite"
)

type EntityRepositoryTestSuite struct {
	test.DatabaseTestSuite
}

func TestRepository(t *testing.T) {
	suite.Run(t, new(EntityRepositoryTestSuite))
}

func (suite *EntityRepositoryTestSuite) TestRepository_Create_ExistingNewType() {
	ctx := context.Background()

	entity1 := *fixture.NewEntity(ctx, suite.DB, func(e *model.Entity) {
		e.Type = []string{"brand"}
	})

	repo := entity.NewRepository(suite.DB)

	entity2 := entity1
	entity2.ID = 0
	entity2.Type = []string{"distiller"}

	result, err := repo.Create(ctx, &entity2)
	suite.Require().NoError(err)
	suite.Equal(result.ID, entity1.ID)
	suite.Equal(len(result.Type), 2)
	suite.Contains(result.Type, "brand")
	suite.Contains(result.Type, "distiller")
}
