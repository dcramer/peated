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

	// location: sql<SerializedPoint>`ST_AsGeoJSON(${entities.location}) as location`,

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
