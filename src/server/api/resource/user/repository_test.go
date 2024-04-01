package user_test

import (
	"context"
	"peated/api/resource/user"
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

	t.Parallel()

	ctx := context.Background()

	repo := user.NewRepository(suite.DB)

	users, err := repo.List(ctx, &user.ListParams{Limit: 100})
	assert.NoError(t, err)
	assert.Equal(t, len(users), 0)
}

// func (suite *UserRepositoryTestSuite) TestRepository_ReadById(t *testing.T) {
// 	t.Parallel()

// 	test.NoError(t, err)

// 	err = db.Transaction(func(tx *gorm.DB) error {
// 		repo := user.NewRepository(tx)

// 		user, err := repo.ReadById(ctx, 1)
// 		test.NoError(t, err)
// 		test.Equal(t, "Foo Bar", user.DisplayName)

// 		return nil
// 	})
// 	test.NoError(t, err)
// }
