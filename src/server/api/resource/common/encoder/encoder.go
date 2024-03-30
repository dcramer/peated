package encoder

import (
	"encoding/json"
	"net/http"

	"github.com/go-errors/errors"
)

func Encode[T any](w http.ResponseWriter, r *http.Request, status int, v T) error {
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		return errors.Errorf("encode json: %w", err)
	}
	return nil
}

func Decode[T any](r *http.Request) (T, error) {
	var v T
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		return v, errors.Errorf("decode json: %w", err)
	}
	return v, nil
}
