package bottle

import (
	"context"

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

func (r *Repository) Create(ctx context.Context, bottle *model.Bottle) (*model.Bottle, error) {
	if err := r.db.Create(bottle).Error; err != nil {
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

func (r *Repository) Delete(id uint64) (int64, error) {
	result := r.db.Where("id = ?", id).Delete(&model.Bottle{})

	return result.RowsAffected, result.Error
}

func (r *Repository) ListAliases(ctx context.Context, bottleID uint64) (model.BottleAliases, error) {
	var aliases model.BottleAliases

	query := r.db.Where("id = ?", bottleID).Find(&aliases)
	if err := query.Error; err != nil {
		return aliases, err
	}

	return aliases, nil
}
