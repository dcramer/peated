package model

import (
	"peated/database/column/spatial"
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
	Name      string         `json:"name" gorm:"not null"`
	ShortName *string        `json:"short_name"`
	Country   *string        `json:"country"`
	Region    *string        `json:"region"`
	Type      pq.StringArray `json:"type" gorm:"type:string[];default:[];not null"`
	Location  *spatial.Point `json:"location" gorm:"type:geometry(point, 4326)"`

	Description     *string `json:"description"`
	YearEstablished *uint64 `json:"year_established"`
	Website         *string `json:"website"`

	TotalBottles  uint64 `json:"total_bottles" gorm:"default:0;not null"`
	TotalTastings uint64 `json:"total_tastings" gorm:"default:0;not null"`

	CreatedAt   time.Time `json:"created_at" gorm:"not null"`
	CreatedByID uint64    `json:"created_by_id" gorm:"not null"`

	CreatedBy User
}

func (Entity) TableName() string {
	return "entity"
}

func (e *Entity) GetBottlePrefix() string {
	var namePrefix string
	if e.ShortName != nil {
		namePrefix = *e.ShortName
	} else {
		namePrefix = e.Name
	}
	return namePrefix
}

type Entities []*Entity
