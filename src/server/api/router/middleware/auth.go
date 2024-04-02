package middleware

import (
	"peated/auth"
	"peated/config"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

const authorizationHeaderKey = "Authorization"

func Auth(config *config.Config, db *gorm.DB, logger *zerolog.Logger) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		headerValue := ctx.Request.Header.Get(authorizationHeaderKey)
		if headerValue != "" {
			user, err := auth.GetUserFromHeader(config, db, headerValue)
			if err != nil {
				logger.Error().Err(err).Msg("unable to authenticate from token")
			} else {
				auth.SetCurrentUser(ctx, user)
			}
		}
		ctx.Next()
	}
}
