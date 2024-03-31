package model

import (
	"time"

	"gorm.io/gorm"
)

type Review struct {
	gorm.Model
	ID             uint64 `gorm:"primaryKey" json:"id"`
	ExternalSiteID uint64 `json:"external_site_id"`
	Name           string `json:"name"`
	BottleID       uint64 `json:"bottle_id"`
	Rating         uint   `json:"rating"`
	Issue          string `json:"issue"`
	Url            string `json:"url"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	ExternalSite ExternalSite
	Bottle       Bottle
}

func (Review) TableName() string {
	return "review"
}

type Reviews []*Review
