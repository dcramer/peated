package auth

import (
	"encoding/json"
	"net/http"
	"peated/api/resource/common/encoder"
	e "peated/api/resource/common/err"
	"peated/api/resource/user"
	"peated/auth"
	"peated/config"
	"peated/db/model"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/idtoken"
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
		r.Get("/", api.Read)
		r.Post("/basic", api.EmailPassword)
		r.Post("/google", api.Google)
	}
}

/**
 * Read currently authenticated user.
 */
func (a *API) Read(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	user, ok := auth.CurrentUser(ctx)
	if !ok {
		a.logger.Error().Msg("unauthenticated session")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if !user.Active {
		a.logger.Error().Msg("user inactive")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	encoder.Encode(w, r, http.StatusOK, DTOFromUser(ctx, user, ""))
}

func (a *API) EmailPassword(w http.ResponseWriter, r *http.Request) {
	form, err := encoder.Decode[EmailPasswordInput](r)
	if err != nil {
		a.logger.Error().Err(err).Msg("invalid input")
		e.BadRequest(w, e.RespJSONDecodeFailure)
		return
	}

	currentUser, err := a.repository.ReadByEmail(r.Context(), form.Email)
	if err != nil {
		a.logger.Error().Str("email", form.Email).Err(err).Msg("no matching user found")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if len(currentUser.PasswordHash) == 0 {
		a.logger.Error().Str("email", form.Email).Msg("no password set")

		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if !CheckPasswordHash(form.Password, currentUser.PasswordHash) {
		a.logger.Error().Str("email", form.Email).Msg("password mismatch")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if !currentUser.Active {
		a.logger.Error().Str("email", form.Email).Msg("user inactive")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	accessToken, err := auth.CreateAccessToken(a.config, currentUser)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to create token")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	auth := DTOFromUser(r.Context(), currentUser, *accessToken)

	encoder.Encode(w, r, http.StatusOK, auth)
}

func (a *API) Google(w http.ResponseWriter, r *http.Request) {
	form, err := encoder.Decode[CodeInput](r)
	if err != nil {
		a.logger.Error().Err(err).Msg("invalid input")
		e.BadRequest(w, e.RespJSONDecodeFailure)
		return
	}

	conf := &oauth2.Config{
		ClientID:     a.config.Google.ClientID,
		ClientSecret: a.config.Google.ClientSecret,
		RedirectURL:  "postmessage",
		// Scopes: []string{
		// 	"https://www.googleapis.com/auth/bigquery",
		// 	"https://www.googleapis.com/auth/blogger",
		// },
		Endpoint: google.Endpoint,
	}

	ctx := r.Context()
	token, err := conf.Exchange(ctx, form.Code)
	if err != nil {
		a.logger.Error().Err(err).Msg("failed to exchange token")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	idTokenString := token.Extra("id_token").(string)
	if len(idTokenString) == 0 {
		a.logger.Error().Err(err).Msg("invalid or missing id_token")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	ticket, err := idtoken.Validate(ctx, idTokenString, a.config.Google.ClientID)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to validate id_token")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	jsonbody, err := json.Marshal(ticket.Claims)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to marshal claims")
		e.ServerError(w, e.RespJSONEncodeFailure)
		return
	}

	claims := GoogleClaims{}
	if err := json.Unmarshal(jsonbody, &claims); err != nil {
		a.logger.Error().Err(err).Msg("unable to unmarshal claims")
		e.ServerError(w, e.RespJSONDecodeFailure)
		return
	}

	if len(claims.Email) == 0 {
		a.logger.Error().Err(err).Msg("no email address")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	currentUser, err := a.repository.UpsertWithIdentity(ctx, &model.User{
		DisplayName: claims.GivenName,
		Username:    strings.Split(claims.Email, "@")[0],
		Email:       claims.Email,
		Active:      true,
	}, &model.Identity{
		Provider:   model.IdentityProviderGoogle,
		ExternalID: claims.Sub,
	})
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to create user from token")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	if !currentUser.Active {
		a.logger.Error().Msg("user inactive")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	accessToken, err := auth.CreateAccessToken(a.config, currentUser)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to create token")
		e.Unauthorized(w, e.RespInvalidCredentials)
		return
	}

	auth := DTOFromUser(r.Context(), currentUser, *accessToken)

	encoder.Encode(w, r, http.StatusOK, auth)
}
