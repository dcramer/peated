package auth

import (
	"net/http"
	"peated/api/resource/common/encoder"
	e "peated/api/resource/common/err"
	"peated/api/resource/user"
	"peated/config"
	"peated/util/auth"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func CheckPasswordHash(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

type API struct {
	config     *config.Config
	logger     *zerolog.Logger
	db         *gorm.DB
	repository *user.Repository
}

func New(config *config.Config, logger *zerolog.Logger, db *gorm.DB) func(chi.Router) {
	api := &API{
		config:     config,
		logger:     logger,
		db:         db,
		repository: user.NewRepository(db),
	}
	return func(r chi.Router) {
		r.Post("/basic", api.AuthEmailPassword)
	}
}

func (a *API) AuthEmailPassword(w http.ResponseWriter, r *http.Request) {
	form, err := encoder.Decode[EmailPasswordInput](r)
	if err != nil {
		a.logger.Error().Err(err).Msg("invalid input")
		e.BadRequest(w, e.RespJSONDecodeFailure)
		return
	}

	user, err := a.repository.ReadByEmail(form.Email)
	if err != nil {
		a.logger.Error().Str("email", form.Email).Err(err).Msg("no matching user found")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if len(user.PasswordHash) == 0 {
		a.logger.Error().Str("email", form.Email).Msg("no password set")

		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if !CheckPasswordHash(form.Password, user.PasswordHash) {
		a.logger.Error().Str("email", form.Email).Msg("password mismatch")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if !user.Active {
		a.logger.Error().Str("email", form.Email).Msg("user inactive")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	accessToken, err := auth.CreateAccessToken(a.config, a.db, user)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to create token")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	auth := &AuthDTO{
		User:        user.ToDto(),
		AccessToken: accessToken,
	}

	encoder.Encode(w, r, http.StatusOK, auth)
}
