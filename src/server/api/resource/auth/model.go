package auth

import (
	"peated/api/resource/user"
)

type EmailPasswordInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type CodeInput struct {
	Code string `json:"code"`
}

type AuthDTO struct {
	User        *user.UserDTO `json:"user"`
	AccessToken string        `json:"accessToken"`
}

type GoogleClaims struct {
	Email     string `json:"email"`
	GivenName string `json:"given_name"`
	Sub       string `json:"sub"`
}
