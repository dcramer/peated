package middleware

import (
	"context"
	"net/http"
	e "peated/api/resource/common/err"
	"peated/auth"
	"peated/config"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nrednav/cuid2"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

const (
	XRequestIdKey    = "X-Request-ID"
	AuthorizationKey = "Authorization"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set(XRequestIdKey, cuid2.Generate())
		c.Next()
	}
}

func TimeoutMiddleware(timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)

		defer func() {
			if ctx.Err() == context.DeadlineExceeded {
				c.AbortWithStatus(http.StatusGatewayTimeout)
			}
			cancel()
		}()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func ModRequired(config *config.Config, logger *zerolog.Logger, db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		user, ok := auth.CurrentUser(ctx)
		if !ok {
			ctx.AbortWithStatusJSON(http.StatusUnauthorized, e.RespAuthRequired)
		} else if !user.Admin && !user.Mod {
			ctx.AbortWithStatusJSON(http.StatusForbidden, e.RespNoPermission)
		}
		ctx.Next()
	}
}

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

func Auth(config *config.Config, logger *zerolog.Logger, db *gorm.DB) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		headerValue := ctx.Request.Header.Get(AuthorizationKey)
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
