package user

import (
	"encoding/json"
	"net/http"

	"peated/api/resource/common/encoder"
	e "peated/api/resource/common/err"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
)

type API struct {
	logger *zerolog.Logger
	// validator  *validator.Validate
}

func New(logger *zerolog.Logger) func(chi.Router) {
	api := &API{
		logger: logger,
		// validator:  validator,
	}
	return func(r chi.Router) {
		r.Get("/", api.Get)
		r.Post("/", api.Create)
	}
}

// func GetUser(w http.ResponseWriter, r *http.Request) {
// 	id := r.PathValue("id")
// 	user, err := crud.GetUser(id)
// 	if err != nil {
// 		http_utils.Encode(w, r, http.StatusInternalServerError, "")
// 	} else {
// 		http_utils.Encode(w, r, http.StatusOK, NewUserResponse(&user))
// 	}
// }

// func CreateUser(w http.ResponseWriter, r *http.Request) {
// 	newUser, err := crud.CreateUser(model.User{})
// 	if err != nil {
// 		http_utils.Encode(w, r, http.StatusInternalServerError, "")
// 	} else {
// 		http_utils.Encode(w, r, http.StatusOK, NewUserResponse(&newUser))
// 	}
// }

func (a *API) Get(w http.ResponseWriter, r *http.Request) {
	user, err := GetUser(r.PathValue("id"))
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(w, e.RespDBDataAccessFailure)
		return
	}

	dto := user.ToDto()
	if err := json.NewEncoder(w).Encode(dto); err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(w, e.RespJSONEncodeFailure)
		return
	}

	encoder.Encode(w, r, http.StatusOK, user.ToDto())

}

func (a *API) Create(w http.ResponseWriter, r *http.Request) {
	form := &UserInput{}
	if err := json.NewDecoder(r.Body).Decode(form); err != nil {
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

	newUser, err := CreateUser(form.ToModel())
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.ServerError(w, e.RespDBDataInsertFailure)
		return
	}

	a.logger.Info().Int("id", newUser.ID).Msg("new user created")

	encoder.Encode(w, r, http.StatusCreated, newUser.ToDto())
}
