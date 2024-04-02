package badge

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	e "peated/api/resource/common/err"

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

func Routes(r *gin.Engine, logger *zerolog.Logger, db *gorm.DB) {
	v := validator.New(validator.WithRequiredStructEnabled())

	api := &API{
		logger:     logger,
		db:         db,
		repository: NewRepository(db),
		validator:  v,
	}
	r.GET("/badges/", api.List)
	// r.POST("/", api.Create)
	r.GET("/badges/:id", api.Get)
}

func (a *API) List(ctx *gin.Context) {
	var input ListInput
	if err := ctx.ShouldBind(&input); err != nil {
		e.BadRequest(ctx, gin.H{"error": err.Error()})
		return
	}

	badges, err := a.repository.List(ctx, &input)

	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, DTOFromBadges(ctx, badges))
}

func (a *API) Get(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.BadRequest(ctx, e.RespDBDataAccessFailure)
		return
	}

	badge, err := a.repository.ReadById(ctx, id)
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, DTOFromBadge(ctx, badge))
}

func (a *API) Create(ctx *gin.Context) {
	var json BadgeInput
	if err := ctx.ShouldBindJSON(&json); err != nil {
		e.BadRequest(ctx, gin.H{"error": err.Error()})
		return
	}

	newBadge, err := a.repository.Create(ctx, json.ToModel())
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(ctx, e.RespDBDataInsertFailure)
		return
	}

	a.logger.Info().Uint64("id", newBadge.ID).Msg("new badge created")

	ctx.JSON(http.StatusCreated, DTOFromBadge(ctx, newBadge))
}
