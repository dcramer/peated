package user

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"peated/model"
	ctxUtil "peated/util/ctx"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{
		db: db,
	}
}

type ListParams struct {
	Query  string `default:""`
	Cursor int    `default:"0"`
	Limit  int    `default:"100"`
}

func (r *Repository) List(ctx context.Context, params *ListParams) (model.Users, error) {
	user, _ := ctxUtil.CurrentUser(ctx)

	clauses := make([]clause.Expression, 0)

	users := make([]*model.User, 0)

	if len(params.Query) != 0 {
		// TODO: should be ILIKE
		clauses = append(clauses, clause.Or(
			clause.Like{Column: "display_name", Value: "%" + params.Query + "%"},
			clause.Like{Column: "email", Value: params.Query},
		))
	} else if user.Admin {
		return users, nil
	}

	query := r.db.Clauses(clauses...).Offset(params.Cursor).Limit(params.Limit).Order("display_name asc").Find(&users)
	if err := query.Error; err != nil {
		return users, err
	}

	return users, nil
}

func (r *Repository) Create(user *model.User) (*model.User, error) {
	if err := r.db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadById(id string) (*model.User, error) {
	user := &model.User{}
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadByEmail(email string) (*model.User, error) {
	user := &model.User{}
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadByUsername(username string) (*model.User, error) {
	user := &model.User{}
	if err := r.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) Update(user *model.User) (int64, error) {
	result := r.db.Model(&model.User{}).
		// Select("Username", "Email", "DisplayName", "PictureUrl").
		Where("id = ?", user.ID).
		Updates(user)

	return result.RowsAffected, result.Error
}

func (r *Repository) Delete(id string) (int64, error) {
	result := r.db.Where("id = ?", id).Delete(&model.User{})

	return result.RowsAffected, result.Error
}
