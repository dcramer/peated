package middleware

import (
	"net/http"
	e "peated/api/resource/common/err"
	"peated/auth"
	"peated/config"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

func AdminRequired(config *config.Config, logger *zerolog.Logger, db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, ok := auth.CurrentUser(ctx)
		if !ok {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, e.RespAuthRequired)
		} else if !user.Admin {
			ctx.AbortWithStatusJSON(http.StatusForbidden, e.RespNoPermission)
		}
		ctx.Next()
	}
}
