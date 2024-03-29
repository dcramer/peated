package router

import (
	"peated/api/resource/health"
	"peated/api/resource/user"
	"peated/config"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
)

func New(
	logger *zerolog.Logger,
	config *config.Config,
	// commentStore *commentStore
	// anotherStore *anotherStore
) *chi.Mux {
	r := chi.NewRouter()
	r.Route("/healthz", health.New(logger))
	r.Route("/api", func(r chi.Router) {
		r.Route("/users", user.New(logger))
	})
	return r
}
