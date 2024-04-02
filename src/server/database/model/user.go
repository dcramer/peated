package model

import (
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           uint64 `gorm:"primaryKey" json:"id"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
	DisplayName  string `json:"display_name"`
	PictureUrl   string `json:"picture_url"`

	Private bool `json:"private"`
	Active  bool `json:"active" default:"true"`
	Admin   bool `json:"admin"`
	Mod     bool `json:"mod"`

	CreatedAt time.Time `json:"created_at"`

	Identities []Identity
}

func (u *User) SetPassword(password []byte) error {
	hash, err := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

func (User) TableName() string {
	return "user"
}

type Users []*User
