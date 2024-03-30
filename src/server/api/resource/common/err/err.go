package err

import (
	"net/http"
)

var (
	RespDBDataInsertFailure = []byte(`{"error": "Unable to communicate with database"}`)
	RespDBDataAccessFailure = []byte(`{"error": "Unable to communicate with database"}`)
	RespDBDataUpdateFailure = []byte(`{"error": "Unable to communicate with database"}`)
	RespDBDataRemoveFailure = []byte(`{"error": "Unable to communicate with database"}`)

	RespJSONEncodeFailure = []byte(`{"error": "Unable to encode JSON"}`)
	RespJSONDecodeFailure = []byte(`{"error": "Unable to decode JSON"}`)

	RespInvalidCredentials = []byte(`{"error": "Invalid credentials"}`)
)

type Error struct {
	Error string `json:"error"`
}

type Errors struct {
	Errors []string `json:"errors"`
}

func ServerError(w http.ResponseWriter, error []byte) {
	w.WriteHeader(http.StatusInternalServerError)
	w.Write(error)
}

func BadRequest(w http.ResponseWriter, error []byte) {
	w.WriteHeader(http.StatusBadRequest)
	w.Write(error)
}

func ValidationErrors(w http.ResponseWriter, reps []byte) {
	w.WriteHeader(http.StatusUnprocessableEntity)
	w.Write(reps)
}

func Unauthorized(w http.ResponseWriter, error []byte) {
	w.WriteHeader(http.StatusUnauthorized)
	w.Write(error)
}

func Fobidden(w http.ResponseWriter, error []byte) {
	w.WriteHeader(http.StatusForbidden)
	w.Write(error)
}
