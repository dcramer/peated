package router

import (
	"net/http"
	"peated/api/resource/auth"
	"peated/api/resource/badge"
	"peated/api/resource/bottle"
	"peated/api/resource/common/schema"
	"peated/api/resource/entity"
	"peated/api/resource/health"
	"peated/api/resource/user"
	"peated/api/router/middleware"
	"peated/config"
	"reflect"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

func New(
	logger *zerolog.Logger,
	config *config.Config,
	db *gorm.DB,
) *gin.Engine {
	r := gin.Default()

	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		v.RegisterCustomTypeFunc(func(field reflect.Value) interface{} {
			return nil
		}, schema.Optional[string]{}, schema.Optional[uint64]{})
	}

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
