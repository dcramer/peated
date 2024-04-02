package health

import (
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func Routes(router *gin.Engine, logger *zerolog.Logger) {
	router.GET("/_health", func(ctx *gin.Context) {
		ctx.String(200, "ok")
	})
}
