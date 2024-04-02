package model

import (
	"gorm.io/datatypes"
)

type BadgeType string

const (
	BadgeTypeBottle   BadgeType = "bottle"
	BadgeTypeRegion   BadgeType = "region"
	BadgeTypeCategory BadgeType = "category"
)

type Badge struct {
	ID     uint64 `gorm:"primaryKey"`
	Name   string
	Type   BadgeType
	Config datatypes.JSON `json:"config" gorm:"default:{}"`
}

func (Badge) TableName() string {
	return "badges"
}

type Badges []*Badge
