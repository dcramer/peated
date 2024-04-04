package bottle

import (
	"net/http"

	"github.com/gin-gonic/gin"

	e "peated/api/resource/common/err"
	"peated/api/router/middleware"
	"peated/auth"
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
	r.GET("/bottles/:id/aliases", api.bottleAliasList)
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

	ctx.JSON(200, NewBottlesResponse(ctx, bottles))
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

	response := NewBottleResponse(ctx, bottle)
	response.Stats = &BottleStats{
		TotalPeople: totalPeople,
	}
	ctx.JSON(200, response)
}

func (a *API) bottleCreate(ctx *gin.Context) {

	var data BottleInput
	if err := ctx.ShouldBindJSON(&data); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&data, "json", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	currentUser, _ := auth.CurrentUser(ctx)

	newBottle, err := a.repository.Create(ctx, &model.Bottle{
		Name:        NormalizeBottleName(data.Name, data.StatedAge.Value),
		StatedAge:   data.StatedAge.Value,
		Category:    data.Category.Value,
		CreatedByID: currentUser.ID,
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

	ctx.JSON(http.StatusCreated, NewBottleResponse(ctx, newBottle))
}
