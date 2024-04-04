package entity_test

import (
	"context"
	"fmt"
	"peated/api/resource/entity"
	"peated/database"
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
	suite.Equal(entity1.ID, result.ID)
	suite.Equal(2, len(result.Type))
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
	suite.Equal("Rickshaw", brand1.Name)

	err = suite.DB.Find(&bottle1).Error
	suite.Require().NoError(err)
	suite.Equal("Rickshaw Old Smokey", bottle1.FullName)

	var aliases model.BottleAliases
	err = suite.DB.Where("bottle_id = ?", bottle1.ID).Find(&aliases).Error
	suite.Require().NoError(err)
	suite.Require().Equal(1, len(aliases))
	suite.Equal(bottle1.FullName, aliases[0].Name)
}

func (suite *EntityRepositoryTestSuite) TestRepository_Update_UpdatedShortNameAsBrand() {
	ctx := context.Background()

	currentUser := fixture.DefaultUser(ctx, suite.DB)

	brand1 := fixture.NewEntity(ctx, suite.DB, func(e *model.Entity) {
		e.ShortName = database.Ptr("JS")
		e.Name = "Jim Tom's"
	})

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {
		b.Name = "Old Smokey"
		b.FullName = "JS Old Smokey"
		b.BrandID = brand1.ID
	})

	repo := entity.NewRepository(suite.DB)

	values := make(map[string]interface{})
	values["short_name"] = "JT"

	err := repo.Update(ctx, brand1, values, currentUser)
	suite.Require().NoError(err)
	suite.Equal("JT", *brand1.ShortName)

	err = suite.DB.Find(&bottle1).Error
	suite.Require().NoError(err)
	suite.Equal("JT Old Smokey", bottle1.FullName)

	var aliases model.BottleAliases
	err = suite.DB.Where("bottle_id = ?", bottle1.ID).Order("name ASC").Find(&aliases).Error
	suite.Require().NoError(err)
	suite.Require().Equal(1, len(aliases))
	suite.Equal("JT Old Smokey", aliases[0].Name)
}

func (suite *EntityRepositoryTestSuite) TestRepository_Update_NewShortNameAsBrand() {
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
	suite.Equal("JT", *brand1.ShortName)

	err = suite.DB.Find(&bottle1).Error
	suite.Require().NoError(err)
	suite.Equal("JT Old Smokey", bottle1.FullName)

	var aliases model.BottleAliases
	err = suite.DB.Where("bottle_id = ?", bottle1.ID).Order("name ASC").Find(&aliases).Error
	suite.Require().NoError(err)
	suite.Require().Equal(2, len(aliases))
	suite.Equal(fmt.Sprintf("%s %s", brand1.Name, bottle1.Name), aliases[0].Name)
	suite.Equal(fmt.Sprintf("%s %s", *brand1.ShortName, bottle1.Name), aliases[1].Name)
}

func (suite *EntityRepositoryTestSuite) TestRepository_Merge() {
	ctx := context.Background()

	currentUser := fixture.DefaultUser(ctx, suite.DB)

	brand1 := fixture.NewEntity(ctx, suite.DB, func(e *model.Entity) {
		e.TotalBottles = 0
	})
	brand2 := fixture.NewEntity(ctx, suite.DB, func(e *model.Entity) {
		e.TotalBottles = 1
	})

	bottle1 := fixture.NewBottle(ctx, suite.DB, func(b *model.Bottle) {
		b.Name = "Old Smokey"
		b.FullName = fmt.Sprintf("%s %s", brand2.GetBottlePrefix(), b.Name)
		b.BrandID = brand2.ID
		b.BottlerID = &brand2.ID
	})

	repo := entity.NewRepository(suite.DB)

	err := repo.MergeInto(ctx, brand1.ID, []uint64{brand2.ID}, currentUser)
	suite.Require().NoError(err)

	err = suite.DB.First(&brand1).Error
	suite.Require().NoError(err)
	suite.Equal(uint(1), brand1.TotalBottles)

	// second brand should get removed
	err = suite.DB.First(&brand2).Error
	suite.Require().Error(err)

	err = suite.DB.Where("entity_id = ? AND new_entity_id = ?", brand2.ID, brand1.ID).First(&model.EntityTombstone{}).Error
	suite.Require().NoError(err)

	err = suite.DB.First(&bottle1).Error
	suite.Require().NoError(err)
	suite.Equal(brand1.ID, bottle1.BrandID)
	suite.Equal(brand1.ID, *bottle1.BottlerID)
	suite.Equal(fmt.Sprintf("%s Old Smokey", brand1.Name), bottle1.FullName)
}
