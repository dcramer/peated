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
		e.Type = []string{model.EntityTypeBrand}
	})

	repo := entity.NewRepository(suite.DB)

	entity2 := entity1
	entity2.ID = 0
	entity2.Type = []string{model.EntityTypeDistiller}

	result, err := repo.Create(ctx, &entity2)
	suite.Require().NoError(err)
	suite.Equal(result.ID, entity1.ID)
	suite.Equal(len(result.Type), 2)
	suite.Contains(result.Type, model.EntityTypeBrand)
	suite.Contains(result.Type, model.EntityTypeDistiller)
}

func (suite *EntityRepositoryTestSuite) TestRepository_Update_NameAsBrand() {
	ctx := context.Background()

	currentUser := fixture.DefaultUser(ctx, suite.DB)

	brand1 := fixture.NewEntity(ctx, suite.DB, func(e *model.Entity) {
		e.Name = "Jim Tom's"
	})

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {
		b.Name = "Old Smokey"
		b.FullName = "Jim Tom's Old Smokey"
		b.BrandID = brand1.ID
	})

	repo := entity.NewRepository(suite.DB)

	values := make(map[string]interface{})
	values["name"] = "Rickshaw"

	err := repo.Update(ctx, brand1, values, currentUser)
	suite.Require().NoError(err)
	suite.Equal(brand1.Name, "Rickshaw")

	err = suite.DB.Find(&bottle1).Error
	suite.Require().NoError(err)
	suite.Equal(bottle1.FullName, "Rickshaw Old Smokey")

	var aliases model.BottleAliases
	err = suite.DB.Where("bottle_id = ?", bottle1.ID).Find(&aliases).Error
	suite.Require().NoError(err)
	suite.Require().Equal(len(aliases), 1)
	suite.Equal(aliases[0].Name, bottle1.FullName)
}

func (suite *EntityRepositoryTestSuite) TestRepository_Update_ShortNameAsBrand() {
	ctx := context.Background()

	currentUser := fixture.DefaultUser(ctx, suite.DB)

	brand1 := fixture.NewEntity(ctx, suite.DB, func(e *model.Entity) {
		e.Name = "Jim Tom's"
	})

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {
		b.Name = "Old Smokey"
		b.FullName = "Jim Tom's Old Smokey"
		b.BrandID = brand1.ID
	})

	repo := entity.NewRepository(suite.DB)

	values := make(map[string]interface{})
	values["short_name"] = "JT"

	err := repo.Update(ctx, brand1, values, currentUser)
	suite.Require().NoError(err)
	suite.Equal(*brand1.ShortName, "JT")

	err = suite.DB.Find(&bottle1).Error
	suite.Require().NoError(err)
	suite.Equal(bottle1.FullName, "JT Old Smokey")

	var aliases model.BottleAliases
	err = suite.DB.Where("bottle_id = ?", bottle1.ID).Find(&aliases).Error
	suite.Require().NoError(err)
	suite.Require().Equal(len(aliases), 1)
	suite.Equal(aliases[0].Name, bottle1.FullName)
}
