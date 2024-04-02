package user

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

func (r *Repository) List(ctx context.Context, params *ListInput) (model.Users, error) {
	var clauses []clause.Expression
	var users model.Users

	if len(params.Query) != 0 {
		clauses = append(clauses, clause.Or(
			db.ILike{Column: "display_name", Value: "%" + params.Query + "%"},
			db.ILike{Column: "email", Value: params.Query},
		))
	}

	query := r.db.Clauses(clauses...).Offset(params.Cursor).Limit(params.Limit).Order("display_name ASC").Find(&users)
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
	var user *model.User
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadByEmail(ctx context.Context, email string) (*model.User, error) {
	var user *model.User
	if err := r.db.Where("email = ?", email).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) ReadByUsername(ctx context.Context, username string) (*model.User, error) {
	var user *model.User
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
	var existingUser *model.User
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
