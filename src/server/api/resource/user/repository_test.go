package user_test

import (
	"context"
	"peated/api/resource/user"
	"peated/db/model"
	"peated/test/fixture"
	"testing"

	"peated/test"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
)

type UserRepositoryTestSuite struct {
	test.DatabaseTestSuite
}

func TestUserRepository(t *testing.T) {
	suite.Run(t, new(UserRepositoryTestSuite))
}

func (suite *UserRepositoryTestSuite) TestRepository_List() {
	t := suite.T()

	ctx := context.Background()

	user1, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = "foo"
	})
	assert.NoError(t, err)
	user2, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {
		u.DisplayName = "bar"
	})

	assert.NoError(t, err)

	repo := user.NewRepository(suite.DB)

	users, err := repo.List(ctx, &user.ListParams{Limit: 100})
	assert.NoError(t, err)
	assert.Equal(t, len(users), 2)
	assert.Equal(t, users[0].ID, user2.ID)
	assert.Equal(t, users[1].ID, user1.ID)
}

func (suite *UserRepositoryTestSuite) TestRepository_ReadById() {
	t := suite.T()

	ctx := context.Background()

	_, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	assert.NoError(t, err)
	user1, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	assert.NoError(t, err)

	repo := user.NewRepository(suite.DB)

	user, err := repo.ReadById(ctx, user1.ID)
	assert.NoError(t, err)
	assert.Equal(t, user.ID, user1.ID)

	_, err = repo.ReadById(ctx, user1.ID+1)
	assert.Error(t, err)
}

func (suite *UserRepositoryTestSuite) TestRepository_ReadByUsername() {
	t := suite.T()

	ctx := context.Background()

	_, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	assert.NoError(t, err)
	user1, err := fixture.NewUser(ctx, suite.DB, func(u *model.User) {})
	assert.NoError(t, err)

	repo := user.NewRepository(suite.DB)

	user, err := repo.ReadByUsername(ctx, user1.Username)
	assert.NoError(t, err)
	assert.Equal(t, user.ID, user1.ID)

	_, err = repo.ReadByUsername(ctx, "_")
	assert.Error(t, err)
}
