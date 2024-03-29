package router

import (
	"peated/api/resource/health"
	"peated/api/resource/user"
	"peated/api/router/middleware"
	"peated/config"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

func New(
	logger *zerolog.Logger,
	config *config.Config,
	db *gorm.DB,
	// commentStore *commentStore
	// anotherStore *anotherStore
) *chi.Mux {
	r := chi.NewRouter()
	r.Route("/healthz", health.New(logger))
	r.Route("/", func(r chi.Router) {
		r.Use(middleware.ContentTypeJSON)
		r.Use(middleware.Auth(config, db))

		r.Route("/users", user.New(logger, db))
	})
	return r
}
