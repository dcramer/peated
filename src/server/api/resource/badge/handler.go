package badge

import (
	"net/http"

	"github.com/gin-gonic/gin"

	e "peated/api/resource/common/err"
	"peated/api/router/middleware"
	"peated/config"
	"peated/pkg/validate"

	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

type API struct {
	logger     *zerolog.Logger
	db         *gorm.DB
	repository *Repository
	validator  *validator.Validate
}

func Routes(r *gin.Engine, config *config.Config, logger *zerolog.Logger, db *gorm.DB) {
	v := validator.New(validator.WithRequiredStructEnabled())

	api := &API{
		logger:     logger,
		db:         db,
		repository: NewRepository(db),
		validator:  v,
	}

	r.GET("/badges", api.badgeList)
	r.POST("/badges", middleware.AdminRequired(config, logger, db), api.badgeCreate)
	r.GET("/badges/:id", api.badgeById)
}

func (a *API) badgeList(ctx *gin.Context) {
	var input ListInput
	if err := ctx.ShouldBindQuery(&input); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&input, "form", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	badges, err := a.repository.List(ctx, &input)

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
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, NewBadgeResponse(ctx, badge))
}

func (a *API) badgeCreate(ctx *gin.Context) {
	var json BadgeInput
	if err := ctx.ShouldBindJSON(&json); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&json, "json", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	newBadge, err := a.repository.Create(ctx, json.ToModel())
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataInsertFailure)
		return
	}

	a.logger.Info().Uint64("id", newBadge.ID).Msg("new badge created")

	ctx.JSON(http.StatusCreated, NewBadgeResponse(ctx, newBadge))
}
