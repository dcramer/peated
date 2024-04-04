package auth

import (
	"context"
	"peated/api/resource/user"
	"peated/database/model"
)

type AuthResponse struct {
	User        *user.User `json:"user"`
	AccessToken *string    `json:"accessToken,omitempty"`
}

type GoogleClaims struct {
	Email     string `json:"email"`
	GivenName string `json:"given_name"`
	Sub       string `json:"sub"`
}

func NewAuthResponse(ctx context.Context, u *model.User, t *string) *AuthResponse {
	return &AuthResponse{
		User:        user.NewUserResponse(ctx, u).User,
		AccessToken: t,
	}
}
