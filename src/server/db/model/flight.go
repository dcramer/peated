package model

import (
	"time"

	"gorm.io/gorm"
)

type Flight struct {
	gorm.Model
	ID          uint64 `gorm:"primaryKey" json:"id"`
	PublicID    string `json:"public_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Public      bool   `json:"public"`

	CreatedByID uint64    `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	CreatedBy User
}

func (Flight) TableName() string {
	return "flight"
}

type Flights []*Flight
