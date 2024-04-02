package err

import (
	"net/http"
	"peated/pkg/validate"

	"github.com/gin-gonic/gin"
)

var (
	RespDBDataInsertFailure = gin.H{"message": "Unable to communicate with database"}
	RespDBDataAccessFailure = gin.H{"message": "Unable to communicate with database"}
	RespDBDataUpdateFailure = gin.H{"message": "Unable to communicate with database"}
	RespDBDataRemoveFailure = gin.H{"message": "Unable to communicate with database"}

	RespJSONEncodeFailure = gin.H{"message": "Unable to encode JSON"}
	RespJSONDecodeFailure = gin.H{"message": "Unable to decode JSON"}

	RespAuthRequired = gin.H{
		"message": "Unauthorized",
		"code":    "auth_required",
	}
	RespNoPermission = gin.H{
		"message": "Unauthorized",
		"code":    "no_permission",
	}
	RespInvalidCredentials = gin.H{"message": "Invalid credentials"}

	RespNotFound = gin.H{"message": "resource not found"}
	RespConflict = gin.H{
		"message": "entity already exists",
		"code":    "conflict",
	}

	RespUnknownServerError = gin.H{"message": "Unhandled internal error"}
)

type Error struct {
	Error string `json:"error"`
}

type Errors struct {
	Errors []string `json:"errors"`
}

func NewServerError(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusInternalServerError, error)
}

func NewBadRequest(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusBadRequest, error)
}

func NewConflict(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusConflict, error)
}

func NewNotFound(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusNotFound, error)
}

func NewValidationErrors(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusUnprocessableEntity, error)
}

func NewUnauthorized(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusUnauthorized, error)
}

func NewFobidden(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusForbidden, error)
}

func InvalidParameters(details []*validate.ValidationErrDetail) gin.H {
	return gin.H{
		"code":    "invalid_request",
		"message": "invalid request",
		"errors":  details,
	}
}
