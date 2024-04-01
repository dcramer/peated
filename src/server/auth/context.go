package auth

import (
	"context"
	"peated/db/model"
)

const userKey key = "user"

type key string

func CurrentUser(ctx context.Context) (*model.User, bool) {
	user, ok := ctx.Value(userKey).(*model.User)
	if user == nil {
		user = &model.User{}
	}
	return user, ok
}

func SetCurrentUser(ctx context.Context, user *model.User) context.Context {
	return context.WithValue(ctx, userKey, user)
}
