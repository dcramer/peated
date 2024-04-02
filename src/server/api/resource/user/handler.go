package user

import (
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	e "peated/api/resource/common/err"
	"peated/api/router/middleware"
	"peated/auth"
	"peated/config"
	"peated/database"
	"peated/pkg/validate"

	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

type API struct {
	logger     *zerolog.Logger
	db         *gorm.DB
	repository *Repository
}

func Routes(r *gin.Engine, config *config.Config, logger *zerolog.Logger, db *gorm.DB) {
	api := &API{
		logger:     logger,
		db:         db,
		repository: NewRepository(db),
	}
	r.GET("/users", middleware.AuthRequired(config, logger, db), api.userList)
	r.GET("/users/:username", api.userById)
}

func (a *API) userList(ctx *gin.Context) {
	var query ListInput
	if err := ctx.ShouldBindQuery(&query); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&query, "form", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	user, _ := auth.CurrentUser(ctx)
	if query.Query == "" && !user.Admin {
		e.NewBadRequest(ctx, gin.H{"error": "query is required"})
		return
	}

	users, err := a.repository.List(ctx, &query)
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, NewUsersResponse(ctx, users))
}

func (a *API) userById(ctx *gin.Context) {
	type RequestUri struct {
		Username string `uri:"username"`
	}

	var uri RequestUri
	if err := ctx.ShouldBindUri(&uri); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&uri, "uri", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	user, err := a.repository.ReadByUsername(ctx, uri.Username)
	if err != nil {
		if database.IsRecordNotFoundErr(err) {
			e.NewNotFound(ctx, e.RespNotFound)
			return
		}
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, NewUserResponse(ctx, user))
}
