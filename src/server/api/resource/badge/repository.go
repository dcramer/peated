package badge

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"peated/db"
	"peated/db/model"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		db: db,
	}
}

func (r *Repository) List(ctx context.Context, input *ListInput) (model.Badges, error) {
	clauses := make([]clause.Expression, 0)

	var badges model.Badges

	if len(input.Query) != 0 {
		clauses = append(clauses, clause.Or(
			db.ILike{Column: "name", Value: "%" + input.Query + "%"},
		))
	}

	var orderBy string
	switch input.Sort {
	case "name":
	default:
		orderBy = "name ASC"
	}

	query := r.db.Clauses(clauses...).Offset(input.Cursor).Limit(input.Limit).Order(orderBy).Find(&badges)
	if err := query.Error; err != nil {
		return badges, err
	}

	return badges, nil
}

func (r *Repository) Create(ctx context.Context, badge *model.Badge) (*model.Badge, error) {
	if err := r.db.Create(badge).Error; err != nil {
		return nil, err
	}

	return badge, nil
}

func (r *Repository) ReadById(ctx context.Context, id uint64) (*model.Badge, error) {
	var badge *model.Badge
	if err := r.db.Where("id = ?", id).First(&badge).Error; err != nil {
		return nil, err
	}

	return badge, nil
}

func (r *Repository) Delete(id string) (int64, error) {
	result := r.db.Where("id = ?", id).Delete(&model.Badge{})

	return result.RowsAffected, result.Error
}
