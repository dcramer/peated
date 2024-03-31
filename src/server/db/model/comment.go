package model

import (
	"time"
)

type Comment struct {
	ID        uint64 `gorm:"primaryKey" json:"id"`
	TastingID uint64 `json:"tasting_id"`
	Comment   string `json:"comment"`

	CreatedByID uint64    `json:"created_by_id"`
	CreatedAt   time.Time `json:"created_at"`

	Tasting   Tasting
	CreatedBy User
}

func (Comment) TableName() string {
	return "comments"
}

type Comments []*Comment
