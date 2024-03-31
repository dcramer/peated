package user

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"peated/auth"
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

type ListParams struct {
	Query  string `default:""`
	Cursor int    `default:"0"`
	Limit  int    `default:"100"`
}

func (r *Repository) List(ctx context.Context, params *ListParams) (model.Users, error) {
	user, _ := auth.CurrentUser(ctx)

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

func (r *Repository) Create(ctx context.Context, user *model.User) (*model.User, error) {
	if err := r.db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadById(ctx context.Context, id uint64) (*model.User, error) {
	user := &model.User{}
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadByEmail(ctx context.Context, email string) (*model.User, error) {
	user := &model.User{}
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadByUsername(ctx context.Context, username string) (*model.User, error) {
	user := &model.User{}
	if err := r.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) Update(ctx context.Context, user *model.User) (int64, error) {
	result := r.db.Model(&model.User{}).
		// Select("Username", "Email", "DisplayName", "PictureUrl").
		Where("id = ?", user.ID).
		Updates(user)

	return result.RowsAffected, result.Error
}

func (r *Repository) UpsertWithIdentity(ctx context.Context, user *model.User, identity *model.Identity) (*model.User, error) {
	existingUser := &model.User{}
	if err := r.db.Where("identity.provider = ? and identity.external_id = ?", identity.Provider, identity.ExternalID).Joins("inner join identity on identity.user_id = user.id").First(&existingUser).Error; err == nil {
		return existingUser, nil
	}

	if err := r.db.Where("user.email = ?", user.Email).First(&existingUser).Error; err != nil {
		// user not found, create it
		r.db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(user).Error; err != nil {
				return err
			}
			identity.UserID = user.ID
			if err := tx.Create(identity).Error; err != nil {
				return err
			}
			return nil
		})

		return user, nil
	}

	// update existing user with identity
	// TODO: handle race condition
	identity.UserID = user.ID
	if err := r.db.Create(identity).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) Delete(id string) (int64, error) {
	result := r.db.Where("id = ?", id).Delete(&model.User{})

	return result.RowsAffected, result.Error
}
