package middleware

import (
	"net/http"
	"peated/auth"
	"peated/config"

	"gorm.io/gorm"
)

const authorizationHeaderKey = "Authorization"

func Auth(config *config.Config, db *gorm.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			headerValue := r.Header.Get(authorizationHeaderKey)
			if headerValue != "" {
				if user, err := auth.GetUserFromHeader(config, db, headerValue); err != nil {
					ctx = auth.SetCurrentUser(ctx, user)
				} else {

				}
			}
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

}
