package user_test

import (
	"context"
	"peated/api/resource/user"
	"peated/db/model"
	"peated/test/fixture"
	"testing"

	"peated/test"

	"github.com/stretchr/testify/suite"
)

type UserRepositoryTestSuite struct {
	test.DatabaseTestSuite
}

func TestRepository(t *testing.T) {
	suite.Run(t, new(UserRepositoryTestSuite))
}

func (suite *UserRepositoryTestSuite) TestRepository_List() {
	ctx := context.Background()

	user1 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = "foo"
	})
	user2 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = "bar"
	})

	repo := user.NewRepository(suite.DB)

	users, err := repo.List(ctx, &user.ListParams{Limit: 100})
	suite.Require().NoError(err)
	suite.Equal(len(users), 2)
	suite.Equal(users[0].ID, user2.ID)
	suite.Equal(users[1].ID, user1.ID)
}

func (suite *UserRepositoryTestSuite) TestRepository_ReadById() {
	ctx := context.Background()

	fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	user1 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})

	repo := user.NewRepository(suite.DB)

	user, err := repo.ReadById(ctx, user1.ID)
	suite.Require().NoError(err)
	suite.Equal(user.ID, user1.ID)

	_, err = repo.ReadById(ctx, user1.ID+1)
	suite.Require().Error(err)
	suite.ErrorContains(err, "record not found")
}

func (suite *UserRepositoryTestSuite) TestRepository_ReadByUsername() {
	ctx := context.Background()

	fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	user1 := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})

	repo := user.NewRepository(suite.DB)

	user, err := repo.ReadByUsername(ctx, user1.Username)
	suite.Require().NoError(err)
	suite.Equal(user.ID, user1.ID)

	_, err = repo.ReadByUsername(ctx, "_")
	suite.Require().Error(err)
	suite.ErrorContains(err, "record not found")
}
