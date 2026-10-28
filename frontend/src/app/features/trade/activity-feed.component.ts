import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideZap, LucideArrowUp, LucideArrowDown } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { formatShares, formatPrice, formatTimestamp } from '../../core/utils/formatters';

import { BadgeComponent } from '../../shared/components/badge/badge.component';

interface FeedRow {
    id: string;
    tradeType: 'BUY' | 'SELL';
    outcome: 'YES' | 'NO';
    shares: string;
    price: string;
    timestamp: string;
}

@Component({
    selector: 'app-activity-feed',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [BadgeComponent, LucideZap, LucideArrowUp, LucideArrowDown],
    template: `
        <div class="activity-feed-card" role="region" aria-label="Live Market Trades Feed">
            <div class="feed-header">
                <div class="header-title-group">
                    <span class="live-indicator" aria-hidden="true"></span>
                    <h4 class="feed-title">Recent Trades</h4>
                </div>
                <span class="feed-count tabular-nums"> {{ filteredTrades().length }} shown </span>
            </div>

            <div class="trades-scroll-container" role="feed" [attr.aria-busy]="historyState() === 'loading'">
                @if (filteredTrades().length === 0) {
                    @if (historyState() === 'loading') {
                        <div class="empty-trades">
                            <p class="empty-text" role="status">Loading recent trades…</p>
                        </div>
                    } @else if (historyState() === 'error') {
                        <div class="empty-trades">
                            <p class="empty-text" role="alert">Recent trades could not be loaded. Refresh the page to try again.</p>
                        </div>
                    } @else {
                        <div class="empty-trades">
                            <svg lucideZap class="empty-icon" [size]="24" aria-hidden="true"></svg>
                            <p class="empty-text">No trades yet on this market.</p>
                            <span class="empty-hint">New trades appear here as they happen.</span>
                        </div>
                    }
                } @else {
                    <div class="trades-list">
                        @for (trade of filteredTrades(); track trade.id) {
                            <article class="trade-item">
                                <div class="trade-main">
                                    <app-badge [variant]="trade.outcome === 'YES' ? 'profit' : 'loss'" size="sm">
                                        @if (trade.outcome === 'YES') {
                                            <svg lucideArrowUp class="trade-badge-icon" [size]="12" aria-hidden="true"></svg>
                                        } @else {
                                            <svg lucideArrowDown class="trade-badge-icon" [size]="12" aria-hidden="true"></svg>
                                        }
                                        {{ trade.tradeType === 'BUY' ? 'Bought' : 'Sold' }} {{ trade.outcome }}
                                    </app-badge>
                                    <span class="trade-amount tabular-nums"> {{ trade.formattedShares }} shares </span>
                                </div>
                                <div class="trade-details">
                                    <span class="trade-price tabular-nums"> at {{ '$' + trade.formattedPrice }} </span>
                                    <span class="trade-time tabular-nums">
                                        {{ trade.formattedTime }}
                                    </span>
                                </div>
                            </article>
                        }
                    </div>
                }
            </div>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
            }

            .activity-feed-card {
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-xl);
                padding: 18px 20px;
                display: flex;
                flex-direction: column;
                gap: 14px;
                contain: layout style paint;
            }

            .feed-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid var(--hairline);
                padding-bottom: 12px;
            }

            .header-title-group {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .live-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background-color: var(--outcome-yes);
                box-shadow: 0 0 8px var(--outcome-yes-glow);
                will-change: opacity;
                animation: pulseLive 2.5s ease-in-out infinite;
            }

            @keyframes pulseLive {
                0%,
                100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.4;
                }
            }

            .feed-title {
                font-family: var(--font-ui);
                font-size: 15px;
                font-weight: 700;
                color: var(--ink);
                margin: 0;
            }

            .feed-count {
                font-family: var(--font-mono);
                font-size: 11.5px;
                font-weight: 600;
                color: var(--muted);
            }

            .trades-scroll-container {
                max-height: 380px;
                overflow-y: auto;
                overscroll-behavior: contain;
                contain: layout style;
            }

            .trades-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .trade-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background-color: var(--canvas-subtle);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                font-size: 13px;
                transition: background-color 0.12s ease;
            }

            .trade-item:hover,
            .trade-item:focus-visible {
                background-color: var(--surface-card);
                border-color: var(--primary-border);
                outline: none;
            }

            .trade-main {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .trade-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 7px;
                border-radius: var(--radius-sm);
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }

            .trade-badge-icon {
                flex-shrink: 0;
            }

            .trade-yes {
                background-color: var(--outcome-yes-subtle);
                color: var(--outcome-yes-text);
                border: 1px solid var(--outcome-yes-border);
            }

            .trade-no {
                background-color: var(--outcome-no-subtle);
                color: var(--outcome-no-text);
                border: 1px solid var(--outcome-no-border);
            }

            .trade-amount {
                font-family: var(--font-mono);
                font-weight: 600;
                color: var(--ink);
            }

            .trade-details {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .trade-price {
                font-family: var(--font-mono);
                color: var(--muted);
                font-size: 12px;
            }

            .trade-time {
                font-family: var(--font-ui);
                font-size: 11px;
                color: var(--muted);
            }

            .empty-trades {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 28px 16px;
                text-align: center;
                gap: 6px;
            }

            .empty-icon {
                color: var(--status-warning);
                flex-shrink: 0;
                margin-bottom: 2px;
            }

            .empty-text {
                font-family: var(--font-ui);
                font-size: 13.5px;
                color: var(--ink-secondary);
                margin: 0;
            }

            .empty-hint {
                font-family: var(--font-ui);
                font-size: 11.5px;
                color: var(--muted);
            }
        `
    ]
})
export class ActivityFeedComponent {
    readonly marketId = input<string>('');
    private readonly wsService = inject(WebSocketService);
    private readonly apiService = inject(ApiService);
    private readonly destroyRef = inject(DestroyRef);

    /** Recorded trades from the REST API; live trades are merged in from the WebSocket. */
    readonly historyState = signal<'loading' | 'ready' | 'error'>('loading');
    private readonly recordedRows = signal<FeedRow[]>([]);
    private requestSeq = 0;

    constructor() {
        effect(() => {
            const id = this.marketId();
            untracked(() => this.loadRecent(id));
        });
    }

    protected readonly filteredTrades = computed(() => {
        const id = this.marketId();
        const live: FeedRow[] = this.wsService
            .recentTrades()
            .filter((t) => !id || !t.market_id || t.market_id === id)
            .map((t) => ({
                id: t.trade_id,
                tradeType: t.trade_type,
                outcome: t.outcome,
                shares: t.shares,
                price: t.price,
                timestamp: t.timestamp
            }));

        const seen = new Set<string>();
        return [...live, ...this.recordedRows()]
            .filter((row) => {
                if (seen.has(row.id)) return false;
                seen.add(row.id);
                return true;
            })
            .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
            .slice(0, 15)
            .map((row) => ({
                ...row,
                formattedShares: formatShares(row.shares),
                formattedPrice: formatPrice(row.price, 4).replace('$', ''),
                formattedTime: formatTimestamp(row.timestamp)
            }));
    });

    private loadRecent(id: string): void {
        if (!id) return;
        const seq = ++this.requestSeq;
        this.recordedRows.set([]);
        this.historyState.set('loading');
        this.apiService
            .getMarketTrades(id, 15)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (trades) => {
                    if (seq !== this.requestSeq) return;
                    this.recordedRows.set(
                        trades.map((t) => ({
                            id: t.id,
                            tradeType: t.trade_type,
                            outcome: t.outcome,
                            shares: t.shares_filled,
                            price: t.execution_price,
                            timestamp: t.created_at
                        }))
                    );
                    this.historyState.set('ready');
                },
                error: () => {
                    if (seq === this.requestSeq) this.historyState.set('error');
                }
            });
    }
}
