package middleware

import (
	"net/http"
	"peated/auth"
	"peated/config"

	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

const authorizationHeaderKey = "Authorization"

func Auth(config *config.Config, db *gorm.DB, logger *zerolog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			headerValue := r.Header.Get(authorizationHeaderKey)
			if headerValue != "" {
				user, err := auth.GetUserFromHeader(config, db, headerValue)
				if err != nil {
					logger.Error().Err(err).Msg("unable to authenticate from token")
				} else {
					ctx = auth.SetCurrentUser(ctx, user)
				}
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

}
