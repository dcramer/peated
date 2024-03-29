package user

import (
	"fmt"
	"net/http"

	"peated/api/resource/common/encoder"
	e "peated/api/resource/common/err"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
)

type API struct {
	logger     *zerolog.Logger
	db         *gorm.DB
	repository *Repository
	// validator  *validator.Validate
}

func New(logger *zerolog.Logger, db *gorm.DB) func(chi.Router) {
	api := &API{
		logger:     logger,
		db:         db,
		repository: NewRepository(db),
		// validator:  validator,
	}
	return func(r chi.Router) {
		r.Get("/", api.List)
		r.Post("/", api.Create)
		r.Get("/{id}", api.Get)
	}
}

func (a *API) List(w http.ResponseWriter, r *http.Request) {
	users, err := a.repository.List()

	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(w, e.RespDBDataAccessFailure)
		return
	}

	if len(users) == 0 {
		fmt.Fprint(w, "[]")
		return
	}

	if err := encoder.Encode(w, r, http.StatusOK, users.ToDto()); err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(w, e.RespJSONEncodeFailure)
		return
	}

}

func (a *API) Get(w http.ResponseWriter, r *http.Request) {
	user, err := a.repository.Read(r.PathValue("id"))
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(w, e.RespDBDataAccessFailure)
		return
	}

	encoder.Encode(w, r, http.StatusOK, user.ToDto())

}

func (a *API) Create(w http.ResponseWriter, r *http.Request) {
	form, err := encoder.Decode[UserInput](r)
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.BadRequest(w, e.RespJSONDecodeFailure)
		return
	}

	// if err := a.validator.Struct(form); err != nil {
	// 	respBody, err := json.Marshal(validatorUtil.ToErrResponse(err))
	// 	if err != nil {
	// 		a.logger.Error().Err(err).Msg("")
	// 		e.ServerError(w, e.RespJSONEncodeFailure)
	// 		return
	// 	}

	// 	e.ValidationErrors(w, respBody)
	// 	return
	// }

	newUser, err := a.repository.Create(form.ToModel())
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(w, e.RespDBDataInsertFailure)
		return
	}

	a.logger.Info().Str("id", newUser.ID).Msg("new user created")

	encoder.Encode(w, r, http.StatusCreated, newUser.ToDto())
}
