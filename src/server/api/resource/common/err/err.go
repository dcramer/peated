package err

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

var (
	RespDBDataInsertFailure = gin.H{"error": "Unable to communicate with database"}
	RespDBDataAccessFailure = gin.H{"error": "Unable to communicate with database"}
	RespDBDataUpdateFailure = gin.H{"error": "Unable to communicate with database"}
	RespDBDataRemoveFailure = gin.H{"error": "Unable to communicate with database"}

	RespJSONEncodeFailure = gin.H{"error": "Unable to encode JSON"}
	RespJSONDecodeFailure = gin.H{"error": "Unable to decode JSON"}

	RespAuthRequired = gin.H{
		"error": "Unauthorized",
		"code":  "auth_required",
	}
	RespNoPermission = gin.H{
		"error": "Unauthorized",
		"code":  "no_permission",
	}
	RespInvalidCredentials = gin.H{"error": "Invalid credentials"}

	RespUnknownServerError = gin.H{"error": "Unhandled internal error"}
)

type Error struct {
	Error string `json:"error"`
}

type Errors struct {
	Errors []string `json:"errors"`
}

func ServerError(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusInternalServerError, error)
}

func BadRequest(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusBadRequest, error)
}

func ValidationErrors(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusUnprocessableEntity, error)
}

func Unauthorized(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusUnauthorized, error)
}

func Fobidden(ctx *gin.Context, error gin.H) {
	ctx.AbortWithStatusJSON(http.StatusForbidden, error)

}
