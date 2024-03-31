package model

import (
	"peated/db/column"

	"gorm.io/gorm"
)

type BadgeType string

const (
	BadgeTypeBottle   BadgeType = "bottle"
	BadgeTypeRegion   BadgeType = "region"
	BadgeTypeCategory BadgeType = "category"
)

type Badge struct {
	gorm.Model
	ID     uint64       `gorm:"primaryKey" json:"id"`
	Name   string       `json:"name"`
	Type   BadgeType    `json:"type"`
	Config column.JSONB `json:"config" gorm:"type:jsonb"`
}

func (Badge) TableName() string {
	return "badges"
}

type Badges []*Badge
