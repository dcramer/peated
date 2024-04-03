package entity

import (
	"net/http"
	e "peated/api/resource/common/err"
	"peated/auth"
	"peated/database"
	"peated/pkg/validate"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

func (a *API) entityMerge(ctx *gin.Context) {
	type RequestUri struct {
		ID uint64 `uri:"id" binding:"numeric"`
	}
	var uri RequestUri

	if err := ctx.ShouldBindUri(&uri); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&uri, "uri", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	var data EntityMergeInput
	if err := ctx.ShouldBindJSON(&data); err != nil {
		var details []*validate.ValidationErrDetail
		if vErrs, ok := err.(validator.ValidationErrors); ok {
			details = validate.ValidationErrorDetails(&data, "json", vErrs)
		}
		e.NewBadRequest(ctx, e.InvalidParameters(details))
		return
	}

	for _, id := range data.EntityIDs {
		if id == uri.ID {
			e.NewBadRequest(ctx, e.InvalidParameters([]*validate.ValidationErrDetail{
				{
					Field:   "entityIds",
					Value:   id,
					Message: "cannot merge an entity into itself",
				},
			}))
			return
		}
	}

	currentUser, _ := auth.CurrentUser(ctx)

	err := a.repository.Delete(ctx, uri.ID, currentUser)
	if err != nil {
		if database.IsRecordNotFoundErr(err) {
			e.NewNotFound(ctx, e.RespNotFound)
			return
		}
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataRemoveFailure)
		return
	}

	ctx.JSON(http.StatusNoContent, gin.H{})
}
