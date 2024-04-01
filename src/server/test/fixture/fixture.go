package fixture

import (
	"context"
	"math/rand"
	"peated/db/model"

	"github.com/jaswdr/faker/v2"

	"gorm.io/gorm"
)

func NewUser(ctx context.Context, db *gorm.DB, setValues func(*model.User)) (*model.User, error) {
	f := faker.NewWithSeed(rand.NewSource(rand.Int63()))

	user := &model.User{
		Email:       f.Internet().CompanyEmail(),
		DisplayName: f.Person().Name(),
		Username:    f.Person().Name(),
	}

	setValues(user)

	// cannot use Struct Fill as it doesnt work with self referencing entities
	// f.Struct().Fill(&user)

	if err := db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}
