package schema

import "encoding/json"

type Optional[T any] struct {
	Defined bool
	Value   *T
}

func (o *Optional[T]) UnmarshalJSON(data []byte) error {
	o.Defined = true
	return json.Unmarshal(data, &o.Value)
}

func (o *Optional[T]) MarshalJSON() ([]byte, error) {
	return json.Marshal(o.Value)
}

func NewOptional[T any](t *T) Optional[T] {
	return Optional[T]{
		Defined: true,
		Value:   t,
	}
}
