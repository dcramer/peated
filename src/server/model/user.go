package model

import (
	"strconv"
	"time"

	"gorm.io/gorm"
)

type User struct {
	gorm.Model
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

func (User) TableName() string {
	return "user"
}

type Users []*User

type UserDTO struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	PictureUrl  string `json:"picture_url"`
}

func (us Users) ToDto() []*UserDTO {
	dtos := make([]*UserDTO, len(us))
	for i, v := range us {
		dtos[i] = v.ToDto()
	}

	return dtos
}

func (u *User) ToDto() *UserDTO {
	return &UserDTO{
		ID:          strconv.FormatUint(u.ID, 10),
		Username:    u.Username,
		DisplayName: u.DisplayName,
		PictureUrl:  u.PictureUrl,
	}
}
