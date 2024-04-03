package entity

import (
	"context"
	"encoding/json"
	"time"

	"github.com/go-errors/errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"peated/database"
	"peated/database/model"
)

type void struct{}

func missing(a, b []string) []string {
	// create map with length of the 'a' slice
	ma := make(map[string]void, len(a))
	diffs := []string{}
	// Convert first slice to map with empty struct (0 bytes)
	for _, ka := range a {
		ma[ka] = void{}
	}
	// find missing values in a
	for _, kb := range b {
		if _, ok := ma[kb]; !ok {
			diffs = append(diffs, kb)
		}
	}
	return diffs
}

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) List(ctx context.Context, input *ListInput) (model.Entities, error) {
	clauses := make([]clause.Expression, 0)

	var entities model.Entities

	if input.Query != "" {
		clauses = append(clauses, clause.Or(
			database.ILike{Column: "name", Value: "%" + input.Query + "%"},
			database.ILike{Column: "name", Value: "%The " + input.Query + "%"},
			database.ILike{Column: "short_name", Value: "%" + input.Query + "%"},
		))
	}
	if input.Type != "" {
		clauses = append(clauses, database.Any{Column: "type", Value: input.Type})
	}
	if input.Country != "" {
		clauses = append(clauses, database.ILike{Column: "country", Value: input.Country})
	}
	if input.Region != "" {
		clauses = append(clauses, database.ILike{Column: "region", Value: input.Region})
	}

	var orderBy string
	switch input.Sort {
	case "name":
		orderBy = "name ASC"
	case "-name":
		orderBy = "name DESC"
	case "created":
		orderBy = "created_at ASC"
	case "-created":
		orderBy = "created_at DESC"
	case "bottles":
		orderBy = "total_bottles ASC"
	case "-bottles":
		orderBy = "total_bottles DESC"
	case "tastings":
		orderBy = "total_tastings ASC"
	case "-tastings":
	default:
		orderBy = "total_tastings DESC"
	}

	query := r.db.Clauses(clauses...).Offset(input.Cursor).Limit(input.Limit).Order(orderBy).Find(&entities)
	if err := query.Error; err != nil {
		return entities, err
	}

	return entities, nil
}

func (r *Repository) Create(ctx context.Context, entity *model.Entity) (*model.Entity, error) {
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var changeType string = model.ChangeTypeAdd
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(entity).Error; err != nil {
			return err
		}

		if entity.ID == 0 {
			var existing *model.Entity
			if err := tx.Where("name = ?", entity.Name).First(&existing).Error; err != nil {
				return err
			}
			missingTypes := missing(existing.Type, entity.Type)
			if len(missingTypes) != 0 {
				for _, t := range missingTypes {
					existing.Type = append(existing.Type, t)
				}
				tx.Model(entity).Where("id = ?", existing.ID).Update("type", existing.Type)
			}
			entity = existing
			changeType = model.ChangeTypeUpdate
		}

		entityData, err := json.Marshal(entity)
		if err != nil {
			return err
		}

		if err := tx.Create(&model.Change{
			ObjectID:    entity.ID,
			ObjectType:  "entity",
			Type:        changeType,
			CreatedAt:   entity.CreatedAt,
			CreatedByID: entity.CreatedByID,
			Data:        entityData,
		}).Error; err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	// TODO: add this after we add worker support
	// try {
	// 	await pushJob("GenerateEntityDetails", { entityId: entity.id });
	//   } catch (err) {
	// 	logError(err, {
	// 	  entity: {
	// 		id: entity.id,
	// 	  },
	// 	});
	//   }

	return entity, nil
}

func (r *Repository) ReadById(ctx context.Context, id uint64) (*model.Entity, error) {
	var entity *model.Entity
	if err := r.db.Where("id = ?", id).First(&entity).Error; err != nil {
		return nil, err
	}

	return entity, nil
}

func (r *Repository) Update(ctx context.Context, entity *model.Entity, currentUser *model.User) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		entityData, err := json.Marshal(entity)
		if err != nil {
			return err
		}

		if err := tx.Model(&model.Entity{}).Where("id = ?", entity.ID).Updates(entity).Error; err != nil {
			return err
		}

		if err := tx.Create(&model.Change{
			ObjectID:    entity.ID,
			ObjectType:  "entity",
			Type:        model.ChangeTypeUpdate,
			CreatedAt:   time.Now(),
			CreatedByID: currentUser.ID,
			Data:        entityData,
		}).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *Repository) Delete(ctx context.Context, id uint64, currentUser *model.User) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		entity, err := r.ReadById(ctx, id)
		if err != nil {
			return err
		}

		entityData, err := json.Marshal(entity)
		if err != nil {
			return err
		}

		if err := tx.Where("id = ?", entity.ID).Delete(&model.Entity{}).Error; err != nil {
			return err
		}

		if err := tx.Create(&model.Change{
			ObjectID:    entity.ID,
			ObjectType:  "entity",
			Type:        model.ChangeTypeDelete,
			CreatedAt:   time.Now(),
			CreatedByID: currentUser.ID,
			Data:        entityData,
		}).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *Repository) MergeInto(ctx context.Context, id uint64, siblingIds []uint64, currentUser *model.User) error {
	primary, err := r.ReadById(ctx, id)
	if err != nil {
		return err
	}

	var siblings model.Entities
	if err := r.db.Find(&siblings, siblingIds).Error; err != nil {
		return err
	}
	if len(siblings) != len(siblingIds) {
		return errors.New("one or more entities were not found")
	}

	var totalBottles, totalTastings uint

	for _, e := range siblings {
		totalBottles += e.TotalBottles
		totalTastings += e.TotalTastings
	}

	// TODO: this doesnt handle duplicate bottles
	err = r.db.Transaction(func(tx *gorm.DB) error {
		tx.Model(&model.Bottle{}).Where("brand_id IN ?", siblingIds).Update("brand_id", primary.ID)
		tx.Model(&model.Bottle{}).Where("bottler_id IN ?", siblingIds).Update("bottler_id", primary.ID)
		tx.Model(&model.BottleDistiller{}).Where("distiller_id IN ?", siblingIds).Update("distiller_id", primary.ID)

		for _, id := range siblingIds {
			tx.Create(&model.EntityTombstone{
				EntityID:    id,
				NewEntityID: primary.ID,
			})
		}

		tx.Model(&model.Entity{}).Where("entity_id = ?", primary.ID).Updates(map[string]interface{}{
			"total_bottles":  gorm.Expr("total_bottles + ?", totalBottles),
			"total_tastings": gorm.Expr("total_tastings + ?", totalTastings),
		})
		primary.TotalBottles += totalBottles
		primary.TotalTastings += totalTastings

		for _, e := range siblings {
			eData, err := json.Marshal(primary)
			if err != nil {
				return err
			}
			if err := tx.Create(&model.Change{
				ObjectID:    e.ID,
				ObjectType:  "entity",
				Type:        model.ChangeTypeDelete,
				CreatedAt:   time.Now(),
				CreatedByID: currentUser.ID,
				Data:        eData,
			}).Error; err != nil {
				return err
			}
		}

		primaryData, err := json.Marshal(primary)
		if err != nil {
			return err
		}
		if err := tx.Create(&model.Change{
			ObjectID:    primary.ID,
			ObjectType:  "entity",
			Type:        model.ChangeTypeUpdate,
			CreatedAt:   time.Now(),
			CreatedByID: currentUser.ID,
			Data:        primaryData,
		}).Error; err != nil {
			return err
		}

		tx.Where("id IN ?", siblingIds).Delete(&model.Entity{})

		return nil
	})

	if err != nil {
		return err
	}
	// TODO: add this after we add worker support
	// try {
	// 	await pushJob("GenerateEntityDetails", { entityId: entity.id });
	//   } catch (err) {
	// 	logError(err, {
	// 	  entity: {
	// 		id: entity.id,
	// 	  },
	// 	});
	//   }

	return nil
}
