package bottle

import (
	"context"
	"peated/database/model"
	"strconv"
)

type BottleInput struct {
	Name string `json:"name" binding:"required"`
}

func (f *BottleInput) ToModel() *model.Bottle {
	return &model.Bottle{
		Name: f.Name,
	}
}

type ListInput struct {
	Sort   string `form:"sort,default=name"`
	Query  string `form:"query"`
	Cursor int    `form:"cursor,default=0" binding:"numeric,gte=0"`
	Limit  int    `form:"limit,default=100" binding:"numeric,lte=100"`
}

type BottleDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type BottleExtraData struct {
	TotalPeople int64
}

func DTOFromBottles(ctx context.Context, us model.Bottles) []*BottleDTO {
	dtos := make([]*BottleDTO, len(us))
	for i, v := range us {
		dtos[i] = DTOFromBottle(ctx, v)
	}

	return dtos
}

func DTOFromBottle(ctx context.Context, b *model.Bottle) *BottleDTO {
	return &BottleDTO{
		ID:   strconv.FormatUint(b.ID, 10),
		Name: b.Name,
	}
}

type BottleAliasDTO struct {
	Name string `json:"name"`
}

func DTOFromBottleAliases(ctx context.Context, us model.BottleAliases) []*BottleAliasDTO {
	dtos := make([]*BottleAliasDTO, len(us))
	for i, v := range us {
		dtos[i] = DTOFromBottleAlias(ctx, v)
	}

	return dtos
}

func DTOFromBottleAlias(ctx context.Context, b *model.BottleAlias) *BottleAliasDTO {
	return &BottleAliasDTO{
		Name: b.Name,
	}
}
