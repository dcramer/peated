package model

import (
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type StorePriceHistory struct {
	gorm.Model
	ID      uint64         `gorm:"primaryKey" json:"id"`
	PriceID uint64         `json:"price_id"`
	Price   uint           `json:"price"`
	Volume  uint           `json:"volume"`
	Date    datatypes.Date `json:"date"`

	StorePrice StorePrice `gorm:"references:price_id"`
}

func (StorePriceHistory) TableName() string {
	return "store_price_history"
}

type StorePriceHistories []*StorePriceHistory
