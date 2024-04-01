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

func TestUserRepository(t *testing.T) {
	suite.Run(t, new(UserRepositoryTestSuite))
}

func (suite *UserRepositoryTestSuite) TestRepository_List() {
	ctx := context.Background()

	user1, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = "foo"
	})
	suite.Require().NoError(err)
	user2, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = "bar"
	})
	suite.Require().NoError(err)

	repo := user.NewRepository(suite.DB)

	users, err := repo.List(ctx, &user.ListParams{Limit: 100})
	suite.Require().NoError(err)
	suite.Equal(len(users), 2)
	suite.Equal(users[0].ID, user2.ID)
	suite.Equal(users[1].ID, user1.ID)
}

func (suite *UserRepositoryTestSuite) TestRepository_ReadById() {
	ctx := context.Background()

	_, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	suite.Require().NoError(err)
	user1, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	suite.Require().NoError(err)

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

	_, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	suite.Require().NoError(err)
	user1, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	suite.Require().NoError(err)

	repo := user.NewRepository(suite.DB)

	user, err := repo.ReadByUsername(ctx, user1.Username)
	suite.Require().NoError(err)
	suite.Equal(user.ID, user1.ID)

	_, err = repo.ReadByUsername(ctx, "_")
	suite.Require().Error(err)
	suite.ErrorContains(err, "record not found")
}
