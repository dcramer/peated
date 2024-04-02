package entity

import (
	"context"
	"peated/database/model"
	"strconv"
)

type Entity struct {
	ID              string   `json:"id"`
	Name            string   `json:"name"`
	ShortName       string   `json:"shortName"`
	Type            []string `json:"type"`
	Description     string
	YearEstablished uint `json:"yearEstablished"`
	Website         string
	Country         string
	Region          string
	Location        [2]float64
	CreatedAt       string `json:"createdAt"`
	TotalTastings   uint   `json:"totalTastings"`
	TotalBottles    uint   `json:"totalBottles"`
}

type EntityResponse struct {
	Entity *Entity `json:"entity"`
}

type EntitiesResponse struct {
	Entities []*Entity `json:"entities"`
}

func NewEntitiesResponse(ctx context.Context, us model.Entities) *EntitiesResponse {
	entities := make([]*Entity, len(us))
	for i, v := range us {
		entities[i] = NewEntityResponse(ctx, v).Entity
	}

	return &EntitiesResponse{
		Entities: entities,
	}
}

func NewEntityResponse(ctx context.Context, b *model.Entity) *EntityResponse {
	return &EntityResponse{
		Entity: &Entity{
			ID:              strconv.FormatUint(b.ID, 10),
			Name:            b.Name,
			ShortName:       b.ShortName,
			Type:            b.Type,
			Description:     b.Description,
			YearEstablished: b.YearEstablished,
			Website:         b.Website,
			Country:         b.Country,
			Region:          b.Region,
			Location:        [2]float64{b.Location.Lat, b.Location.Lng},
			TotalTastings:   b.TotalTastings,
			TotalBottles:    b.TotalBottles,
		},
	}
}
