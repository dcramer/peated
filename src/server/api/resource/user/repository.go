package user

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	query string
}

func (r *Repository) List(params *ListParams) (Users, error) {
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

	isAdmin := false

	clauses := make([]clause.Expression, 0)

	users := make([]*User, 0)

	if len(params.query) != 0 {
		// TODO: should be ILIKE
		clauses = append(clauses, clause.Or(
			clause.Like{Column: "display_name", Value: "%" + params.query + "%"},
			clause.Like{Column: "email", Value: params.query},
		))
	} else if isAdmin {
		return users, nil
	}

	query := r.db.Find(&users).Clauses(clauses...).Offset(0).Limit(100).Order("display_name asc")
	if err := query.Error; err != nil {
		return users, err
	}

	return users, nil
}

func (r *Repository) Create(user *User) (*User, error) {
	if err := r.db.Create(user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) Read(id string) (*User, error) {
	user := &User{}
	if err := r.db.Where("id = ?", id).First(&user).Error; err != nil {
		return nil, err
	}

	return user, nil
}

func (r *Repository) Update(user *User) (int64, error) {
	result := r.db.Model(&User{}).
		// Select("Username", "Email", "DisplayName", "PictureUrl").
		Where("id = ?", user.ID).
		Updates(user)

	return result.RowsAffected, result.Error
}

func (r *Repository) Delete(id string) (int64, error) {
	result := r.db.Where("id = ?", id).Delete(&User{})

	return result.RowsAffected, result.Error
}
