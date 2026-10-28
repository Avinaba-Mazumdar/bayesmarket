package rest

import (
	"strings"
	"sync"
	"time"

	"github.com/bayesmarket/bayesmarket/internal/amm"
	"github.com/google/uuid"
)

type cachedMarketItem struct {
	marketUUID     uuid.UUID
	id             string
	slug           string
	summary        MarketSummaryResponse
	reserves       amm.PoolReserves
	status         string
	resolutionDate time.Time
	expiresAt      time.Time
}

// QuoteState is the cached market state needed to price a quote: reserves plus the
// tradability fields that must be re-checked on every cache hit.
type QuoteState struct {
	MarketUUID     uuid.UUID
	Reserves       amm.PoolReserves
	Status         string
	ResolutionDate time.Time
}

type cachedMarketList struct {
	markets   []MarketSummaryResponse
	expiresAt time.Time
}

// MarketCache provides an in-memory, thread-safe read-through cache for prediction markets
// and pool reserves, reducing remote PostgreSQL round-trips for high-frequency quote calculations
// and discovery queries.
type MarketCache struct {
	mu         sync.RWMutex
	items      map[string]*cachedMarketItem // keyed by both uuid string and slug
	lists      map[string]*cachedMarketList // keyed by category string ("" for all)
	defaultTTL time.Duration
}

// NewMarketCache initializes a new in-memory market cache with a default TTL.
func NewMarketCache(defaultTTL time.Duration) *MarketCache {
	return &MarketCache{
		items:      make(map[string]*cachedMarketItem),
		lists:      make(map[string]*cachedMarketList),
		defaultTTL: defaultTTL,
	}
}

// GetMarkets returns cached market list if valid.
func (c *MarketCache) GetMarkets(category string) ([]MarketSummaryResponse, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	normalizedCat := strings.ToLower(strings.TrimSpace(category))
	cached, ok := c.lists[normalizedCat]
	if !ok || time.Now().After(cached.expiresAt) {
		return nil, false
	}

	// Return a defensive shallow copy
	result := make([]MarketSummaryResponse, len(cached.markets))
	copy(result, cached.markets)
	return result, true
}

// SetMarkets stores market list in cache.
func (c *MarketCache) SetMarkets(category string, markets []MarketSummaryResponse) {
	c.mu.Lock()
	defer c.mu.Unlock()

	normalizedCat := strings.ToLower(strings.TrimSpace(category))
	c.lists[normalizedCat] = &cachedMarketList{
		markets:   markets,
		expiresAt: time.Now().Add(c.defaultTTL),
	}
}

// GetMarket returns a cached market summary and pool reserves.
func (c *MarketCache) GetMarket(idOrSlug string) (*MarketSummaryResponse, *amm.PoolReserves, *uuid.UUID, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	key := strings.TrimSpace(idOrSlug)
	item, ok := c.items[key]
	if !ok || time.Now().After(item.expiresAt) {
		return nil, nil, nil, false
	}

	var summaryPtr *MarketSummaryResponse
	if item.summary.Title != "" {
		summaryCopy := item.summary
		summaryPtr = &summaryCopy
	}

	reservesCopy := item.reserves
	uuidCopy := item.marketUUID
	return summaryPtr, &reservesCopy, &uuidCopy, true
}

// GetQuoteState returns cached reserves with the market's status and resolution date.
func (c *MarketCache) GetQuoteState(idOrSlug string) (QuoteState, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, ok := c.items[strings.TrimSpace(idOrSlug)]
	if !ok || time.Now().After(item.expiresAt) || item.status == "" {
		return QuoteState{}, false
	}
	return QuoteState{
		MarketUUID:     item.marketUUID,
		Reserves:       item.reserves,
		Status:         item.status,
		ResolutionDate: item.resolutionDate,
	}, true
}

// SetMarket stores individual market details and pool reserves by both ID and Slug.
func (c *MarketCache) SetMarket(id, slug string, summary MarketSummaryResponse, reserves amm.PoolReserves, marketUUID uuid.UUID) {
	c.mu.Lock()
	defer c.mu.Unlock()

	resolutionDate, _ := time.Parse(time.RFC3339, summary.ResolutionDate)
	expiresAt := time.Now().Add(c.defaultTTL)
	item := &cachedMarketItem{
		marketUUID:     marketUUID,
		id:             id,
		slug:           slug,
		summary:        summary,
		reserves:       reserves,
		status:         summary.Status,
		resolutionDate: resolutionDate,
		expiresAt:      expiresAt,
	}

	if id != "" {
		c.items[id] = item
	}
	if slug != "" {
		c.items[slug] = item
	}
}

// SetReserves updates or initializes pool reserves and tradability state without overwriting
// existing summary metadata.
func (c *MarketCache) SetReserves(id, slug string, reserves amm.PoolReserves, marketUUID uuid.UUID, status string, resolutionDate time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()

	expiresAt := time.Now().Add(c.defaultTTL)

	var summary MarketSummaryResponse
	if existing, ok := c.items[id]; ok && existing.summary.Title != "" {
		summary = existing.summary
	} else if existing, ok := c.items[slug]; ok && existing.summary.Title != "" {
		summary = existing.summary
	}

	item := &cachedMarketItem{
		marketUUID:     marketUUID,
		id:             id,
		slug:           slug,
		summary:        summary,
		reserves:       reserves,
		status:         status,
		resolutionDate: resolutionDate,
		expiresAt:      expiresAt,
	}

	if id != "" {
		c.items[id] = item
	}
	if slug != "" {
		c.items[slug] = item
	}
}

// GetMarketUUIDreturns the canonical UUID for a given market ID or slug if cached.
func (c *MarketCache) GetMarketUUID(idOrSlug string) (uuid.UUID, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	key := strings.TrimSpace(idOrSlug)
	if item, ok := c.items[key]; ok && time.Now().Before(item.expiresAt) {
		return item.marketUUID, true
	}
	return uuid.Nil, false
}

// Invalidate removes cached entries for a specific market and resets market listings.
func (c *MarketCache) Invalidate(marketIDOrSlug string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	key := strings.TrimSpace(marketIDOrSlug)
	if item, exists := c.items[key]; exists {
		delete(c.items, item.id)
		delete(c.items, item.slug)
	} else {
		delete(c.items, key)
	}

	// Also invalidate market discovery lists so new prices/volumes reflect immediately
	c.lists = make(map[string]*cachedMarketList)
}

// InvalidateAll completely flushes the market cache.
func (c *MarketCache) InvalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*cachedMarketItem)
	c.lists = make(map[string]*cachedMarketList)
}
