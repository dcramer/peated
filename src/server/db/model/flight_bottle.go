package model

import (
	"gorm.io/gorm"
)

type FlightBottle struct {
	gorm.Model
	FlightID uint64 `gorm:"primaryKey;autoincrement:false" json:"flight_id"`
	BottleID uint64 `gorm:"primaryKey;autoincrement:false" json:"bottle_id"`

	Flight Flight
	Bottle Bottle
}

func (FlightBottle) TableName() string {
	return "flight_bottle"
}

type FlightBottles []*FlightBottle
