package model

import (
	"time"
)

type StorePrice struct {
	ID             uint64 `gorm:"primaryKey" json:"id"`
	ExternalSiteID uint64 `json:"external_site_id"`
	Name           string `json:"name"`
	BottleID       uint64 `json:"bottle_id"`
	Price          uint64 `json:"price"`
	Volume         uint64 `json:"volume"`
	Url            string `json:"url"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	ExternalSite ExternalSite
	Bottle       Bottle
}

func (StorePrice) TableName() string {
	return "store_price"
}

type StorePrices []*StorePrice
