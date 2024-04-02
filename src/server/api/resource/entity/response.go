package entity

import (
	"context"
	"peated/database/model"
	"strconv"
)

type Entity struct {
	ID     string                 `json:"id"`
	Type   []string               `json:"type"`
	Name   string                 `json:"name"`
	Config map[string]interface{} `json:"config"`
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
			ID:   strconv.FormatUint(b.ID, 10),
			Type: b.Type,
			Name: b.Name,
			// Config: b.Config.MarshalJSON(),
		},
	}
}
