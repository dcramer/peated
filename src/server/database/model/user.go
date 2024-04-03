package model

import (
	"peated/database"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           uint64  `gorm:"primaryKey" json:"id"`
	Username     string  `json:"username" gorm:"not null"`
	Email        string  `json:"email" gorm:"not null"`
	PasswordHash *string `json:"password_hash"`
	DisplayName  *string `json:"display_name"`
	PictureUrl   *string `json:"picture_url"`

	Private bool `json:"private" gorm:"default:false;not null"`
	Active  bool `json:"active" gorm:"default:true;not null"`
	Admin   bool `json:"admin" gorm:"default:false;not null"`
	Mod     bool `json:"mod" gorm:"default:false;not null"`

	CreatedAt time.Time `json:"created_at"`

	Identities []Identity
}

func (u *User) SetPassword(password []byte) error {
	hash, err := bcrypt.GenerateFromPassword(password, bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = database.Ptr(string(hash))
	return nil
}

func (User) TableName() string {
	return "user"
}

type Users []*User
