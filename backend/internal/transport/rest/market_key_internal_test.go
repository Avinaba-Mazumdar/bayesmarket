package rest

import (
	"testing"

	"github.com/google/uuid"
)

func TestMarketKeyPredicateUsesIndexedColumn(t *testing.T) {
	id := uuid.New()

	pred, arg := marketKeyPredicate("m", " "+id.String()+" ")
	if pred != "m.id = $1" || arg != id {
		t.Errorf("UUID: got %q %v", pred, arg)
	}

	pred, arg = marketKeyPredicate("", "will-fed-cut-rates")
	if pred != "slug = $1" || arg != "will-fed-cut-rates" {
		t.Errorf("slug: got %q %v", pred, arg)
	}
}
