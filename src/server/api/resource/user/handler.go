package user

import (
	"github.com/ggicci/httpin"
	"github.com/gin-gonic/gin"

	e "peated/api/resource/common/err"
	"peated/auth"
	"peated/config"

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
	r.GET("/users", api.List)
	r.POST("/users/:username", api.Get)
}

func (a *API) List(ctx *gin.Context) {
	input := ctx.Value(httpin.Input).(*ListInput)

	user, _ := auth.CurrentUser(ctx)
	if input.Query == "" && !user.Admin {
		e.NewBadRequest(ctx, gin.H{"error": "query is required"})
	}

	users, err := a.repository.List(ctx, input)

	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, DTOFromUsers(ctx, users))
}

func (a *API) Get(ctx *gin.Context) {
	user, err := a.repository.ReadByUsername(ctx, ctx.Param("username"))
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, DTOFromUser(ctx, user))
}

// func (a *API) Create(w http.ResponseWriter, r *http.Request) {
// 	form, err := encoder.Decode[UserInput](r)
// 	if err != nil {
// 		a.logger.Error().Err(err).Msg("")
// 		e.BadRequest(w, e.RespJSONDecodeFailure)
// 		return
// 	}

// 	// if err := a.validator.Struct(form); err != nil {
// 	// 	respBody, err := json.Marshal(validatorUtil.ToErrResponse(err))
// 	// 	if err != nil {
// 	// 		a.logger.Error().Err(err).Msg("")
// 	// 		e.ServerError(w, e.RespJSONEncodeFailure)
// 	// 		return
// 	// 	}

// 	// 	e.ValidationErrors(w, respBody)
// 	// 	return
// 	// }

// 	newUser, err := a.repository.Create(form.ToModel())
// 	if err != nil {
// 		a.logger.Error().Err(err).Msg("")
// 		e.ServerError(w, e.RespDBDataInsertFailure)
// 		return
// 	}

// 	a.logger.Info().Uint64("id", newUser.ID).Msg("new user created")

// 	encoder.Encode(w, r, http.StatusCreated, newUser.ToDto())
// }
