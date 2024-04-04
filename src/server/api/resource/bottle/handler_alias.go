package bottle

import (
	e "peated/api/resource/common/err"
	"strconv"

	"github.com/gin-gonic/gin"
)

func (a *API) bottleAliasList(ctx *gin.Context) {
	id, err := strconv.ParseUint(ctx.Param("id"), 10, 64)
	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewBadRequest(ctx, e.RespDBDataAccessFailure)
		return
	}

	aliases, err := a.repository.ListAliases(ctx, id)

	if err != nil {
		a.logger.Error().Err(err).Msg("")
		e.NewServerError(ctx, e.RespDBDataAccessFailure)
		return
	}

	ctx.JSON(200, NewBottleAliasesResponse(ctx, aliases))
}
