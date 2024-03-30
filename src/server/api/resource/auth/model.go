package auth

import "peated/model"

type EmailPasswordInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthDTO struct {
	User        *model.UserDTO `json:"user"`
	AccessToken string         `json:"accessToken"`
}
