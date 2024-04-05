package model

import (
	"time"
)

type Collection struct {
	ID           uint64 `gorm:"primaryKey" json:"id"`
	Name         string `json:"name"`
	TotalBottles uint64 `json:"total_bottles"`

	CreatedByID uint64    `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	CreatedBy User
}

func (Collection) TableName() string {
	return "collection"
}

type Collections []*Collection
