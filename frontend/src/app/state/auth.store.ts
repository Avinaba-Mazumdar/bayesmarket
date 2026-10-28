import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../shared/components/toast/toast.service';
import { AuthResponse, UserProfile } from '../core/models/market.model';
import { formatUsd, normalizeDecimal, roundDecimal } from '../core/utils/decimal';
import { newIdempotencyKey } from '../core/utils/idempotency';

const TOKEN_STORAGE_KEY = 'bayesmarket_auth_token';
const LEGACY_TOKEN_STORAGE_KEY = 'bayesmarket_guest_token';
const USER_PROFILE_STORAGE_KEY = 'bayesmarket_auth_profile';
const BALANCE_STORAGE_KEY = 'bayesmarket_user_balance';

@Injectable({
    providedIn: 'root'
})
export class AuthStore {
    private readonly apiService = inject(ApiService);
    private readonly toastService = inject(ToastService);

    readonly token = signal<string | null>(this.getInitialToken());
    readonly user = signal<UserProfile | null>(this.getInitialProfile());
    readonly userId = signal<string | null>(this.getInitialProfile()?.id || null);
    /**
     * Canonical decimal balance from the server (e.g. "1000.00000000"). All balance checks and
     * post-trade estimates must use this, never the display string.
     */
    readonly cashBalanceRaw = signal<string>(this.readInitialBalanceRaw());
    /** Display form of cashBalanceRaw, truncated to cents. Never parse it back into a number. */
    readonly cashBalance = signal<string>(formatUsd(this.cashBalanceRaw()));

    readonly isGuest = computed(() => this.user()?.is_guest ?? false);
    readonly isAdmin = computed(() => this.user()?.is_admin ?? false);
    readonly isSuperadmin = computed(() => this.isAdmin());
    readonly isAuthenticated = computed(() => !!this.token() && !!this.user());
    readonly authProvider = computed(() => this.user()?.auth_provider || 'none');
    readonly userName = computed(() => this.user()?.name || (this.isGuest() ? 'Guest Trader' : this.isAuthenticated() ? 'Verified Trader' : 'Visitor'));
    readonly userEmail = computed(() => this.user()?.email || null);
    readonly userAvatar = computed(() => this.user()?.avatar_url || null);

    readonly isInitializing = signal<boolean>(false);
    readonly isAuthenticating = signal<boolean>(false);
    readonly isClaiming = signal<boolean>(false);
    private refreshInFlight = false;
    /** Kept across retries of one claim attempt; cleared once the claim succeeds or the cooldown answers. */
    private claimKey: string | null = null;
    /** Seconds until the next claim is allowed, from the server's cooldown. Zero when claimable. */
    readonly claimCooldownSeconds = signal<number>(0);
    private claimCooldownTimer: ReturnType<typeof setInterval> | null = null;
    readonly isAuthModalOpen = signal<boolean>(false);

    readonly isDev = signal<boolean>(typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

    constructor() {
        this.initializeSession();
    }

    private getInitialToken(): string | null {
        if (typeof window !== 'undefined') {
            if (window.sessionStorage) {
                const sessionToken = sessionStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
                if (sessionToken) return sessionToken;
            }
            if (window.localStorage) {
                const localToken = localStorage.getItem(TOKEN_STORAGE_KEY) || localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
                if (localToken) {
                    // Migrate to sessionStorage and purge from localStorage to eliminate long-term disk exposure
                    if (window.sessionStorage) {
                        sessionStorage.setItem(TOKEN_STORAGE_KEY, localToken);
                    }
                    localStorage.removeItem(TOKEN_STORAGE_KEY);
                    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
                    return localToken;
                }
            }
        }
        return null;
    }

    private getInitialProfile(): UserProfile | null {
        if (typeof window !== 'undefined') {
            let raw: string | null = null;
            if (window.sessionStorage) {
                raw = sessionStorage.getItem(USER_PROFILE_STORAGE_KEY);
            }
            if (!raw && window.localStorage) {
                raw = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
                if (raw) {
                    if (window.sessionStorage) {
                        sessionStorage.setItem(USER_PROFILE_STORAGE_KEY, raw);
                    }
                    localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
                }
            }
            if (raw) {
                try {
                    return JSON.parse(raw);
                } catch {
                    return null;
                }
            }
        }
        return null;
    }

    private readInitialBalanceRaw(): string {
        // Older sessions stored the formatted display string; strip it back to digits
        const cleaned = this.getInitialBalance().replace(/[$,]/g, '');
        return normalizeDecimal(cleaned, 8) ?? '0.00000000';
    }

    private getInitialBalance(): string {
        if (typeof window !== 'undefined') {
            if (window.sessionStorage) {
                const bal = sessionStorage.getItem(BALANCE_STORAGE_KEY);
                if (bal) return bal;
            }
            if (window.localStorage) {
                const bal = localStorage.getItem(BALANCE_STORAGE_KEY);
                if (bal) {
                    if (window.sessionStorage) {
                        sessionStorage.setItem(BALANCE_STORAGE_KEY, bal);
                    }
                    localStorage.removeItem(BALANCE_STORAGE_KEY);
                    return bal;
                }
            }
            const token = this.getInitialToken();
            if (token) {
                return '$1,000.00';
            }
            return '$0.00';
        }
        return '$0.00';
    }

    /**
     * Initializes or verifies session (Google or Guest).
     * Does NOT automatically create guest sessions for first-time visitors.
     */
    initializeSession(): void {
        const existingToken = this.token();
        if (existingToken) {
            // Verify session by fetching user profile and portfolio balance
            this.fetchCurrentUserProfile(existingToken);
        } else {
            // No access token in this tab: the refresh cookie may still hold a session from earlier
            this.restoreSession();
        }
    }

    private fetchCurrentUserProfile(token: string): void {
        if (!this.apiService || typeof this.apiService.getCurrentUser !== 'function') {
            this.isInitializing.set(false);
            return;
        }
        this.isInitializing.set(true);
        this.apiService.getCurrentUser(token).subscribe({
            next: (profile) => {
                if (profile) {
                    this.user.set(profile);
                    this.userId.set(profile.id);
                    this.updateBalance(profile.cash_balance ?? '1000.00');
                    this.persistSession(token, profile);
                }
                this.isInitializing.set(false);
            },
            error: (err) => {
                // An expired access token is renewed from the refresh cookie; if that fails, the session is cleared
                if (err?.status === 401 || err?.status === 404) {
                    this.restoreSession();
                }
                this.isInitializing.set(false);
            }
        });
    }

    /**
     * Explicitly provisions a fresh guest session seeded with 1,000 USD on user request.
     */
    continueAsGuest(onSuccess?: () => void): void {
        if (!this.apiService || typeof this.apiService.createGuestSession !== 'function') {
            return;
        }
        this.isInitializing.set(true);
        this.apiService.createGuestSession().subscribe({
            next: (res) => {
                if (res && res.user) {
                    this.token.set(res.token);
                    this.user.set(res.user);
                    this.userId.set(res.user.id);
                    this.updateBalance(res.user.cash_balance ?? '1000.00');
                    this.persistSession(res.token, res.user);
                    this.closeAuthModal();
                    this.toastService.success('Guest Session Active', 'Gifted $1,000.00 virtual USDC for paper trading!');
                    if (onSuccess) onSuccess();
                }
                this.isInitializing.set(false);
            },
            error: (err) => {
                console.error('Failed to provision guest session:', err);
                this.isInitializing.set(false);
                this.toastService.error('Session Error', 'Could not start guest session. Please try again.');
            }
        });
    }

    /**
     * Provisions a fresh anonymous guest session (internal).
     */
    provisionNewGuestSession(): void {
        this.continueAsGuest();
    }

    /**
     * Authenticates with Google via ID Token.
     */
    loginWithGoogle(idToken: string, email?: string, name?: string): void {
        this.isAuthenticating.set(true);
        const guestToken = this.isGuest() ? this.token() : null;

        this.apiService.verifyGoogleToken({ id_token: idToken, email, name }, guestToken).subscribe({
            next: (res) => {
                if (res && res.user) {
                    this.token.set(res.token);
                    this.user.set(res.user);
                    this.userId.set(res.user.id);
                    this.updateBalance(res.user.cash_balance ?? '1000.00');
                    this.persistSession(res.token, res.user);
                }
                this.isAuthenticating.set(false);
                this.isAuthModalOpen.set(false);

                this.toastService.success('Signed in with Google', `Welcome, ${res.user.name || res.user.email || 'Trader'}! Your account is connected.`);
            },
            error: (err) => {
                this.isAuthenticating.set(false);
                const msg = err?.error?.message || 'Failed to authenticate with Google';
                this.toastService.error('Authentication Error', msg);
            }
        });
    }

    /**
     * Completes OAuth 2.0 redirect flow by exchanging code and state.
     */
    loginWithGoogleCallback(code: string, state?: string): Observable<AuthResponse> {
        this.isAuthenticating.set(true);
        const guestToken = this.isGuest() ? this.token() : null;

        return this.apiService.callbackGoogleAuth({ code, state }, guestToken).pipe(
            tap({
                next: (res) => {
                    if (res && res.user) {
                        this.token.set(res.token);
                        this.user.set(res.user);
                        this.userId.set(res.user.id);
                        this.updateBalance(res.user.cash_balance ?? '1000.00');
                        this.persistSession(res.token, res.user);
                    }
                    this.isAuthenticating.set(false);
                    this.isAuthModalOpen.set(false);
                    this.toastService.success('Signed in with Google', `Welcome, ${res.user.name || res.user.email || 'Trader'}! Your account is connected.`);
                },
                error: (err) => {
                    this.isAuthenticating.set(false);
                    const msg = err?.error?.message || 'Failed to authenticate with Google';
                    this.toastService.error('Authentication Error', msg);
                }
            })
        );
    }

    /**
     * Logs out of account and reverts to unauthenticated surfing state.
     */
    logout(): void {
        // Revoke the refresh session first; otherwise the next page load would sign the reader straight back in
        this.apiService.endSession().subscribe({ error: () => undefined });
        this.clearSession();
        this.toastService.info('Signed Out', 'You have been signed out.');
    }

    /**
     * Synchronizes balance with the backend.
     */
    refreshBalance(): void {
        const token = this.token();
        if (!token) return;

        this.apiService.getPortfolio(token).subscribe({
            next: (portfolio) => {
                this.updateBalance(portfolio.cash_balance || portfolio.cash_balance_usdc || '0');
            },
            error: (err) => {
                if (err?.status === 401 || err?.status === 404) {
                    this.restoreSession();
                }
            }
        });
    }

    /**
     * Restores the session from the refresh cookie. Concurrent calls share one request: a second refresh
     * with the same cookie would look like a replayed token to the server and end every session.
     */
    restoreSession(): void {
        if (this.refreshInFlight) return;
        this.refreshInFlight = true;
        this.apiService.refreshSession().subscribe({
            next: (res) => {
                this.refreshInFlight = false;
                this.token.set(res.token);
                this.user.set(res.user);
                this.userId.set(res.user.id);
                this.updateBalance(res.user.cash_balance ?? '0');
                this.persistSession(res.token, res.user);
                this.isInitializing.set(false);
            },
            error: () => {
                this.refreshInFlight = false;
                this.clearSession();
                this.isInitializing.set(false);
            }
        });
    }

    /**
     * Sets the cash balance from the server's canonical decimal string and persists it. The display
     * form is derived from the same value.
     */
    updateBalance(rawBalance: string): void {
        const raw = normalizeDecimal(rawBalance, 8);
        if (raw === null) return;
        this.cashBalanceRaw.set(raw);
        this.cashBalance.set(formatUsd(raw));
        if (typeof window !== 'undefined') {
            if (window.sessionStorage) {
                sessionStorage.setItem(BALANCE_STORAGE_KEY, raw);
            }
            if (window.localStorage) {
                localStorage.removeItem(BALANCE_STORAGE_KEY);
            }
        }
    }

    /**
     * Claims testnet funds.
     */
    claim(): void {
        const token = this.token();
        if (!token) {
            this.toastService.error('Session Error', 'Session not ready');
            return;
        }

        this.isClaiming.set(true);
        this.claimKey ??= newIdempotencyKey('claim');
        this.apiService.claim(token, this.claimKey).subscribe({
            next: (res) => {
                const rawBalance = res.new_balance ?? res.user?.cash_balance ?? '0';
                this.updateBalance(rawBalance);

                const currentUser = this.user();
                if (currentUser) {
                    const updatedProfile = { ...currentUser, cash_balance: rawBalance };
                    this.user.set(updatedProfile);
                    if (typeof window !== 'undefined') {
                        if (window.sessionStorage) {
                            sessionStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(updatedProfile));
                        }
                        if (window.localStorage) {
                            localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
                        }
                    }
                }

                this.isClaiming.set(false);
                this.claimCooldownSeconds.set(0);
                this.claimKey = null;
                const claimedAmount = (res.amount_claimed ? roundDecimal(res.amount_claimed, 0) : null) ?? res.amount ?? '100';
                this.toastService.success('Claim Successful', `+$${claimedAmount} USDC credited to your balance`);
            },
            error: (err) => {
                this.isClaiming.set(false);
                const retryIn = Number(err?.error?.cooldown_remaining_seconds);
                if (err?.status === 429 && Number.isFinite(retryIn) && retryIn > 0) {
                    this.startClaimCooldown(Math.ceil(retryIn));
                    this.claimKey = null;
                }
                if (err?.status === 401 || err?.status === 404) {
                    this.clearSession();
                    this.toastService.error('Session Expired', 'Your session is no longer valid. Please sign in again.');
                    return;
                }
                const msg = err?.error?.message || 'Claim cooldown in effect or request rate exceeded';
                this.toastService.warning('Claim Cooldown', msg);
            }
        });
    }

    /** Counts the claim cooldown down once a second; the header shows it and disables the claim button. */
    private startClaimCooldown(seconds: number): void {
        this.stopClaimCooldown();
        this.claimCooldownSeconds.set(seconds);
        this.claimCooldownTimer = setInterval(() => {
            const left = this.claimCooldownSeconds() - 1;
            this.claimCooldownSeconds.set(Math.max(0, left));
            if (left <= 0) this.stopClaimCooldown();
        }, 1000);
    }

    private stopClaimCooldown(): void {
        if (this.claimCooldownTimer !== null) {
            clearInterval(this.claimCooldownTimer);
            this.claimCooldownTimer = null;
        }
    }

    openAuthModal(): void {
        this.isAuthModalOpen.set(true);
    }

    closeAuthModal(): void {
        this.isAuthModalOpen.set(false);
    }

    private persistSession(token: string, profile: UserProfile): void {
        if (typeof window !== 'undefined') {
            if (window.sessionStorage) {
                sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
                sessionStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
            }
            // Clear any lingering localStorage records to mitigate XSS exposure
            if (window.localStorage) {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
                localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
                localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
            }
        }
    }

    private clearSession(): void {
        if (typeof window !== 'undefined') {
            if (window.sessionStorage) {
                sessionStorage.removeItem(TOKEN_STORAGE_KEY);
                sessionStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
                sessionStorage.removeItem(USER_PROFILE_STORAGE_KEY);
                sessionStorage.removeItem(BALANCE_STORAGE_KEY);
            }
            if (window.localStorage) {
                localStorage.removeItem(TOKEN_STORAGE_KEY);
                localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
                localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
                localStorage.removeItem(BALANCE_STORAGE_KEY);
            }
        }
        this.token.set(null);
        this.user.set(null);
        this.userId.set(null);
        this.cashBalance.set('$0.00');
    }

    formatBalance(raw: string | number): string {
        return formatUsd(String(raw));
    }
}
