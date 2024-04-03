package nullable

import "github.com/oapi-codegen/nullable"

type Nullable[T any] struct {
	nullable.Nullable[T]
}

func (n *Nullable[T]) MustPointer() *T {
	if !n.IsSpecified() || n.IsNull() {
		return nil
	}
	val := n.MustGet()
	return &val
}

func NewNullableFromPointer[T any](t *T) Nullable[T] {
	if t == nil {
		return Nullable[T]{
			nullable.NewNullNullable[T](),
		}
	}

	return Nullable[T]{
		nullable.NewNullableWithValue[T](*t),
	}
}
