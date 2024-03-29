package user

import (
	"strings"
	"time"

	"github.com/nrednav/cuid2"
)

type User struct {
	ID           string `gorm:"primaryKey" json:"id"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	PasswordHash string `json:"password_hash"`
	DisplayName  string `json:"display_name"`
	PictureUrl   string `json:"picture_url"`

	Private bool `json:"private"`
	Active  bool `json:"active"`
	Admin   bool `json:"admin"`
	Mod     bool `json:"mod"`

	CreatedAt time.Time `json:"created_at"`
}

type Users []*User

type UserDTO struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	PictureUrl  string `json:"picture_url"`
}

type UserInput struct {
	Email string `json:"title" form:"required,max=255"`
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
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: u.DisplayName,
		PictureUrl:  u.PictureUrl,
	}
}

func (f *UserInput) ToModel() *User {
	username := strings.Split(f.Email, "@")[0]

	return &User{
		ID:          cuid2.Generate(),
		Email:       f.Email,
		Username:    username,
		DisplayName: username,

		// PictureUrl:   "",
		// PasswordHash: "",

		Private: false,
		Active:  true,
		Admin:   false,
		Mod:     false,

		CreatedAt: time.Now(),
	}
}
