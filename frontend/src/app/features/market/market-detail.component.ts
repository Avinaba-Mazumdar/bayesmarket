import {
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    inject,
    input,
    OnDestroy,
    OnInit,
    signal,
    untracked,
    viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideArrowLeft, LucideArrowUp, LucideArrowDown, LucideCircleCheck } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { PriceUpdateEvent } from '../../core/models/websocket.model';
import { WebSocketService } from '../../core/services/websocket.service';
import { Market, OrderResponse, UserPosition } from '../../core/models/market.model';
import { AuthStore } from '../../state/auth.store';
import { CashOutDialogComponent } from '../portfolio/cash-out-dialog.component';
import { formatUSDC, formatShares } from '../../core/utils/formatters';
import { PriceChartComponent } from '../charts/price-chart.component';
import { OrderIntent, OrderTerminalComponent } from '../terminal/order-terminal.component';
import { OrderConfirmDialogComponent } from '../terminal/order-confirm-dialog.component';
import { ActivityFeedComponent } from '../trade/activity-feed.component';
import { GlossaryPopoverComponent } from './glossary-popover.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { roundDecimal, shiftDecimal } from '../../core/utils/decimal';

@Component({
    selector: 'app-market-detail',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        PriceChartComponent,
        OrderTerminalComponent,
        CashOutDialogComponent,
        OrderConfirmDialogComponent,
        ActivityFeedComponent,
        GlossaryPopoverComponent,
        BadgeComponent,
        ButtonComponent,
        LucideArrowLeft,
        LucideArrowUp,
        LucideArrowDown,
        LucideCircleCheck
    ],
    template: `
        <div class="cockpit-container">
            @if (isLoading()) {
                <div class="loading-container" role="status">
                    <div class="spinner" aria-hidden="true"></div>
                    <p>Loading trading cockpit...</p>
                </div>
            } @else if (!market()) {
                <div class="error-container" role="alert">
                    <h2>Market Not Found</h2>
                    <p>The requested prediction market could not be retrieved.</p>
                    <app-button variant="primary" size="default" routerLink="/"> Back to Markets </app-button>
                </div>
            } @else {
                <!-- Breadcrumb & Top Metadata Bar -->
                <nav class="breadcrumb-bar" aria-label="Market navigation breadcrumbs">
                    <a routerLink="/" class="breadcrumb-link">
                        <svg lucideArrowLeft [size]="14" aria-hidden="true"></svg>
                        <span>All Markets</span>
                    </a>
                    <span class="breadcrumb-separator" aria-hidden="true">/</span>
                    <app-badge variant="outline" size="sm">{{ market()!.category.toUpperCase() }}</app-badge>
                    <span class="breadcrumb-separator" aria-hidden="true">/</span>
                    <span class="breadcrumb-current">{{ market()!.title }}</span>
                </nav>

                <!-- Market Title & Primary Outcome Metrics -->
                <header class="market-hero-header">
                    <div class="title-meta-block">
                        <div class="status-tags-row">
                            <app-badge [variant]="statusBadgeVariant()" size="sm">
                                {{ market()!.status.toUpperCase() }}
                            </app-badge>
                            <span class="res-date"> Resolves {{ formattedResolutionDate() }} </span>
                        </div>
                        <h1 class="market-hero-title">
                            {{ market()!.title }}
                        </h1>
                    </div>

                    <div class="probability-pills-row" role="region" aria-label="Current spot probability">
                        <div class="spot-pill spot-yes">
                            <svg lucideArrowUp class="spot-glyph" [size]="14" aria-hidden="true"></svg>
                            <span class="spot-prob tabular-nums">{{ yesPct() }}%</span>
                            <span class="spot-tag">YES</span>
                        </div>
                        <div class="spot-pill spot-no">
                            <svg lucideArrowDown class="spot-glyph" [size]="14" aria-hidden="true"></svg>
                            <span class="spot-prob tabular-nums">{{ noPct() }}%</span>
                            <span class="spot-tag">NO</span>
                        </div>
                    </div>
                </header>

                <!-- Resolution Celebration Banner (WCAG live polite alert) -->
                @if (isResolved()) {
                    <section class="resolution-celebration-banner" role="status">
                        <div class="banner-badge-icon">
                            <svg lucideCircleCheck [size]="28" aria-hidden="true"></svg>
                        </div>
                        <div class="banner-body">
                            <div class="banner-title-row">
                                <h2 class="banner-title">
                                    @if (winningOutcomeDisplay(); as outcome) {
                                        Market Resolved: {{ outcome }} Won
                                    } @else {
                                        Market Resolved
                                    }
                                </h2>
                                <app-badge variant="secondary" size="sm">OFFICIAL SETTLEMENT</app-badge>
                            </div>
                            <p class="banner-description">
                                This binary prediction market has officially settled.
                                @if (winningOutcomeDisplay(); as outcome) {
                                    All winning shares (<strong>{{ outcome }}</strong
                                    >)
                                } @else {
                                    All winning shares
                                }
                                have been redeemed at the fixed oracle price of <strong>$1.00 USDC</strong> per share. Losing shares have expired at $0.00.
                            </p>
                        </div>
                    </section>
                }

                <!-- 2-Column Cockpit Grid (Reflows to Single Column on Mobile/Zoom) -->
                <div class="cockpit-grid">
                    <!-- Left Column: Canvas Chart, Resolution Criteria, Live Trades Tape -->
                    <div class="cockpit-main">
                        <!-- TradingView Canvas Probability Chart -->
                        <div class="live-controls">
                            <app-button
                                variant="outline"
                                size="sm"
                                [selected]="isPaused()"
                                [ariaLabel]="isPaused() ? 'Resume live price and trade updates' : 'Pause live price and trade updates'"
                                (btnClick)="toggleLivePause()"
                            >
                                {{ isPaused() ? 'Resume live updates' : 'Pause live updates' }}
                            </app-button>
                        </div>
                        <app-price-chart [marketId]="market()!.id" [initialProbabilityYes]="initialProbabilityNum()" />

                        <!-- Market Rules & Resolution Criteria (WCAG Level AAA Clarity) -->
                        <section class="resolution-card" aria-labelledby="resolution-heading">
                            <div class="card-header">
                                <h2 id="resolution-heading" class="section-title">Resolution Criteria & Rules</h2>
                                <app-glossary-popover />
                            </div>

                            <p class="market-description">
                                {{ market()!.description }}
                            </p>

                            <div class="oracle-source-box">
                                <span class="oracle-label">Official Resolution Source</span>
                                <p class="oracle-text">{{ market()!.resolution_source }}</p>
                            </div>

                            <div class="liquidity-specs-grid">
                                <div class="spec-item">
                                    <span class="spec-label">Collateral Locked</span>
                                    <span class="spec-val tabular-nums">{{ '$' + formattedCollateral() }} USDC</span>
                                </div>
                                <div class="spec-item">
                                    <span class="spec-label">Total Volume</span>
                                    <span class="spec-val tabular-nums">{{ '$' + formattedVolume() }} USDC</span>
                                </div>
                                <div class="spec-item">
                                    <span class="spec-label">YES Pool Reserve</span>
                                    <span class="spec-val tabular-nums">{{ formattedReserveYes() }}</span>
                                </div>
                                <div class="spec-item">
                                    <span class="spec-label">NO Pool Reserve</span>
                                    <span class="spec-val tabular-nums">{{ formattedReserveNo() }}</span>
                                </div>
                            </div>
                        </section>

                        <!-- Live Trade Stream Tape -->
                        <app-activity-feed [marketId]="market()!.id" />
                    </div>

                    <!-- Right Column: Order Execution Terminal & Two-Step Confirmation Dialog -->
                    <aside class="cockpit-sidebar" aria-label="Trade Execution Sidebar">
                        <div class="sticky-sidebar-wrapper">
                            <app-order-terminal
                                #orderTerminal
                                [market]="market()!"
                                [tradable]="isTradable()"
                                (orderReviewRequested)="onOrderReviewRequested($event)"
                            />

                            @if (closedReason(); as reason) {
                                <p class="trading-closed-note" role="status">Trading is closed: {{ reason }}.</p>
                            }

                            @if (myPositions().length > 0) {
                                <section class="my-positions" aria-labelledby="my-positions-title">
                                    <h3 id="my-positions-title" class="my-positions-title">Your position</h3>
                                    @for (p of myPositions(); track p.outcome) {
                                        <div class="my-position-row">
                                            <span class="my-position-text tabular-nums">{{ p.shares_owned }} {{ p.outcome }} shares</span>
                                            <app-button
                                                variant="outline"
                                                size="sm"
                                                [disabled]="!isTradable()"
                                                [ariaLabel]="'Sell ' + p.outcome + ' shares in this market'"
                                                (btnClick)="openSellDialog(p)"
                                            >
                                                Sell
                                            </app-button>
                                        </div>
                                    }
                                </section>
                            }
                        </div>
                    </aside>
                </div>

                <!-- Two-Step Financial Confirmation Review Dialog (SC 3.3.6) -->
                <app-cash-out-dialog
                    [isOpen]="isCashOutOpen()"
                    [position]="selectedPosition()"
                    [canSell]="isTradable()"
                    (cashedOut)="onCashedOut()"
                    (dialogDismissed)="closeCashOut()"
                />

                <app-order-confirm-dialog
                    [isOpen]="isConfirmDialogOpen()"
                    [intent]="pendingOrderIntent()"
                    (orderPlaced)="onOrderSuccessfullyPlaced($event)"
                    (dialogDismissed)="onOrderDialogDismissed()"
                />
            }
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .cockpit-container {
                max-width: 1440px;
                margin: 0 auto;
                padding: var(--space-lg) var(--space-lg) 64px;
                display: flex;
                flex-direction: column;
                gap: 24px;
            }

            .breadcrumb-bar {
                display: flex;
                align-items: center;
                gap: 8px;
                font-family: var(--font-ui);
                font-size: 13px;
            }

            .breadcrumb-link {
                color: var(--muted);
                text-decoration: none;
                font-weight: 600;
                min-height: var(--touch-target-min);
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                border-radius: var(--radius-sm);
            }

            .breadcrumb-link:hover {
                color: var(--ink);
                background-color: var(--surface-card);
            }

            .breadcrumb-separator {
                color: var(--hairline);
            }

            .breadcrumb-current {
                color: var(--ink-secondary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 400px;
            }

            .market-hero-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 24px;
                flex-wrap: wrap;
                border-bottom: 1px solid var(--hairline);
                padding-bottom: 20px;
            }

            .resolution-celebration-banner {
                display: flex;
                align-items: flex-start;
                gap: 16px;
                padding: 18px 24px;
                background-color: var(--status-profit-bg);
                border: 1px solid var(--status-profit-border);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-sm);
            }

            .banner-badge-icon {
                color: var(--status-profit);
                flex-shrink: 0;
                display: flex;
                align-items: center;
                margin-top: 2px;
            }

            .banner-body {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .banner-title-row {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }

            .banner-title {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 18px;
                font-weight: 700;
                color: var(--ink);
            }

            .banner-description {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 13.5px;
                color: var(--ink-secondary);
                line-height: 1.5;
            }

            .title-meta-block {
                flex: 1;
                min-width: 320px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .status-tags-row {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .res-date {
                font-family: var(--font-ui);
                font-size: 12px;
                color: var(--muted);
            }

            .market-hero-title {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 26px;
                font-weight: 700;
                color: var(--ink);
                line-height: 1.3;
                letter-spacing: -0.3px;
            }

            .probability-pills-row {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .spot-pill {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-radius: var(--radius-pill);
                user-select: none;
                min-height: var(--touch-target-min);
            }

            .spot-yes {
                background-color: var(--outcome-yes-subtle);
                border: 1.5px solid var(--outcome-yes-border);
                color: var(--outcome-yes-text);
            }

            .spot-no {
                background-color: var(--outcome-no-subtle);
                border: 1.5px solid var(--outcome-no-border);
                color: var(--outcome-no-text);
            }

            .spot-glyph {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .spot-prob {
                font-family: var(--font-mono);
                font-size: 20px;
                font-weight: 800;
                font-feature-settings: 'tnum' 1;
            }

            .spot-tag {
                font-family: var(--font-ui);
                font-size: 12px;
                font-weight: 700;
                opacity: 0.9;
            }

            /* --- 2-Column Grid --- */
            .cockpit-grid {
                display: grid;
                grid-template-columns: 1fr 380px;
                gap: 24px;
                align-items: start;
            }

            .trading-closed-note {
                margin: 0;
                padding: 10px 12px;
                border: 1px solid var(--status-warning-border);
                border-radius: var(--radius-md);
                background-color: var(--status-warning-bg);
                color: var(--status-warning);
                font-size: 13px;
            }

            .my-positions {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 12px 14px;
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
                background-color: var(--surface-card);
            }

            .my-positions-title {
                margin: 0;
                font-size: 13px;
                font-weight: 600;
                color: var(--muted);
            }

            .my-position-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .my-position-text {
                font-size: 14px;
                color: var(--ink);
            }

            .live-controls {
                display: flex;
                justify-content: flex-end;
            }

            .cockpit-main {
                display: flex;
                flex-direction: column;
                gap: 24px;
                min-width: 0;
                contain: layout style;
            }

            .cockpit-sidebar {
                min-width: 0;
                contain: layout style;
            }

            .sticky-sidebar-wrapper {
                position: sticky;
                top: 80px;
            }

            /* --- Resolution Card --- */
            .resolution-card {
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .section-title {
                margin: 0;
                font-family: var(--font-ui);
                font-size: 17px;
                font-weight: 700;
                color: var(--ink);
            }

            .market-description {
                font-family: var(--font-ui);
                font-size: 14.5px;
                line-height: 1.6;
                color: var(--muted);
                margin: 0;
            }

            .oracle-source-box {
                background-color: var(--canvas-subtle);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: 12px 16px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .oracle-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--muted);
            }

            .oracle-text {
                font-family: var(--font-ui);
                font-size: 13.5px;
                color: var(--accent);
                margin: 0;
            }

            .liquidity-specs-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                gap: 12px;
                border-top: 1px solid var(--hairline);
                padding-top: 16px;
            }

            .spec-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .spec-label {
                font-family: var(--font-ui);
                font-size: 11px;
                color: var(--muted);
                text-transform: uppercase;
            }

            .spec-val {
                font-family: var(--font-mono);
                font-size: 14px;
                font-weight: 600;
                color: var(--ink);
                font-feature-settings: 'tnum' 1;
            }

            .loading-container,
            .error-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 100px 20px;
                text-align: center;
                gap: 16px;
            }

            .spinner {
                width: 40px;
                height: 40px;
                border: 3px solid rgba(124, 77, 255, 0.2);
                border-top-color: var(--primary-border);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }

            @media (max-width: 1024px) {
                .cockpit-grid {
                    grid-template-columns: 1fr;
                }
                .sticky-sidebar-wrapper {
                    position: static;
                }
                .market-hero-title {
                    font-size: 22px;
                }
            }
        `
    ]
})
export class MarketDetailComponent implements OnInit, OnDestroy {
    readonly id = input.required<string>();

    private readonly apiService = inject(ApiService);
    private readonly wsService = inject(WebSocketService);
    private readonly destroyRef = inject(DestroyRef);

    readonly market = signal<Market | null>(null);
    readonly isLoading = signal<boolean>(true);

    protected readonly orderTerminal = viewChild<OrderTerminalComponent>('orderTerminal');

    // Two-step confirmation state
    readonly isConfirmDialogOpen = signal<boolean>(false);
    readonly pendingOrderIntent = signal<OrderIntent | null>(null);

    // Oracle Market Resolution state
    readonly isResolvedBannerVisible = signal<boolean>(false);
    readonly winningOutcome = signal<'YES' | 'NO' | null>(null);

    protected readonly isResolved = computed(() => {
        return this.market()?.status === 'resolved' || this.isResolvedBannerVisible();
    });

    protected readonly winningOutcomeDisplay = computed(() => {
        // Never guess: show the outcome only when the server or the MARKET_RESOLVED frame reported it
        return this.winningOutcome() ?? this.market()?.winning_outcome ?? null;
    });

    /** Live price and trade updates for this market, suppressed while the reader has paused them. */
    protected readonly isPaused = computed(() => this.wsService.isPaused());

    toggleLivePause(): void {
        this.wsService.togglePause();
    }

    private readonly authStore = inject(AuthStore);

    /** Trades are accepted only while a market is active and its resolution date has not passed. */
    protected readonly closedReason = computed<string | null>(() => {
        const m = this.market();
        if (!m) return null;
        if (m.status !== 'active') return `this market is ${m.status}`;
        if (Date.parse(m.resolution_date) <= Date.now()) return 'the resolution date has passed';
        return null;
    });

    protected readonly isTradable = computed(() => this.market() !== null && this.closedReason() === null);

    /** The signed-in reader's open positions in this market. */
    readonly myPositions = signal<UserPosition[]>([]);
    readonly selectedPosition = signal<UserPosition | null>(null);
    readonly isCashOutOpen = signal<boolean>(false);

    private loadMyPositions(): void {
        const token = this.authStore.token();
        const marketId = this.market()?.id;
        if (!token || !marketId) {
            this.myPositions.set([]);
            return;
        }
        this.apiService
            .getPortfolio(token)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (portfolio) => this.myPositions.set(portfolio.positions.filter((p) => p.market_id === marketId)),
                error: () => this.myPositions.set([])
            });
    }

    openSellDialog(position: UserPosition): void {
        this.selectedPosition.set(position);
        this.isCashOutOpen.set(true);
    }

    closeCashOut(): void {
        this.isCashOutOpen.set(false);
    }

    onCashedOut(): void {
        this.isCashOutOpen.set(false);
        this.loadMyPositions();
        this.fetchMarket(false);
    }

    constructor() {
        effect(() => {
            const tick = this.wsService.lastPriceTick();
            const targetId = this.id();
            if (tick && tick.market_id === targetId) {
                untracked(() => this.applyLivePrice(tick));
            }
        });

        effect(() => {
            const updated = this.wsService.lastMarketUpdated();
            const targetId = this.id();
            if (updated && updated.market_id === targetId) {
                untracked(() => this.fetchMarket(false));
            }
        });

        effect(() => {
            const removed = this.wsService.lastMarketDeleted();
            const targetId = this.id();
            if (removed && removed.market_id === targetId) {
                untracked(() => {
                    this.isLoading.set(false);
                    this.market.set(null);
                });
            }
        });

        effect(() => {
            const res = this.wsService.lastMarketResolved();
            const targetId = this.id();
            if (res && res.market_id === targetId) {
                untracked(() => {
                    this.isResolvedBannerVisible.set(true);
                    this.winningOutcome.set(res.winning_outcome);
                    const current = this.market();
                    if (current) {
                        this.market.set({
                            ...current,
                            status: 'resolved',
                            winning_outcome: res.winning_outcome
                        });
                    }
                });
            }
        });
    }

    protected readonly yesPct = computed(() => {
        const m = this.market();
        if (!m) return 50;
        const p = roundDecimal(m.probability_yes_pct, 0);
        return p === null ? 50 : Number(p);
    });

    protected readonly noPct = computed(() => {
        return Math.max(0, 100 - this.yesPct());
    });

    protected readonly initialProbabilityNum = computed(() => {
        const m = this.market();
        if (!m) return 0.5;
        const p = parseFloat(m.probability_yes);
        return isNaN(p) ? 0.5 : p;
    });

    protected readonly statusBadgeVariant = computed(() => {
        const s = this.market()?.status;
        if (s === 'active') return 'outline';
        if (s === 'resolved') return 'secondary';
        return 'destructive';
    });

    protected readonly formattedResolutionDate = computed(() => {
        const raw = this.market()?.resolution_date;
        if (!raw) return 'Soon';
        const d = new Date(raw);
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    });

    protected readonly formattedCollateral = computed(() => {
        return formatUSDC(this.market()?.reserves?.collateral_reserve).replace('$', '');
    });

    protected readonly formattedVolume = computed(() => {
        return formatUSDC(this.market()?.reserves?.total_volume_usdc).replace('$', '');
    });

    protected readonly formattedReserveYes = computed(() => {
        return formatShares(this.market()?.reserves?.reserve_yes);
    });

    protected readonly formattedReserveNo = computed(() => {
        return formatShares(this.market()?.reserves?.reserve_no);
    });

    ngOnInit(): void {
        this.fetchMarket(true);
    }

    ngOnDestroy(): void {
        this.wsService.disconnect();
        this.wsService.clearTrades();
        this.wsService.lastPriceTick.set(null);
        this.market.set(null);
        this.pendingOrderIntent.set(null);
    }

    /**
     * Loads the market. The WebSocket is opened once, on the first load; a reload after an order only
     * resyncs the static fields and does not tear down the live connection.
     */
    private fetchMarket(connect: boolean): void {
        const marketId = this.id();
        this.isLoading.set(true);

        this.apiService
            .getMarketById(marketId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (data) => {
                    this.market.set(data);
                    this.isLoading.set(false);
                    if (connect) {
                        this.wsService.connect(data.id);
                    }
                    this.loadMyPositions();
                },
                error: (err) => {
                    console.error('Failed to load market:', err);
                    this.isLoading.set(false);
                }
            });
    }

    onOrderReviewRequested(intent: OrderIntent): void {
        this.pendingOrderIntent.set(intent);
        this.isConfirmDialogOpen.set(true);
    }

    onOrderSuccessfullyPlaced(_receipt: OrderResponse): void {
        // The server broadcasts PRICE_UPDATE for every trade, so live probabilities and reserves arrive
        // over the WebSocket. Only the static market fields need a refresh.
        this.fetchMarket(false);
        this.loadMyPositions();
    }

    /** Copies the server's post-trade probabilities and reserves into the header state. */
    private applyLivePrice(tick: PriceUpdateEvent): void {
        const current = this.market();
        if (!current) return;
        this.market.set({
            ...current,
            probability_yes: tick.yes_price,
            probability_no: tick.no_price,
            probability_yes_pct: shiftDecimal(tick.yes_price, 2, 1) ?? '0.0',
            probability_no_pct: shiftDecimal(tick.no_price, 2, 1) ?? '0.0',
            reserves: tick.reserves
                ? {
                      ...current.reserves,
                      reserve_yes: tick.reserves.yes,
                      reserve_no: tick.reserves.no,
                      total_volume_usdc: tick.total_volume_usdc ?? current.reserves.total_volume_usdc
                  }
                : current.reserves
        });
    }

    onOrderDialogDismissed(): void {
        this.isConfirmDialogOpen.set(false);
        this.pendingOrderIntent.set(null);
        setTimeout(() => this.orderTerminal()?.focusAmountInput(), 16);
    }
}
