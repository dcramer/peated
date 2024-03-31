package model

import "gorm.io/gorm"

type BottleTag struct {
	gorm.Model
	BottleID uint64 `json:"bottle_id" gorm:"primaryKey;autoincrement:false"`
	Tag      string `json:"tag" gorm:"primaryKey;autoincrement:false"`
	Count    uint   `json:"count"`

	Bottle Bottle
}

func (BottleTag) TableName() string {
	return "bottle_tag"
}

type BottleTags []*BottleTag
