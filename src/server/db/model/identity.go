package model

import "gorm.io/gorm"

type IdentityProvider string

const (
	Google IdentityProvider = "google"
)

type Identity struct {
	gorm.Model
	ID         uint64 `gorm:"primaryKey" json:"id"`
	Provider   string `json:"provider"`
	ExternalID string `json:"external_id"`
	UserID     uint64 `json:"user_id"`
}

func (Identity) TableName() string {
	return "identity"
}

type Identities []*Identity
