package fixture

import (
	"context"
	"math/rand"
	"peated/auth"
	"peated/config"
	"peated/database/model"

	"github.com/jaswdr/faker/v2"

	"gorm.io/gorm"
)

func Faker() faker.Faker {
	return faker.NewWithSeed(rand.NewSource(rand.Int63()))
}

func DefaultAuthorization(ctx context.Context, db *gorm.DB, c *config.Config) string {
	user := DefaultUser(ctx, db)
	return NewAuthorization(ctx, c, user)
}

func DefaultUser(ctx context.Context, db *gorm.DB) *model.User {
	return NewUser(ctx, db, func(u *model.User) {
		u.Email = "fizz.buzz@example.com"
		u.DisplayName = "Fizzy Buzz"
		u.Username = "fizz.buzz"
		u.Active = true
		u.Admin = false
		u.Mod = false
	})
}

func NewAuthorization(ctx context.Context, c *config.Config, user *model.User) string {
	authToken, err := auth.CreateAccessToken(c, user)
	if err != nil {
		panic(err)
	}

	return "Bearer " + *authToken
}

func NewUser(ctx context.Context, db *gorm.DB, handler func(*model.User)) *model.User {
	f := Faker()

	user := &model.User{
		Email:       f.Internet().CompanyEmail(),
		DisplayName: f.Person().Name(),
		Username:    f.Person().Name(),
		Active:      true,
	}

	handler(user)

	// cannot use Struct Fill as it doesnt work with self referencing entities
	// f.Struct().Fill(&user)

	if err := db.Create(user).Error; err != nil {
		panic(err)
	}

	return user
}

func NewBadge(ctx context.Context, db *gorm.DB, handler func(*model.Badge)) *model.Badge {
	f := Faker()

	badge := &model.Badge{
		Name: f.Lorem().Word(),
		Type: model.BadgeTypeCategory,
	}

	handler(badge)

	if err := db.Create(badge).Error; err != nil {
		panic(err)
	}

	return badge
}
