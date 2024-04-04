package bottle

import (
	"context"
	"peated/database/model"
	"strconv"
)

type Bottle struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type BottleStats struct {
	TotalPeople int64
}

type BottleResponse struct {
	Bottle Bottle       `json:"bottle"`
	Stats  *BottleStats `json:"stats;omitempty"`
}

type BottlesResponse struct {
	Bottles []Bottle `json:"entities"`
}

func NewBottleResponse(ctx context.Context, b *model.Bottle) BottleResponse {
	return BottleResponse{
		Bottle: Bottle{
			ID:   strconv.FormatUint(b.ID, 10),
			Name: b.Name,
		},
	}
}

func NewBottlesResponse(ctx context.Context, us model.Bottles) BottlesResponse {
	items := make([]Bottle, len(us))
	for i, v := range us {
		items[i] = NewBottleResponse(ctx, v).Bottle
	}

	return BottlesResponse{
		Bottles: items,
	}
}

type BottleAlias struct {
	Name string `json:"name"`
}

type BottleAliasResponse struct {
	BottleAlias BottleAlias `json:"bottle_alias"`
}

type BottleAliasesResponse struct {
	BottleAliases []BottleAlias `json:"bottle_aliases"`
}

func NewBottleAliasResponse(ctx context.Context, b *model.BottleAlias) *BottleAliasResponse {
	return &BottleAliasResponse{
		BottleAlias{
			Name: b.Name,
		},
	}
}

func NewBottleAliasesResponse(ctx context.Context, us model.BottleAliases) BottleAliasesResponse {
	items := make([]BottleAlias, len(us))
	for i, v := range us {
		items[i] = NewBottleAliasResponse(ctx, v).BottleAlias
	}

	return BottleAliasesResponse{
		BottleAliases: items,
	}
}
