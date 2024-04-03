package user

import (
	"context"
	"peated/api/resource/common/nullable"
	"peated/database/model"
	"strconv"
)

type User struct {
	ID          string                    `json:"id"`
	Username    string                    `json:"username"`
	DisplayName nullable.Nullable[string] `json:"displayName"`
	PictureUrl  nullable.Nullable[string] `json:"pictureUrl"`
	Private     bool                      `json:"private"`

	// TODO: we only want this to exist in auth details response I think?
	// e.g. they're used for settings
	// XXX: admin's get value out of these too though so TBD
	Email     string `json:"email,omitempty"`
	Admin     bool   `json:"admin"`
	Mod       bool   `json:"mod"`
	CreatedAt string `json:"createdAt,omitempty"`

	// TODO: this is variable, determine if it should always exist
	FriendStatus FriendStatus `json:"friendStatus,omitempty"`
}

type UserResponse struct {
	User *User `json:"user"`
}

type UsersResponse struct {
	Users []*User `json:"users"`
}

func NewUserResponse(ctx context.Context, u *model.User) *UserResponse {
	return &UserResponse{
		User: &User{
			ID:          strconv.FormatUint(u.ID, 10),
			Username:    u.Username,
			DisplayName: nullable.NewNullableFromPointer(u.DisplayName),
			PictureUrl:  nullable.NewNullableFromPointer(u.PictureUrl),
			Private:     u.Private,
		},
	}
}

func NewUsersResponse(ctx context.Context, us model.Users) *UsersResponse {
	users := make([]*User, len(us))
	for i, v := range us {
		users[i] = NewUserResponse(ctx, v).User
	}

	return &UsersResponse{
		Users: users,
	}
}
