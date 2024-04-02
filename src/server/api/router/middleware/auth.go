package middleware

import (
	"peated/auth"
	"peated/config"

	"net/http"
	e "peated/api/resource/common/err"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

const authorizationHeaderKey = "Authorization"

func Auth(config *config.Config, logger *zerolog.Logger, db *gorm.DB) gin.HandlerFunc {
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

func AuthRequired(config *config.Config, logger *zerolog.Logger, db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		_, ok := auth.CurrentUser(ctx)
		if !ok {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, e.RespAuthRequired)
		}
		ctx.Next()
	}
}
