package badge

import (
	"peated/database/model"
)

type BadgeInput struct {
	Type model.BadgeType `json:"type" binding:"required"`
	Name string          `json:"name" binding:"required"`
	// TODO:
	// Config string `json:"config"`
}

func (f *BadgeInput) ToModel() *model.Badge {
	return &model.Badge{
		Type: f.Type,
		Name: f.Name,
	}
}

type ListInput struct {
	Sort   string `form:"sort,default=name"`
	Query  string `form:"query"`
	Cursor int    `form:"cursor,default=0" binding:"numeric,gte=0"`
	Limit  int    `form:"limit,default=100" binding:"numeric,lte=100"`
}
