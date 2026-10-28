package rest

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// MarketCategory is a category a prediction market can be filed under.
type MarketCategory struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// marketCategories is the single source of truth for categories. Market creation validates against
// it, and the public category list serves it to the catalog and the admin console.
var marketCategories = []MarketCategory{
	{ID: "ai", Label: "AI & Tech"},
	{ID: "crypto", Label: "Crypto"},
	{ID: "macro", Label: "Macro Economy"},
	{ID: "science", Label: "Science & Space"},
}

func isKnownMarketCategory(id string) bool {
	for _, c := range marketCategories {
		if c.ID == id {
			return true
		}
	}
	return false
}

// HandleGetMarketCategories lists the categories a market can use.
//
// GET /api/v1/categories
func HandleGetMarketCategories(c *gin.Context) {
	c.JSON(http.StatusOK, marketCategories)
}

// validateMarketCategory rejects categories outside the shared list.
func validateMarketCategory(category string) *AppError {
	if isKnownMarketCategory(category) {
		return nil
	}
	return &AppError{
		StatusCode: http.StatusBadRequest,
		ErrorCode:  "invalid_category",
		Message:    "category must be one of: ai, crypto, macro, science",
	}
}
