package entity

import "peated/database/column/spatial"

type EntityInput struct {
	Name            string   `json:"name" binding:"required"`
	ShortName       string   `json:"shortName"`
	Type            []string `json:"type" binding:"required,dive,oneof=bottler brand distiller"`
	Country         string
	Region          string
	YearEstablished uint           `json:"yearEstablished" binding:"numeric,gte=0,lte=2050"`
	Website         string         `json:"website" binding:"omitempty,url"`
	Location        *spatial.Point `json:"location"`
}

type EntityUpdateInput struct {
	Name            string   `json:"name"`
	ShortName       string   `json:"shortName"`
	Type            []string `json:"type" binding:"dive,oneof=bottler brand distiller"`
	Country         string
	Region          string
	YearEstablished uint           `json:"yearEstablished" binding:"numeric,gte=0,lte=2050"`
	Website         string         `json:"website" binding:"omitempty,url"`
	Location        *spatial.Point `json:"location"`
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
	Root      string `json:"root" binding:"required,numeric"`
	Other     string `json:"other" binding:"required,numeric"`
	Direction string `json:"direction" binding:"required,default=mergeInto,oneof=mergeInto mergeFrom"`
}
