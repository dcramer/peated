package ctx

import (
	"context"
	"peated/api/resource/user"
)

const userKey key = "user"

type key string

func CurrentUser(ctx context.Context) (user.User, bool) {
	user, ok := ctx.Value(userKey).(user.User)

	return user, ok
}

func SetCurrentUser(ctx context.Context, user user.User) context.Context {
	return context.WithValue(ctx, userKey, user)
}
