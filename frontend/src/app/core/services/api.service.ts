import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    AuthResponse,
    BuyQuoteResponse,
    CashOutRequest,
    CashOutResponse,
    ClaimResponse,
    CreateMarketRequest,
    CreateMarketResponse,
    EditMarketRequest,
    GoogleCallbackRequest,
    GoogleVerifyRequest,
    Market,
    MarketStatus,
    HistoryRange,
    MarketHistoryResponse,
    MarketTrade,
    MarketCategory,
    OrderResponse,
    PlaceOrderRequest,
    PortfolioResponse,
    QuoteRequest,
    ResolveMarketRequest,
    ResolveMarketResponse,
    SellQuoteResponse,
    UserProfile,
    VoidMarketResponse
} from '../models/market.model';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private readonly http = inject(HttpClient);
    private readonly baseUrl = this.resolveBaseUrl();

    private resolveBaseUrl(): string {
        if (typeof window !== 'undefined' && window.location) {
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                return `${window.location.protocol}//${window.location.hostname}:8080/api/v1`;
            }
            return `${window.location.origin}/api/v1`;
        }
        return 'http://localhost:8080/api/v1';
    }

    /**
     * Helper to construct HttpHeaders with optional Bearer auth and Idempotency-Key.
     */
    private buildHeaders(token?: string | null, idempotencyKey?: string): HttpHeaders {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
        if (token) {
            headers = headers.set('Authorization', `Bearer ${token}`);
        }
        if (idempotencyKey) {
            headers = headers.set('Idempotency-Key', idempotencyKey);
        }
        return headers;
    }

    /**
     * Create or retrieve an ephemeral guest trading session.
     */
    createGuestSession(): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.baseUrl}/auth/guest`, {});
    }

    /**
     * Authenticate via Google OAuth ID token (GIS / One Tap or simulation).
     * Optionally passes existing guest token to upgrade session.
     */
    verifyGoogleToken(request: GoogleVerifyRequest, guestToken?: string | null): Observable<AuthResponse> {
        const headers = this.buildHeaders(guestToken);
        return this.http.post<AuthResponse>(`${this.baseUrl}/auth/google/verify`, request, { headers });
    }

    /**
     * Retrieve the Google OAuth 2.0 authorization URL.
     */
    getGoogleAuthUrl(): Observable<{ url: string; state?: string; simulated: boolean; message?: string }> {
        return this.http.get<{ url: string; state?: string; simulated: boolean; message?: string }>(`${this.baseUrl}/auth/google/url`, {
            withCredentials: true
        });
    }

    /**
     * Exchange OAuth 2.0 authorization code and state for a user session.
     */
    callbackGoogleAuth(request: GoogleCallbackRequest, guestToken?: string | null): Observable<AuthResponse> {
        const headers = this.buildHeaders(guestToken);
        return this.http.post<AuthResponse>(`${this.baseUrl}/auth/google/callback`, request, { headers, withCredentials: true });
    }

    /**
     * Get the authenticated user's profile and current balances.
     */
    getCurrentUser(token: string): Observable<UserProfile> {
        const headers = this.buildHeaders(token);
        return this.http.get<UserProfile>(`${this.baseUrl}/auth/me`, { headers });
    }

    /**
     * Fetch active prediction markets, optionally filtered by category.
     */
    getMarkets(category?: string): Observable<Market[]> {
        const url = category && category !== 'all' ? `${this.baseUrl}/markets?category=${encodeURIComponent(category)}` : `${this.baseUrl}/markets`;
        return this.http.get<Market[]>(url);
    }

    /**
     * Fetch markets in every lifecycle status for the admin console, optionally filtered by status.
     */
    getAdminMarkets(token?: string | null, status?: MarketStatus): Observable<Market[]> {
        const headers = this.buildHeaders(token);
        const query = status ? `?status=${encodeURIComponent(status)}` : '';
        return this.http.get<Market[]>(`${this.baseUrl}/admin/markets${query}`, { headers });
    }

    /**
     * Market categories, as defined by the backend. Used by the catalog filter and the admin form.
     */
    getMarketCategories(): Observable<MarketCategory[]> {
        return this.http.get<MarketCategory[]>(`${this.baseUrl}/categories`);
    }

    /**
     * Implied YES probability history of a market, built from recorded trades.
     */
    getMarketHistory(marketId: string, range: HistoryRange): Observable<MarketHistoryResponse> {
        return this.http.get<MarketHistoryResponse>(`${this.baseUrl}/markets/${encodeURIComponent(marketId)}/history?range=${range}`);
    }

    /**
     * Most recent public trades on a market, newest first. Trader identities are not included.
     */
    getMarketTrades(marketId: string, limit = 50): Observable<MarketTrade[]> {
        return this.http.get<MarketTrade[]>(`${this.baseUrl}/markets/${encodeURIComponent(marketId)}/trades?limit=${limit}`);
    }

    /**
     * Fetch a single market by UUID or slug.
     */
    getMarketById(idOrSlug: string): Observable<Market> {
        return this.http.get<Market>(`${this.baseUrl}/markets/${encodeURIComponent(idOrSlug)}`);
    }

    /**
     * Get an authoritative execution quote for BUY/SELL.
     */
    getQuote(marketId: string, request: QuoteRequest, fresh = false): Observable<BuyQuoteResponse> {
        const url = fresh
            ? `${this.baseUrl}/markets/${encodeURIComponent(marketId)}/quote?fresh=true`
            : `${this.baseUrl}/markets/${encodeURIComponent(marketId)}/quote`;
        const headers = fresh ? new HttpHeaders({ 'Cache-Control': 'no-cache' }) : undefined;
        return this.http.post<BuyQuoteResponse>(url, request, { headers });
    }

    /**
     * Get a fresh, uncached authoritative SELL quote for liquidating shares.
     */
    getSellQuote(marketId: string, outcome: 'YES' | 'NO', shares: string): Observable<SellQuoteResponse> {
        const headers = new HttpHeaders({ 'Cache-Control': 'no-cache' });
        return this.http.post<SellQuoteResponse>(
            `${this.baseUrl}/markets/${encodeURIComponent(marketId)}/quote?fresh=true`,
            { action: 'SELL', outcome, shares },
            { headers }
        );
    }

    /**
     * Place an order with mandatory Bearer authentication and unique Idempotency-Key.
     */
    placeOrder(marketId: string, request: PlaceOrderRequest, token: string, idempotencyKey: string): Observable<OrderResponse> {
        const headers = this.buildHeaders(token, idempotencyKey);
        return this.http.post<OrderResponse>(`${this.baseUrl}/markets/${encodeURIComponent(marketId)}/orders`, request, { headers });
    }

    /**
     * Claim testnet USDC.
     */
    claim(token: string, idempotencyKey: string): Observable<ClaimResponse> {
        const headers = this.buildHeaders(token, idempotencyKey);
        return this.http.post<ClaimResponse>(`${this.baseUrl}/claim`, {}, { headers });
    }

    /**
     * Renews the session from the HttpOnly refresh cookie. Sends the cookie explicitly, because the API
     * may be on another origin. Responds with a new access token and rotates the cookie.
     */
    refreshSession(): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.baseUrl}/auth/refresh`, {}, { withCredentials: true });
    }

    /**
     * Ends the refresh session on this device. For a guest account this is permanent.
     */
    endSession(): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true });
    }

    /** Removes profile fields and revokes sessions. Ledger rows are kept. */
    deleteAccount(token: string): Observable<{ status: string; message: string }> {
        const headers = this.buildHeaders(token);
        return this.http.post<{ status: string; message: string }>(
            `${this.baseUrl}/auth/account/delete`,
            { confirm: 'DELETE' },
            { headers, withCredentials: true }
        );
    }

    /**
     * Get portfolio positions and cash balance.
     */
    getPortfolio(token: string): Observable<PortfolioResponse> {
        const headers = this.buildHeaders(token);
        return this.http.get<PortfolioResponse>(`${this.baseUrl}/portfolio`, { headers });
    }

    /**
     * Liquidate outcome shares back to USDC via AMM pool.
     */
    cashOut(request: CashOutRequest, token: string, idempotencyKey: string): Observable<CashOutResponse> {
        const headers = this.buildHeaders(token, idempotencyKey);
        return this.http.post<CashOutResponse>(`${this.baseUrl}/portfolio/cashout`, request, { headers });
    }

    /**
     * Administratively resolve a prediction market and trigger complete-set payout distribution.
     */
    resolveMarket(marketId: string, request: ResolveMarketRequest, token?: string | null, idempotencyKey?: string): Observable<ResolveMarketResponse> {
        const headers = this.buildHeaders(token, idempotencyKey);
        return this.http.post<ResolveMarketResponse>(`${this.baseUrl}/admin/markets/${encodeURIComponent(marketId)}/resolve`, request, { headers });
    }

    /**
     * Verify whether the current user session is authorized as admin.
     */
    verifyAdmin(token?: string | null): Observable<{ status: string; message: string; is_admin?: boolean }> {
        const headers = this.buildHeaders(token);
        return this.http.get<{ status: string; message: string; is_admin?: boolean }>(`${this.baseUrl}/admin/verify`, { headers });
    }

    /**
     * Create a new prediction market with calibrated CPMM liquidity reserves.
     */
    createMarket(request: CreateMarketRequest, token?: string | null): Observable<CreateMarketResponse> {
        const headers = this.buildHeaders(token);
        return this.http.post<CreateMarketResponse>(`${this.baseUrl}/admin/markets`, request, { headers });
    }

    /**
     * Administratively edit an existing prediction market.
     */
    editMarket(marketId: string, request: EditMarketRequest, token?: string | null): Observable<Market> {
        const headers = this.buildHeaders(token);
        return this.http.put<Market>(`${this.baseUrl}/admin/markets/${encodeURIComponent(marketId)}`, request, { headers });
    }

    /**
     * Administratively void a prediction market, refunding every open position at cost basis.
     */
    voidMarket(marketId: string, token: string | null | undefined, idempotencyKey: string): Observable<VoidMarketResponse> {
        const headers = this.buildHeaders(token, idempotencyKey);
        return this.http.post<VoidMarketResponse>(`${this.baseUrl}/admin/markets/${encodeURIComponent(marketId)}/void`, {}, { headers });
    }
}
