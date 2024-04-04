package fixture

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"peated/auth"
	"peated/config"
	"peated/database"
	"peated/database/column/spatial"
	"peated/database/model"
	"time"

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
	user := &model.User{
		Email:       "fizz.buzz@example.com",
		DisplayName: database.Ptr("Fizzy Buzz"),
		Username:    "fizz.buzz",
		Active:      true,
		Admin:       false,
		Mod:         false,
		CreatedAt:   time.Now(),
	}

	err := db.Transaction(func(tx *gorm.DB) error {
		if err := db.Create(user).Error; err != nil {
			return err
		}

		return nil
	})
	if database.IsKeyConflictErr(err) {
		if err := db.Where("email = ?", user.Email).First(&user).Error; err != nil {
			panic(err)
		}
	}

	return user
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
		DisplayName: database.Ptr(f.Person().Name()),
		Username:    f.Internet().User(),
		Active:      true,
		CreatedAt:   time.Now(),
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
		Name: f.App().Name(),
		Type: model.BadgeTypeCategory,
	}

	handler(badge)

	if err := db.Create(badge).Error; err != nil {
		panic(err)
	}

	return badge
}

func randChoice[T any](slice []T) T {
	n := rand.Intn(len(slice))
	return slice[n]
}

func NewBottle(ctx context.Context, db *gorm.DB, handler func(*model.Bottle)) *model.Bottle {
	f := Faker()

	bottle := &model.Bottle{
		Name: fmt.Sprintf("%s #%d", f.App().Name(), f.RandomNumber(100)),
		Category: database.Ptr(randChoice([]string{
			model.CategoryBlend,
			model.CategoryBourbon,
			model.CategoryRye,
			model.CategorySingleGrain,
			model.CategorySingleMalt,
			model.CategorySinglePotStill,
			model.CategorySpirit,
		})),
		StatedAge: database.Ptr(randChoice([]uint{0, 3, 10, 12, 15, 18, 20, 25})),
		CreatedAt: time.Now(),
	}

	handler(bottle)

	err := db.Transaction(func(tx *gorm.DB) error {
		if bottle.BrandID == 0 {
			bottle.BrandID = NewEntity(ctx, db, func(e *model.Entity) {
				e.Type = []string{model.EntityTypeBrand}
				e.TotalBottles = 1
			}).ID
		}

		if bottle.CreatedByID == 0 {
			bottle.CreatedByID = DefaultUser(ctx, tx).ID
		}

		if err := tx.Create(bottle).Error; err != nil {
			return err
		}

		if err := tx.Create(&model.BottleAlias{
			Name:     bottle.FullName,
			BottleID: bottle.ID,
		}).Error; err != nil {
			return err
		}

		bottleData, err := json.Marshal(bottle)
		if err != nil {
			return err
		}

		if err := tx.Create(&model.Change{
			ObjectID:    bottle.ID,
			ObjectType:  "bottle",
			Type:        model.ChangeTypeAdd,
			DisplayName: &bottle.FullName,
			CreatedAt:   bottle.CreatedAt,
			CreatedByID: bottle.CreatedByID,
			Data:        bottleData,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		panic(err)
	}

	return bottle
}

func NewEntity(ctx context.Context, db *gorm.DB, handler func(*model.Entity)) *model.Entity {
	f := Faker()

	location, err := spatial.NewPoint("-122.4194", "37.7749")
	if err != nil {
		panic(err)
	}

	entity := &model.Entity{
		Name:      f.App().Name(),
		Type:      []string{model.EntityTypeBrand, model.EntityTypeDistiller},
		Country:   database.Ptr(f.Address().Country()),
		Website:   database.Ptr(f.Internet().URL()),
		CreatedAt: time.Now(),
		Location:  location,
	}

	handler(entity)

	err = db.Transaction(func(tx *gorm.DB) error {
		if entity.CreatedByID == 0 {
			entity.CreatedByID = DefaultUser(ctx, tx).ID
		}

		if err := tx.Create(entity).Error; err != nil {
			return err
		}

		entityData, err := json.Marshal(entity)
		if err != nil {
			return err
		}

		if err := tx.Create(&model.Change{
			ObjectID:    entity.ID,
			ObjectType:  "entity",
			Type:        model.ChangeTypeAdd,
			DisplayName: &entity.Name,
			CreatedAt:   entity.CreatedAt,
			CreatedByID: entity.CreatedByID,
			Data:        entityData,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		panic(err)
	}

	return entity
}
