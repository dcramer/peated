package user

import (
	"context"
	"peated/db/model"
	"strconv"
)

type UserInput struct {
	Username    string `json:"username" form:"required,max=255"`
	DisplayName string `json:"displayName" form:"max=255"`
	Private     bool   `json:"private"`
	Admin       bool   `json:"admin"`
	Mod         bool   `json:"mod"`
}

// func (f *UserInput) ToModel() *model.User {
// 	username := strings.Split(f.Email, "@")[0]

// 	return &model.User{
// 		Email:       f.Email,
// 		Username:    username,
// 		DisplayName: username,

// 		// PictureUrl:   "",
// 		// PasswordHash: "",

// 		Private: false,
// 		Active:  true,
// 		Admin:   false,
// 		Mod:     false,

// 		CreatedAt: time.Now(),
// 	}
// }

type UserDTO struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	PictureUrl  string `json:"picture_url"`
}

func DTOFromUsers(ctx context.Context, us model.Users) []*UserDTO {
	dtos := make([]*UserDTO, len(us))
	for i, v := range us {
		dtos[i] = DTOFromUser(ctx, v)
	}

	return dtos
}

func DTOFromUser(ctx context.Context, u *model.User) *UserDTO {
	return &UserDTO{
		ID:          strconv.FormatUint(u.ID, 10),
		Username:    u.Username,
		DisplayName: u.DisplayName,
		PictureUrl:  u.PictureUrl,
	}
}
