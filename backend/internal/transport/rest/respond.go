package rest

import "github.com/gin-gonic/gin"

// respondError writes the standard error body: {"error": code, "message": message}.
func respondError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": code, "message": message})
}
