package router

import (
	"net/http"
	"peated/api/resource/auth"
	"peated/api/resource/health"
	"peated/api/resource/user"
	"peated/api/router/middleware"
	"peated/config"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

func New(
	logger *zerolog.Logger,
	config *config.Config,
	db *gorm.DB,
) *chi.Mux {
	r := chi.NewRouter()

	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	// Set a timeout value on the request context (ctx), that will signal
	// through ctx.Done() that the request has timed out and further
	// processing should be stopped.
	r.Use(chiMiddleware.Timeout(60 * time.Second))

	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusMethodNotAllowed)
		w.Write([]byte("{\"errror\": \"method not allowed on resource\"}"))
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("{\"errror\": \"resource not found\"}"))
	})

	r.Route("/_health", health.New(logger))
	r.Route("/", func(r chi.Router) {

		r.Use(middleware.ContentTypeJSON)
		r.Use(middleware.Auth(config, db, logger))

		r.Get("/", func(w http.ResponseWriter, _ *http.Request) {
			w.Write([]byte("{\"version\": \"" + config.Version + "\"}"))
		})

		r.Route("/auth", auth.New(config, logger, db))
		r.Route("/users", user.New(logger, db))
	})
	return r
}
