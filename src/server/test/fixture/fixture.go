package fixture

import (
	"context"
	"math/rand"
	"peated/auth"
	"peated/config"
	"peated/db/model"

	"github.com/jaswdr/faker/v2"

	"gorm.io/gorm"
)

func DefaultAuthorization(ctx context.Context, db *gorm.DB, c *config.Config) string {
	user := NewUser(ctx, db, func(u *model.User) {
		u.Email = "fizz.buzz@example.com"
		u.DisplayName = "Fizzy Buzz"
		u.Username = "fizz.buzz"
		u.Active = true
		u.Admin = false
		u.Mod = false
	})

	return NewAuthorization(ctx, db, c, user)
}

func NewAuthorization(ctx context.Context, db *gorm.DB, c *config.Config, user *model.User) string {
	authToken, err := auth.CreateAccessToken(c, db, user)
	if err != nil {
		panic(err)
	}

	return "Bearer " + *authToken
}

func NewUser(ctx context.Context, db *gorm.DB, handler func(*model.User)) *model.User {
	f := faker.NewWithSeed(rand.NewSource(rand.Int63()))

	user := &model.User{
		Email:       f.Internet().CompanyEmail(),
		DisplayName: f.Person().Name(),
		Username:    f.Person().Name(),
	}

	handler(user)

	// cannot use Struct Fill as it doesnt work with self referencing entities
	// f.Struct().Fill(&user)

	if err := db.Create(user).Error; err != nil {
		panic(err)
	}

	return user
}
