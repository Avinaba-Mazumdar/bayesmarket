import { Injectable, OnDestroy, signal } from '@angular/core';
import { ConnectionStatus, MarketResolvedEvent, PriceUpdateEvent, TradeEvent, WebSocketMessage } from '../models/websocket.model';

@Injectable({
    providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
    // Backoff intervals in milliseconds: 1s, 2s, 5s, 10s (capped at 10s)
    private readonly backoffDelays = [1000, 2000, 5000, 10000];
    private reconnectAttempt = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private socket: WebSocket | null = null;
    private manuallyClosed = false;

    // Maximum rolling trades buffer
    private readonly maxTradesHistory = 50;

    // Angular Signals for fine-grained zoneless reactivity
    readonly isConnected = signal<boolean>(false);
    readonly connectionStatus = signal<ConnectionStatus>('disconnected');
    readonly lastPriceTick = signal<PriceUpdateEvent | null>(null);
    readonly recentTrades = signal<TradeEvent[]>([]);
    readonly lastMarketResolved = signal<MarketResolvedEvent | null>(null);
    readonly activeMarketId = signal<string | null>(null);

    /**
     * User-controlled stream pause/mute toggle satisfying WCAG 2.2 SC 2.2.4 (Interruptions).
     * When paused, real-time telemetry is suppressed from updating reactive signals to prevent
     * screen reader focus theft or layout disruptions for sensitive traders.
     */
    readonly isPaused = signal<boolean>(false);

    /**
     * Connect to the BayesMarket WebSocket broker.
     *
     * @param marketId Optional market UUID. If omitted, subscribes to the global stream.
     * @param wsBaseUrl Optional custom WebSocket base URL (defaults to window location or ws://localhost:8080)
     */
    connect(marketId?: string, wsBaseUrl?: string): void {
        this.disconnect();
        this.manuallyClosed = false;
        this.activeMarketId.set(marketId ?? null);
        this.connectionStatus.set('connecting');

        const url = this.buildWebSocketUrl(marketId, wsBaseUrl);
        this.initiateSocket(url);
    }

    /**
     * Closes active WebSocket connection and halts reconnection timers.
     */
    disconnect(): void {
        this.manuallyClosed = true;
        this.clearReconnectTimer();

        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.onmessage = null;
            this.socket.close();
            this.socket = null;
        }

        this.isConnected.set(false);
        this.connectionStatus.set('disconnected');
    }

    /**
     * Toggles stream pause state (WCAG 2.2 SC 2.2.4 Interruptions).
     */
    togglePause(): boolean {
        const next = !this.isPaused();
        this.isPaused.set(next);
        return next;
    }

    /**
     * Explicitly sets stream pause state.
     */
    setPaused(paused: boolean): void {
        this.isPaused.set(paused);
    }

    /**
     * Clears accumulated trade history.
     */
    clearTrades(): void {
        this.recentTrades.set([]);
    }

    private initiateSocket(url: string): void {
        try {
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                this.reconnectAttempt = 0;
                this.isConnected.set(true);
                this.connectionStatus.set('connected');
            };

            this.socket.onmessage = (event: MessageEvent<string>) => {
                this.handleIncomingMessage(event.data);
            };

            this.socket.onerror = (error: Event) => {
                console.warn('[WS] WebSocket error encountered:', error);
            };

            this.socket.onclose = () => {
                this.isConnected.set(false);
                if (!this.manuallyClosed) {
                    this.scheduleReconnect(url);
                } else {
                    this.connectionStatus.set('disconnected');
                }
            };
        } catch (err) {
            console.error('[WS] Connection establishment failed:', err);
            this.scheduleReconnect(url);
        }
    }

    private handleIncomingMessage(raw: string): void {
        // If stream is paused by user (WCAG 2.2 SC 2.2.4), suppress signal updates
        if (this.isPaused()) {
            return;
        }

        try {
            const msg = JSON.parse(raw) as WebSocketMessage;
            if (!msg || !msg.type) {
                return;
            }

            switch (msg.type) {
                case 'PRICE_UPDATE': {
                    const currentTick = this.lastPriceTick();
                    if (!currentTick || currentTick.yes_price !== msg.yes_price || currentTick.market_id !== msg.market_id) {
                        this.lastPriceTick.set(msg);
                    }
                    break;
                }

                case 'TRADE_EVENT':
                    this.recentTrades.update((prev) => [msg, ...prev.slice(0, this.maxTradesHistory - 1)]);
                    break;

                case 'MARKET_RESOLVED':
                    this.lastMarketResolved.set(msg);
                    break;
            }
        } catch (e) {
            console.warn('[WS] Failed to parse WebSocket message frame:', e, raw);
        }
    }

    private scheduleReconnect(url: string): void {
        this.connectionStatus.set('reconnecting');
        const delay = this.backoffDelays[Math.min(this.reconnectAttempt, this.backoffDelays.length - 1)];
        this.reconnectAttempt++;

        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            if (!this.manuallyClosed) {
                this.initiateSocket(url);
            }
        }, delay);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private buildWebSocketUrl(marketId?: string, customBaseUrl?: string): string {
        let base = customBaseUrl;
        if (!base) {
            if (typeof window !== 'undefined' && window.location) {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                // If frontend is on localhost:4200, point to default Go backend port 8080
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    base = `${protocol}//${window.location.hostname}:8080`;
                } else if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('avinaba.com')) {
                    base = 'wss://bayesmarket-oss.onrender.com';
                } else {
                    base = `${protocol}//${window.location.host}`;
                }
            } else {
                base = 'ws://localhost:8080';
            }
        }

        if (marketId && marketId !== 'all') {
            return `${base}/ws/markets/${marketId}`;
        }
        return `${base}/ws/markets`;
    }

    ngOnDestroy(): void {
        this.disconnect();
    }
}
