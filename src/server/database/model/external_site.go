package model

import (
	"time"
)

type ExternalSiteType string

const (
	ExternalSiteTypeAstorWines     ExternalSiteType = "astorwines"
	ExternalSiteTypeHealthySpirts  ExternalSiteType = "healthyspirits"
	ExternalSiteTypeSMWS           ExternalSiteType = "smws"
	ExternalSiteTypeSMWSA          ExternalSiteType = "smwsa"
	ExternalSiteTypeTotalWine      ExternalSiteType = "totalwine"
	ExternalSiteTypeWoodenCork     ExternalSiteType = "woodencork"
	ExternalSiteTypeWhiskyAdvocate ExternalSiteType = "whiskyadvocate"
)

type ExternalSite struct {
	ID        uint64           `gorm:"primaryKey" json:"id"`
	Type      ExternalSiteType `json:"type"`
	Name      string           `json:"name"`
	LastRunAt time.Time        `json:"last_run_at"`
	NextRunAt time.Time        `json:"next_run_at"`
	RunEvery  uint             `json:"run_every"`

	CreatedAt time.Time `json:"created_at"`
}

func (ExternalSite) TableName() string {
	return "external_site"
}

type ExternalSites []*ExternalSite
