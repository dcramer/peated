package model

import (
	"time"

	"github.com/lib/pq"
)

const (
	EntityTypeBottler   string = "bottler"
	EntityTypeBrand     string = "brand"
	EntityTypeDistiller string = "distiller"
)

type Entity struct {
	ID        uint64         `gorm:"primaryKey" json:"id"`
	Name      string         `json:"name"`
	ShortName string         `json:"short_name"`
	Country   string         `json:"country"`
	Region    string         `json:"region"`
	Type      pq.StringArray `json:"type" gorm:"type:string[]"`

	Description     string `json:"description"`
	YearEstablished int    `json:"year_established"`
	Website         string `json:"website"`

	TotalBottles  uint `json:"total_bottles"`
	TotalTastings uint `json:"total_tastings"`

	CreatedAt   time.Time `json:"created_at"`
	CreatedByID uint64    `json:"created_by_id"`

	CreatedBy User
}

func (Entity) TableName() string {
	return "entity"
}

type Entities []*Entity
