package model

import (
	"time"

	"gorm.io/gorm"
)

type Collection struct {
	gorm.Model
	ID           uint64 `gorm:"primaryKey" json:"id"`
	Name         string `json:"name"`
	TotalBottles uint   `json:"total_bottles"`

	CreatedByID uint64    `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	CreatedBy User
}

func (Collection) TableName() string {
	return "collection"
}

type Collections []*Collection
