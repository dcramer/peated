package health

import (
	"peated/config"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func Routes(r *gin.Engine, config *config.Config, logger *zerolog.Logger) {
	r.GET("/_health", func(ctx *gin.Context) {
		ctx.String(200, "ok")
	})
}
