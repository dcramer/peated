package model

import (
	"time"

	"gorm.io/gorm"
)

type Toast struct {
	gorm.Model
	ID        uint64 `gorm:"primaryKey" json:"id"`
	TastingID uint64 `json:"tasting_id"`

	CreatedByID uint64    `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	Tasting   Tasting
	CreatedBy User
}

func (Toast) TableName() string {
	return "toasts"
}

type Toasts []*Toast
