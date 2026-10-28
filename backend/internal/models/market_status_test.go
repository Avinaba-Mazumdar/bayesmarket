package models

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

// marketStatusUnion matches the MarketStatus type in the Angular client's model file.
var marketStatusUnion = regexp.MustCompile(`export type MarketStatus = ([^;]+);`)

// quotedStatus matches one string literal in that union.
var quotedStatus = regexp.MustCompile(`'([a-z_]+)'`)

// TestMarketStatusesMatchFrontendUnion keeps the statuses the API returns in step with the MarketStatus
// union that the frontend compiles against. A status added to one side only fails this test.
func TestMarketStatusesMatchFrontendUnion(t *testing.T) {
	path := filepath.Join("..", "..", "..", "frontend", "src", "app", "core", "models", "market.model.ts")
	src, err := os.ReadFile(path)
	if err != nil {
		t.Skipf("frontend model file not available: %v", err)
	}

	match := marketStatusUnion.FindSubmatch(src)
	if match == nil {
		t.Fatal("MarketStatus union not found in market.model.ts")
	}

	var fromFrontend []string
	for _, lit := range quotedStatus.FindAllSubmatch(match[1], -1) {
		fromFrontend = append(fromFrontend, string(lit[1]))
	}

	var fromAPI []string
	for _, status := range APIMarketStatuses {
		fromAPI = append(fromAPI, string(status))
	}

	sort.Strings(fromFrontend)
	sort.Strings(fromAPI)
	if strings.Join(fromAPI, ",") != strings.Join(fromFrontend, ",") {
		t.Fatalf("API statuses %v do not match frontend MarketStatus %v", fromAPI, fromFrontend)
	}
}
