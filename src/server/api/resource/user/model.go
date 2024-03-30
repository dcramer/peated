package user

import (
	"peated/model"
	"strings"
	"time"
)

type UserInput struct {
	Email string `json:"title" form:"required,max=255"`
}

func (f *UserInput) ToModel() *model.User {
	username := strings.Split(f.Email, "@")[0]

	return &model.User{
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
