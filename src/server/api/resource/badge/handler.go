package badge

import (
	"net/http"

	"github.com/gin-gonic/gin"

	e "peated/api/resource/common/err"
	"peated/api/router/middleware"
	"peated/config"
	"peated/database"
	"peated/database/model"
	"peated/pkg/validate"

	"github.com/go-playground/validator/v10"
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

	r.GET("/badges", api.badgeList)
	r.POST("/badges", middleware.AdminRequired(config, logger, db), api.badgeCreate)
	r.GET("/badges/:id", api.badgeById)
}

func (a *API) badgeList(ctx *gin.Context) {
	var query ListInput
	if err := ctx.ShouldBindQuery(&query); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&query, "form", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	badges, err := a.repository.List(ctx, &query)

	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, NewBadgesResponse(ctx, badges))
}

func (a *API) badgeById(ctx *gin.Context) {
	type RequestUri struct {
		ID uint64 `uri:"id" binding:"numeric"`
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

	badge, err := a.repository.ReadById(ctx, uri.ID)
	if err != nil {
		if database.IsRecordNotFoundErr(err) {
			e.NewNotFound(ctx, e.RespNotFound)
			return
		}
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, NewBadgeResponse(ctx, badge))
}

func (a *API) badgeCreate(ctx *gin.Context) {
	var data BadgeInput
	if err := ctx.ShouldBindJSON(&data); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&data, "json", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	// TODO: validate config
	newBadge, err := a.repository.Create(ctx, &model.Badge{
		Name: data.Name,
		Type: data.Type,
		// TODO:
		// Config: data.Config,
	})
	if err != nil {
		if database.IsKeyConflictErr(err) {
			e.NewConflict(ctx, e.RespConflict)
			return
		}
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataInsertFailure)
		return
	}

	ctx.JSON(http.StatusCreated, NewBadgeResponse(ctx, newBadge))
}
