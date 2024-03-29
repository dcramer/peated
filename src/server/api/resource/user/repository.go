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
	query  string `default:""`
	cursor int    `default:"0"`
	limit  int    `default:"100"`
}

func (r *Repository) List(ctx context.Context, params *ListParams) (model.Users, error) {
	// const where: (SQL<unknown> | undefined)[] = [];
	// if (query) {
	//   where.push(
	//     or(ilike(users.displayName, `%${query}%`), ilike(users.email, query)),
	//   );
	// } else if (!ctx.user.admin) {
	//   return {
	//     results: [],
	//     rel: {
	//       nextCursor: null,
	//       prevCursor: null,
	//     },
	//   };
	// }

	user, _ := ctxUtil.CurrentUser(ctx)

	clauses := make([]clause.Expression, 0)

	users := make([]*model.User, 0)

	if len(params.query) != 0 {
		// TODO: should be ILIKE
		clauses = append(clauses, clause.Or(
			clause.Like{Column: "display_name", Value: "%" + params.query + "%"},
			clause.Like{Column: "email", Value: params.query},
		))
	} else if user.Admin {
		return users, nil
	}

	query := r.db.Clauses(clauses...).Offset(params.cursor).Limit(params.limit).Order("display_name asc").Find(&users)
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

func (r *Repository) Read(id string) (*model.User, error) {
	user := &model.User{}
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
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
