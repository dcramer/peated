package badge_test

import (
	"context"
	"peated/api/resource/badge"
	"peated/database/model"
	"peated/test/fixture"
	"testing"

	"peated/test"

	"github.com/stretchr/testify/suite"
)

type BadgeRepositoryTestSuite struct {
	test.DatabaseTestSuite
}

func TestRepository(t *testing.T) {
	suite.Run(t, new(BadgeRepositoryTestSuite))
}

func (suite *BadgeRepositoryTestSuite) TestRepository_List() {
	ctx := context.Background()

	badge1 := fixture.NewBadge(ctx, suite.DB, func(u *model.Badge) {
		u.Name = "foo"
	})
	badge2 := fixture.NewBadge(ctx, suite.DB, func(u *model.Badge) {
		u.Name = "bar"
	})

	repo := badge.NewRepository(suite.DB)

	badges, err := repo.List(ctx, &badge.ListInput{Limit: 100})
	suite.Require().NoError(err)
	suite.Equal(len(badges), 2)
	suite.Equal(badges[0].ID, badge2.ID)
	suite.Equal(badges[1].ID, badge1.ID)

	badges, err = repo.List(ctx, &badge.ListInput{Query: "FOO", Limit: 100})
	suite.Require().NoError(err)
	suite.Equal(len(badges), 1)
	suite.Equal(badges[0].ID, badge1.ID)
}

func (suite *BadgeRepositoryTestSuite) TestRepository_ReadById() {
	ctx := context.Background()

	fixture.NewBadge(ctx, suite.DB, func(u *model.Badge) {})
	badge1 := fixture.NewBadge(ctx, suite.DB, func(u *model.Badge) {})

	repo := badge.NewRepository(suite.DB)

	user, err := repo.ReadById(ctx, badge1.ID)
	suite.Require().NoError(err)
	suite.Equal(user.ID, badge1.ID)

	_, err = repo.ReadById(ctx, badge1.ID+1)
	suite.Require().Error(err)
	suite.ErrorContains(err, "record not found")
}
