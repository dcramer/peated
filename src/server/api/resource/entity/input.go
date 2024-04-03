package entity

import (
	"peated/api/resource/common/nullable"
	"peated/database/column/spatial"
)

type EntityInput struct {
	Name            string                           `json:"name" binding:"required"`
	ShortName       nullable.Nullable[string]        `json:"shortName" binding:"omitempty"`
	Type            []string                         `json:"type" binding:"required,dive,oneof=bottler brand distiller"`
	Country         nullable.Nullable[string]        `binding:"omitempty"`
	Region          nullable.Nullable[string]        `binding:"omitempty"`
	YearEstablished nullable.Nullable[uint]          `json:"yearEstablished" binding:"omitempty,numeric,gte=0,lte=2050"`
	Website         nullable.Nullable[string]        `json:"website" binding:"omitempty,url"`
	Location        nullable.Nullable[spatial.Point] `json:"location" binding:"omitempty"`
}

type EntityUpdateInput struct {
	Name            nullable.Nullable[string]        `json:"name" binding:"omitempty"`
	ShortName       nullable.Nullable[string]        `json:"shortName" binding:"omitempty"`
	Type            nullable.Nullable[[]string]      `json:"type" binding:"omitempty,dive,oneof=bottler brand distiller"`
	Country         nullable.Nullable[string]        `binding:"omitempty"`
	Region          nullable.Nullable[string]        `binding:"omitempty"`
	YearEstablished nullable.Nullable[uint]          `json:"yearEstablished" binding:"omitempty,numeric,gte=0,lte=2050"`
	Website         nullable.Nullable[string]        `json:"website" binding:"omitempty,url"`
	Location        nullable.Nullable[spatial.Point] `json:"location" binding:"omitempty"`
}

type ListInput struct {
	Sort    string `form:"sort,default=-tastings"`
	Query   string `form:"query"`
	Type    string `form:"type"`
	Country string `form:"country"`
	Region  string `form:"region"`
	Cursor  int    `form:"cursor,default=0" binding:"numeric,gte=0"`
	Limit   int    `form:"limit,default=100" binding:"numeric,lte=100"`
}

type EntityMergeInput struct {
	EntityIDs []uint64 `json:"entityIds" binding:"required,dive,numeric"`
}
