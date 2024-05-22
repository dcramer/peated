package model

type BottleTag struct {
	BottleID uint64 `json:"bottle_id" gorm:"primaryKey;autoincrement:false;not null"`
	Tag      string `json:"tag" gorm:"primaryKey;autoincrement:false;not null"`
	Count    uint64 `json:"count"`

	Bottle Bottle
}

func (BottleTag) TableName() string {
	return "bottle_tag"
}

type BottleTags []*BottleTag
