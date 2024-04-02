package badge

import (
	"context"
	"peated/db/model"
	"strconv"
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
	Sort   string `in:"query=sort;default=name" default:"name"`
	Query  string `in:"query=query"`
	Cursor int    `in:"query=cursor;default=0" default:"0"`
	Limit  int    `in:"query=limit;default=100" default:"100"`
}

type BadgeDTO struct {
	ID   string          `json:"id"`
	Type model.BadgeType `json:"type"`
	Name string          `json:"name"`
	// TODO:
	// Config string `json:"config"`
}

func DTOFromBadges(ctx context.Context, us model.Badges) []*BadgeDTO {
	dtos := make([]*BadgeDTO, len(us))
	for i, v := range us {
		dtos[i] = DTOFromBadge(ctx, v)
	}

	return dtos
}

func DTOFromBadge(ctx context.Context, b *model.Badge) *BadgeDTO {
	return &BadgeDTO{
		ID:   strconv.FormatUint(b.ID, 10),
		Type: b.Type,
		Name: b.Name,
		// TODO:
		// Config: b.Config,
	}
}
