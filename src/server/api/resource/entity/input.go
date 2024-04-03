package entity

import (
	"peated/api/resource/common/schema"
	"peated/database/column/spatial"
)

type EntityInput struct {
	Name            string                         `json:"name" binding:"required"`
	ShortName       schema.Optional[string]        `json:"shortName" binding:"omitempty"`
	Type            []string                       `json:"type" binding:"required,dive,oneof=bottler brand distiller"`
	Country         schema.Optional[string]        `binding:"omitempty"`
	Region          schema.Optional[string]        `binding:"omitempty"`
	YearEstablished schema.Optional[uint]          `json:"yearEstablished" binding:"omitempty,numeric,gte=0,lte=2050"`
	Website         schema.Optional[string]        `json:"website" binding:"omitempty,url"`
	Location        schema.Optional[spatial.Point] `json:"location" binding:"omitempty"`
}

type EntityUpdateInput struct {
	Name            schema.Optional[string]        `json:"name" binding:"omitempty"`
	ShortName       schema.Optional[string]        `json:"shortName" binding:"omitempty"`
	Type            schema.Optional[[]string]      `json:"type" binding:"omitempty,dive,oneof=bottler brand distiller"`
	Country         schema.Optional[string]        `binding:"omitempty"`
	Region          schema.Optional[string]        `binding:"omitempty"`
	YearEstablished schema.Optional[uint]          `json:"yearEstablished" binding:"omitempty,numeric,gte=0,lte=2050"`
	Website         schema.Optional[string]        `json:"website" binding:"omitempty,url"`
	Location        schema.Optional[spatial.Point] `json:"location" binding:"omitempty"`
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
