package router

import (
	"net/http"
	"peated/api/resource/auth"
	"peated/api/resource/badge"
	"peated/api/resource/bottle"
	"peated/api/resource/entity"
	"peated/api/resource/health"
	"peated/api/resource/user"
	"peated/api/router/middleware"
	"peated/config"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

func New(
	logger *zerolog.Logger,
	config *config.Config,
	db *gorm.DB,
) *gin.Engine {
	r := gin.Default()

	r.NoMethod(func(ctx *gin.Context) {
		ctx.JSON(http.StatusMethodNotAllowed, gin.H{"error": "method not allowed on resource"})
	})

	r.NoRoute(func(ctx *gin.Context) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "resource not found"})
	})

	r.GET("/", func(ctx *gin.Context) {
		ctx.JSON(http.StatusOK, gin.H{"version": config.Version})
	})

	r.Use(middleware.Auth(config, logger, db))

	health.Routes(r, config, logger)
	auth.Routes(r, config, logger, db)
	bottle.Routes(r, config, logger, db)
	badge.Routes(r, config, logger, db)
	entity.Routes(r, config, logger, db)
	user.Routes(r, config, logger, db)

	return r
}
