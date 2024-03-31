package model

import (
	"time"

	"gorm.io/gorm"
)

type ServingStyle string

const (
	ServingStyleNeat   ServingStyle = "neat"
	ServingStyleRocks  ServingStyle = "rocks"
	ServingStyleSplash ServingStyle = "splash"
)

type Tasting struct {
	gorm.Model
	ID uint64 `gorm:"primaryKey" json:"id"`

	BottleID     uint64       `json:"bottle_id"`
	Tags         []string     `json:"tags"`
	Rating       float32      `json:"rating"`
	ImageUrl     string       `json:"image_url"`
	Notes        string       `json:"notes"`
	ServingStyle ServingStyle `json:"serving_style"`
	Friends      []uint64     `json:"friends"`
	FlightID     uint64       `json:"flight_id"`

	Comments int `json:"comments"`
	Toasts   int `json:"toasts"`

	CreatedAt   time.Time `json:"created_at"`
	CreatedByID uint64    `json:"created_by_id"`

	Bottle    Bottle
	Flight    Flight
	CreatedBy User
}

func (Tasting) TableName() string {
	return "tasting"
}

type Tastings []*Tasting
