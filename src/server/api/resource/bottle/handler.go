package bottle

import (
	"net/http"
	"strconv"

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

	r.GET("/bottles", api.bottleList)
	r.POST("/bottles", middleware.AuthRequired(config, logger, db), api.bottleCreate)
	r.GET("/bottles/:id", api.bottleByID)
	r.GET("/bottles/:id/aliases", api.ListAliases)
}

func (a *API) bottleList(ctx *gin.Context) {
	var input ListInput
	if err := ctx.ShouldBindQuery(&input); err != nil {
		e.NewBadRequest(ctx, gin.H{"error": err.Error()})
		return
	}

	bottles, err := a.repository.List(ctx, &input)

	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, DTOFromBottles(ctx, bottles))
}

func (a *API) bottleByID(ctx *gin.Context) {
	type RequestUri struct {
		ID uint64 `uri:"id" binding:"numeric"`
	}
	var uri RequestUri

	if err := ctx.ShouldBindUri(&uri); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&uri, "uri", vErrs)
		}
		e.NewBadRequest(ctx, gin.H{
			"code":    "invalid_uri",
			"message": "invalid parameters",
			"errors":  details,
		})
		return
	}

	bottle, err := a.repository.ReadByTombstone(ctx, uri.ID)
	if err != nil {
		if !database.IsRecordNotFoundErr(err) {
			a.logger.Error().Err(err).Msg("")
			e.NewServerError(ctx, e.RespDBDataAccessFailure)
			return
		}

		bottle, err = a.repository.ReadById(ctx, uri.ID)
		if err != nil {
			if database.IsRecordNotFoundErr(err) {
				e.NewNotFound(ctx, e.RespNotFound)
				return
			}

			a.logger.Error().Err(err).Msg("")
			e.NewServerError(ctx, e.RespDBDataAccessFailure)
			return
		}
	}

	var totalPeople int64
	a.db.Model(&model.Tasting{}).Distinct("createdById").Count(&totalPeople)

	ctx.JSON(200, gin.H{
		"bottle": DTOFromBottle(ctx, bottle),
		"stats": gin.H{
			"totalPeople": totalPeople,
		},
	})
}

func (a *API) bottleCreate(ctx *gin.Context) {
	var json BottleInput
	if err := ctx.ShouldBindJSON(&json); err != nil {
		e.NewBadRequest(ctx, gin.H{"error": err.Error()})
		return
	}

	newBottle, err := a.repository.Create(ctx, json.ToModel())
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataInsertFailure)
		return
	}

	a.logger.Info().Uint64("id", newBottle.ID).Msg("new bottle created")

	ctx.JSON(http.StatusCreated, DTOFromBottle(ctx, newBottle))
}

func (a *API) ListAliases(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewBadRequest(ctx, e.RespDBDataAccessFailure)
		return
	}

	aliases, err := a.repository.ListAliases(ctx, id)

	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, DTOFromBottleAliases(ctx, aliases))
}
