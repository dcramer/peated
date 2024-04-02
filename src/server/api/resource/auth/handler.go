package auth

import (
	"encoding/json"
	e "peated/api/resource/common/err"
	"peated/api/resource/user"
	"peated/auth"
	"peated/config"
	"peated/database/model"
	"peated/pkg/validate"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
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

func Routes(r *gin.Engine, config *config.Config, logger *zerolog.Logger, db *gorm.DB) {
	api := &API{
		config:     config,
		logger:     logger,
		db:         db,
		repository: user.NewRepository(db),
	}
	r.GET("/auth", api.Read)
	r.POST("/auth/basic", api.EmailPassword)
	r.POST("/auth/google", api.Google)
}

/**
 * Read currently authenticated user.
 */
func (a *API) Read(ctx *gin.Context) {
	user, ok := auth.CurrentUser(ctx)
	if !ok {
		a.logger.Error().Msg("unauthenticated session")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	if !user.Active {
		a.logger.Info().Msg("user inactive")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	ctx.JSON(200, DTOFromUser(ctx, user, ""))
}

func (a *API) EmailPassword(ctx *gin.Context) {
	var data EmailPasswordInput
	if err := ctx.ShouldBindJSON(&data); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&data, "json", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	currentUser, err := a.repository.ReadByEmail(ctx, data.Email)
	if err != nil {
		a.logger.Error().Str("email", data.Email).Err(err).Msg("no matching user found")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	if len(currentUser.PasswordHash) == 0 {
		a.logger.Error().Str("email", data.Email).Msg("no password set")

		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	if !CheckPasswordHash(data.Password, currentUser.PasswordHash) {
		a.logger.Error().Str("email", data.Email).Msg("password mismatch")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	if !currentUser.Active {
		a.logger.Error().Str("email", data.Email).Msg("user inactive")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	accessToken, err := auth.CreateAccessToken(a.config, currentUser)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to create token")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	auth := DTOFromUser(ctx, currentUser, *accessToken)

	ctx.JSON(200, auth)
}

func (a *API) Google(ctx *gin.Context) {
	var data CodeInput
	if err := ctx.ShouldBindJSON(&data); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&data, "json", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
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

	token, err := conf.Exchange(ctx, data.Code)
	if err != nil {
		a.logger.Error().Err(err).Msg("failed to exchange token")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	idTokenString := token.Extra("id_token").(string)
	if len(idTokenString) == 0 {
		a.logger.Error().Err(err).Msg("invalid or missing id_token")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	ticket, err := idtoken.Validate(ctx, idTokenString, a.config.Google.ClientID)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to validate id_token")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	jsonbody, err := json.Marshal(ticket.Claims)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to marshal claims")
		e.NewServerError(ctx, e.RespJSONEncodeFailure)
		return
	}

	claims := GoogleClaims{}
	if err := json.Unmarshal(jsonbody, &claims); err != nil {
		a.logger.Error().Err(err).Msg("unable to unmarshal claims")
		e.NewServerError(ctx, e.RespJSONDecodeFailure)
		return
	}

	if len(claims.Email) == 0 {
		a.logger.Error().Err(err).Msg("no email address")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
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
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	if !currentUser.Active {
		a.logger.Error().Msg("user inactive")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	accessToken, err := auth.CreateAccessToken(a.config, currentUser)
	if err != nil {
		a.logger.Error().Err(err).Msg("unable to create token")
		e.NewUnauthorized(ctx, e.RespInvalidCredentials)
		return
	}

	auth := DTOFromUser(ctx, currentUser, *accessToken)

	ctx.JSON(200, auth)
}
