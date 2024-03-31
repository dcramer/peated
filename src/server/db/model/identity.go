package model

type IdentityProvider string

const (
	IdentityProviderGoogle IdentityProvider = "google"
)

type Identity struct {
	ID         uint64           `gorm:"primaryKey" json:"id"`
	Provider   IdentityProvider `json:"provider"`
	ExternalID string           `json:"external_id"`
	UserID     uint64           `json:"user_id"`

	User User
}

func (Identity) TableName() string {
	return "identity"
}

type Identities []*Identity
