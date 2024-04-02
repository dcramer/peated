package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/nrednav/cuid2"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("X-Request-Id", cuid2.Generate())
		c.Next()
	}
}
