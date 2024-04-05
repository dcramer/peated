package bottle

import (
	"context"
	"encoding/json"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"peated/database"
	"peated/database/model"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) List(ctx context.Context, input *ListInput) (model.Bottles, error) {
	clauses := make([]clause.Expression, 0)

	var bottles model.Bottles

	if len(input.Query) != 0 {
		clauses = append(clauses, clause.Or(
			database.ILike{Column: "name", Value: "%" + input.Query + "%"},
		))
	}

	var orderBy string
	switch input.Sort {
	case "name":
	default:
		orderBy = "name ASC"
	}

	query := r.db.Clauses(clauses...).Offset(input.Cursor).Limit(input.Limit).Order(orderBy).Find(&bottles)
	if err := query.Error; err != nil {
		return bottles, err
	}

	return bottles, nil
}

func (r *Repository) Create(ctx context.Context, bottle *model.Bottle, distillers *[]uint64) (*model.Bottle, error) {
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(bottle).Error; err != nil {
			return err
		}

		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{"bottle_id"}),
		}).Create(&model.BottleAlias{
			BottleID: bottle.ID,
			Name:     bottle.FullName,
		}).Error; err != nil {
			return err
		}

		if distillers != nil && len(*distillers) > 0 {
			for _, d := range *distillers {
				tx.Create(&model.BottleDistiller{
					BottleID:    bottle.ID,
					DistillerID: d,
				})
			}
		}

		bottleData, err := json.Marshal(bottle)
		if err != nil {
			return err
		}
		// TODO: this needs to happen somehow
		// bottleData["distillerIds"] = distillers

		if err := tx.Create(&model.Change{
			ObjectID:    bottle.ID,
			ObjectType:  "bottle",
			Type:        model.ChangeTypeAdd,
			DisplayName: &bottle.Name,
			CreatedAt:   bottle.CreatedAt,
			CreatedByID: bottle.CreatedByID,
			Data:        bottleData,
		}).Error; err != nil {
			return err
		}

		allEntityIDs := []uint64{
			bottle.BrandID,
		}
		if bottle.BottlerID != nil {
			allEntityIDs = append(allEntityIDs, *bottle.BottlerID)
		}
		if distillers != nil {
			allEntityIDs = append(allEntityIDs, *distillers...)
		}

		if err = tx.Exec(`UPDATE entity SET total_bottles = SELECT COUNT(*) from bottle WHERE bottle.brand_id = entity.id OR bottle.brand_id = entity.id OR EXISTS(
			SELECT FROM bottle_distiller WHERE bottle_distiller.bottle_id = bottle.id AND bottle_distiller.entity_id = entity.id
		) AND entity.id IN ?`, allEntityIDs).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return bottle, nil
}

func (r *Repository) ReadById(ctx context.Context, id uint64) (*model.Bottle, error) {
	var bottle *model.Bottle
	if err := r.db.Where("id = ?", id).First(&bottle).Error; err != nil {
		return nil, err
	}

	return bottle, nil
}

func (r *Repository) ReadByTombstone(ctx context.Context, id uint64) (*model.Bottle, error) {
	var bottle *model.Bottle
	if err := r.db.Joins("JOIN bottle_tombstone ON bottle_tombstone.new_bottle_id = bottle.id").
		Where("bottle_tombstone.bottle_id = ?", id).
		First(&bottle).Error; err != nil {
		return nil, err
	}

	return bottle, nil
}

// TODO:
func (r *Repository) Delete(ctx context.Context, id uint64, currentUser *model.User) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		bottle, err := r.ReadById(ctx, id)
		if err != nil {
			return err
		}

		changeData, err := json.Marshal(bottle)
		if err != nil {
			return err
		}

		if err := tx.Delete(bottle).Error; err != nil {
			return err
		}

		if err := tx.Create(&model.Change{
			ObjectID:    bottle.ID,
			ObjectType:  "bottle",
			Type:        model.ChangeTypeDelete,
			DisplayName: &bottle.FullName,
			CreatedAt:   time.Now(),
			CreatedByID: currentUser.ID,
			Data:        changeData,
		}).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *Repository) ListAliases(ctx context.Context, bottleID uint64) (model.BottleAliases, error) {
	var aliases model.BottleAliases

	query := r.db.Where("id = ?", bottleID).Find(&aliases)
	if err := query.Error; err != nil {
		return aliases, err
	}

	return aliases, nil
}
