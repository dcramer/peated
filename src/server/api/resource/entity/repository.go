package entity

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

func (r *Repository) List(ctx context.Context, input *ListInput) (model.Entities, error) {
	clauses := make([]clause.Expression, 0)

	var entities model.Entities

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

	query := r.db.Clauses(clauses...).Offset(input.Cursor).Limit(input.Limit).Order(orderBy).Find(&entities)
	if err := query.Error; err != nil {
		return entities, err
	}

	return entities, nil
}

func (r *Repository) Create(ctx context.Context, entity *model.Entity) (*model.Entity, error) {
	if err := r.db.Create(entity).Error; err != nil {
		return nil, err
	}

	return entity, nil
}

func (r *Repository) ReadById(ctx context.Context, id uint64) (*model.Entity, error) {
	var entity *model.Entity
	if err := r.db.Where("id = ?", id).First(&entity).Error; err != nil {
		return nil, err
	}

	return entity, nil
}

func (r *Repository) Delete(id uint64) (int64, error) {
	result := r.db.Where("id = ?", id).Delete(&model.Entity{})

	return result.RowsAffected, result.Error
}
