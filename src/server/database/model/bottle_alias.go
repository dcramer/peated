package model

type BottleAlias struct {
	Name     string `json:"name" gorm:"primaryKey"`
	BottleID uint64 `json:"bottle_id"`

	Bottle Bottle
}

func (BottleAlias) TableName() string {
	return "bottle_alias"
}

type BottleAliases []*BottleAlias
