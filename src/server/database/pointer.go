package database

func Ptr[T interface{}](v T) *T {
	return &v
}
