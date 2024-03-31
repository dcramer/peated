package model

import (
	"time"

	"gorm.io/gorm"
)

type EntityType string

const (
	EntityTypeBottler   EntityType = "bottler"
	EntityTypeBrand     EntityType = "brand"
	EntityTypeDistiller EntityType = "distiller"
)

type Entity struct {
	gorm.Model
	ID        uint64       `gorm:"primaryKey" json:"id"`
	Name      string       `json:"name"`
	ShortName string       `json:"short_name"`
	Country   string       `json:"country"`
	Region    string       `json:"region"`
	Type      []EntityType `json:"type"`

	Description     string `json:"description"`
	YearEstablished string `json:"year_established"`
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
