package auth

import (
	"peated/database/model"

	"github.com/gin-gonic/gin"
)

const userKey string = "user"

func CurrentUser(ctx *gin.Context) (*model.User, bool) {
	user, ok := ctx.Value(userKey).(*model.User)
	if user == nil {
		user = &model.User{}
	}
	return user, ok
}

func SetCurrentUser(ctx *gin.Context, user *model.User) {
	ctx.Set(userKey, user)
}
