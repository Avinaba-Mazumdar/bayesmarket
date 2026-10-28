import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideBriefcase, LucideArrowUp, LucideArrowDown, LucideDollarSign, LucideTrendingUp, LucideTrendingDown, LucideFolderSearch } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { PortfolioResponse, UserPosition } from '../../core/models/market.model';
import { formatUSDC, formatShares, formatPrice } from '../../core/utils/formatters';
import { CashOutDialogComponent } from './cash-out-dialog.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
    selector: 'app-portfolio-view',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        CashOutDialogComponent,
        ButtonComponent,
        BadgeComponent,
        LucideBriefcase,
        LucideArrowUp,
        LucideArrowDown,
        LucideDollarSign,
        LucideTrendingUp,
        LucideTrendingDown,
        LucideFolderSearch
    ],
    template: `
        <div class="portfolio-container">
            <!-- Portfolio Cockpit Header -->
            <header class="portfolio-header">
                <div class="header-left">
                    <div class="portfolio-badge">
                        <svg lucideBriefcase class="badge-icon" [size]="14" aria-hidden="true"></svg>
                        <span>PORTFOLIO LEDGER</span>
                    </div>
                    <h1 class="portfolio-title">Your Investment Positions</h1>
                    <p class="portfolio-subtitle">Real-time mark-to-market valuations, complete-set positions, and instant AMM liquidation.</p>
                </div>
            </header>

            @if (isLoading()) {
                <div class="loading-state" role="status">
                    <div class="spinner" aria-hidden="true"></div>
                    <p>Calculating portfolio valuations...</p>
                </div>
            } @else {
                <!-- Summary Metrics 4-Col Grid -->
                <section class="metrics-grid" aria-label="Portfolio Summary Valuation">
                    <div class="metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Total Portfolio Value</span>
                            <svg lucideBriefcase class="metric-glyph info" [size]="18" aria-hidden="true"></svg>
                        </div>
                        <span class="metric-value tabular-nums">{{ '$' + formattedTotalValue() }}</span>
                        <span class="metric-desc">Positions + Available Cash</span>
                    </div>

                    <div class="metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Available Cash</span>
                            <svg lucideDollarSign class="metric-glyph primary" [size]="18" aria-hidden="true"></svg>
                        </div>
                        <span class="metric-value tabular-nums">{{ authStore.cashBalance() }}</span>
                        <span class="metric-desc">Liquid USDC Balance</span>
                    </div>

                    <div class="metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Active Positions</span>
                            <span class="active-count-badge tabular-nums">{{ positions().length }}</span>
                        </div>
                        <span class="metric-value tabular-nums">{{ positions().length }}</span>
                        <span class="metric-desc">Open Market Contracts</span>
                    </div>

                    <div class="metric-card">
                        <div class="metric-header">
                            <span class="metric-title">Total Unrealized P&L</span>
                            @if (isTotalPnLPositive()) {
                                <svg lucideTrendingUp class="metric-glyph profit" [size]="18" aria-hidden="true"></svg>
                            } @else {
                                <svg lucideTrendingDown class="metric-glyph loss" [size]="18" aria-hidden="true"></svg>
                            }
                        </div>
                        <div class="pnl-value-row">
                            <span class="metric-value tabular-nums" [class.profit-text]="isTotalPnLPositive()" [class.loss-text]="!isTotalPnLPositive()">
                                {{ (isTotalPnLPositive() ? '+$' : '$') + formattedPnL() }}
                            </span>
                            @if (formattedPnLPct()) {
                                <span class="pnl-pct-pill" [class.profit-pill]="isTotalPnLPositive()" [class.loss-pill]="!isTotalPnLPositive()">
                                    {{ isTotalPnLPositive() ? '+' : '' }}{{ formattedPnLPct() }}%
                                </span>
                            }
                        </div>
                        <span class="metric-desc">Mark-to-market performance</span>
                    </div>
                </section>

                <!-- Positions Ledger Table -->
                <section class="positions-section" aria-label="Open Positions Ledger">
                    <div class="section-title-row">
                        <h2 class="section-heading">Open Market Positions</h2>
                        <span class="positions-count tabular-nums">{{ positions().length }} Holdings</span>
                    </div>

                    @if (positions().length === 0) {
                        <div class="empty-positions-box">
                            <svg lucideFolderSearch class="empty-icon" [size]="48" aria-hidden="true"></svg>
                            <h3>No Open Positions</h3>
                            <p>You have not acquired any outcome shares yet. Explore active prediction markets to place trades.</p>
                            <app-button variant="primary" size="default" routerLink="/"> Explore Markets </app-button>
                        </div>
                    } @else {
                        <div class="table-responsive-container">
                            <table class="positions-table" aria-label="Your active prediction market positions">
                                <thead>
                                    <tr>
                                        <th scope="col" class="th-market">Market</th>
                                        <th scope="col" class="th-outcome">Outcome</th>
                                        <th scope="col" class="th-num">Shares</th>
                                        <th scope="col" class="th-num">Avg Entry</th>
                                        <th scope="col" class="th-num">Current Price</th>
                                        <th scope="col" class="th-num" title="What selling the whole position now would pay, after price impact">
                                            Liquidation Value
                                        </th>
                                        <th scope="col" class="th-num">Unrealized P&L</th>
                                        <th scope="col" class="th-action">Liquidation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (pos of positions(); track pos.id || pos.market_id + pos.outcome) {
                                        <tr class="position-row">
                                            <!-- Market Question Link -->
                                            <td class="td-market">
                                                <a [routerLink]="['/markets', pos.market_id]" class="market-link">
                                                    <span class="market-title-text">{{ pos.market_title }}</span>
                                                    @if (pos.category) {
                                                        <span class="market-category-pill">{{ pos.category.toUpperCase() }}</span>
                                                    }
                                                </a>
                                            </td>

                                            <!-- Outcome Badge -->
                                            <td class="td-outcome">
                                                <app-badge [variant]="pos.outcome === 'YES' ? 'outline' : 'destructive'" size="sm">
                                                    @if (pos.outcome === 'YES') {
                                                        <svg lucideArrowUp class="outcome-glyph" [size]="12" aria-hidden="true"></svg>
                                                    } @else {
                                                        <svg lucideArrowDown class="outcome-glyph" [size]="12" aria-hidden="true"></svg>
                                                    }
                                                    {{ pos.outcome }}
                                                </app-badge>
                                            </td>

                                            <!-- Shares Owned -->
                                            <td class="td-num tabular-nums">
                                                <span class="num-highlight">{{ pos.formattedShares }}</span>
                                            </td>

                                            <!-- Avg Entry Price -->
                                            <td class="td-num tabular-nums">{{ '$' + pos.formattedAvgBuyPrice }}</td>

                                            <!-- Current Price -->
                                            <td class="td-num tabular-nums spot-price">{{ '$' + pos.formattedCurrentPrice }}</td>

                                            <!-- Current Value -->
                                            <td class="td-num tabular-nums market-value">
                                                {{ '$' + pos.formattedMarketValue }}
                                            </td>

                                            <!-- Unrealized P&L -->
                                            <td class="td-num tabular-nums">
                                                <span class="pnl-tag" [class.profit-tag]="pos.isPositivePnL" [class.loss-tag]="!pos.isPositivePnL">
                                                    {{ pos.formattedPnL }}
                                                    @if (pos.unrealized_pnl_pct) {
                                                        <small>({{ pos.unrealized_pnl_pct }}%)</small>
                                                    }
                                                </span>
                                            </td>

                                            <!-- 1-Tap Cash Out Trigger Button -->
                                            <td class="td-action">
                                                <app-button
                                                    variant="secondary"
                                                    size="sm"
                                                    [ariaLabel]="'Liquidate ' + pos.shares_owned + ' ' + pos.outcome + ' shares for ' + pos.market_title"
                                                    (btnClick)="openCashOutModal(pos)"
                                                >
                                                    Cash Out
                                                </app-button>
                                            </td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    }
                </section>
            }

            <!-- 1-Tap Cash Out Modal Dialog -->
            <app-cash-out-dialog
                [isOpen]="isCashOutModalOpen()"
                [position]="selectedPosition()"
                (cashedOut)="onCashOutCompleted()"
                (dialogDismissed)="isCashOutModalOpen.set(false)"
            />
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
            }

            .portfolio-container {
                max-width: 1440px;
                margin: 0 auto;
                padding: var(--space-xl, 32px) var(--space-lg, 20px) 64px;
                display: flex;
                flex-direction: column;
                gap: 32px;
            }

            .portfolio-header {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .portfolio-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                background-color: rgba(56, 189, 248, 0.08);
                border: 1px solid rgba(56, 189, 248, 0.2);
                border-radius: var(--radius-full, 9999px);
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                color: var(--status-info, #7dd3fc);
                letter-spacing: 0.5px;
                width: fit-content;
            }

            .badge-icon {
                flex-shrink: 0;
            }

            .portfolio-title {
                font-family: var(--font-ui);
                font-size: 28px;
                font-weight: 700;
                color: var(--ink, #f8fafc);
                margin: 0;
                letter-spacing: -0.4px;
            }

            .portfolio-subtitle {
                font-family: var(--font-ui);
                font-size: 14.5px;
                color: var(--muted, #a2b4c9);
                margin: 0;
                max-width: 700px;
                line-height: 1.45;
            }

            /* --- 4-Column Metrics Grid --- */
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 16px;
            }

            .metric-card {
                background-color: var(--surface-card, #131126);
                border: 1px solid var(--hairline, #252140);
                border-radius: var(--radius-lg, 14px);
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 6px;
                box-shadow: var(--shadow-sm);
            }

            .metric-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }

            .metric-title {
                font-family: var(--font-ui);
                font-size: 12px;
                font-weight: 600;
                color: var(--muted, #94a3b8);
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .metric-glyph.info {
                color: var(--status-info, #075985);
            }
            .metric-glyph.primary {
                color: var(--primary-text, #4338ca);
            }
            .metric-glyph.profit {
                color: var(--status-profit, #065f46);
            }
            .metric-glyph.loss {
                color: var(--status-loss, #9f1239);
            }

            .active-count-badge {
                font-family: var(--font-mono);
                font-size: 11.5px;
                font-weight: 700;
                background-color: var(--hairline, #252140);
                color: var(--ink, #f8f7ff);
                padding: 2px 8px;
                border-radius: var(--radius-pill, 9999px);
            }

            .metric-value {
                font-family: var(--font-mono);
                font-size: 26px;
                font-weight: 800;
                color: var(--ink, #f8f7ff);
                letter-spacing: -0.5px;
                margin: 4px 0;
                font-feature-settings: 'tnum' 1;
            }

            .pnl-value-row {
                display: flex;
                align-items: baseline;
                gap: 8px;
                flex-wrap: wrap;
            }

            .profit-text {
                color: var(--status-profit, #065f46);
            }

            .loss-text {
                color: var(--status-loss, #9f1239);
            }

            .pnl-pct-pill {
                font-family: var(--font-mono);
                font-size: 12px;
                font-weight: 600;
                padding: 2px 6px;
                border-radius: var(--radius-sm, 6px);
            }

            .profit-pill {
                background-color: var(--status-profit-bg, #ecfdf5);
                color: var(--status-profit, #065f46);
                border: 1px solid var(--status-profit-border, #059669);
            }

            .loss-pill {
                background-color: var(--status-loss-bg, #fff1f2);
                color: var(--status-loss, #9f1239);
                border: 1px solid var(--status-loss-border, #e11d48);
            }

            .metric-desc {
                font-family: var(--font-ui);
                font-size: 11.5px;
                color: var(--muted, #94a3b8);
            }

            /* --- Positions Table --- */
            .positions-section {
                background-color: var(--surface-card, #131126);
                border: 1px solid var(--hairline, #252140);
                border-radius: var(--radius-lg, 14px);
                padding: 24px;
                display: flex;
                flex-direction: column;
                gap: 16px;
                box-shadow: var(--shadow-sm);
            }

            .section-title-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid var(--hairline, #252140);
                padding-bottom: 14px;
            }

            .section-heading {
                font-family: var(--font-ui);
                font-size: 18px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                margin: 0;
            }

            .positions-count {
                font-family: var(--font-ui);
                font-size: 12.5px;
                color: var(--muted, #94a3b8);
            }

            .table-responsive-container {
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
            }

            .positions-table {
                width: 100%;
                border-collapse: collapse;
                text-align: left;
                font-size: 13.5px;
            }

            .positions-table th {
                font-family: var(--font-ui);
                font-size: 11.5px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.4px;
                color: var(--muted, #94a3b8);
                padding: 12px 14px;
                border-bottom: 1px solid var(--hairline, #252140);
                white-space: nowrap;
            }

            .positions-table td {
                padding: 14px;
                border-bottom: 1px solid var(--hairline, #252140);
                vertical-align: middle;
            }

            .position-row:hover td {
                background-color: rgba(255, 255, 255, 0.02);
            }

            .th-market {
                min-width: 240px;
            }
            .th-num,
            .td-num {
                text-align: right;
                font-family: var(--font-mono);
            }
            .th-action,
            .td-action {
                text-align: right;
                min-width: 110px;
            }

            .market-link {
                display: flex;
                flex-direction: column;
                gap: 4px;
                text-decoration: none;
                color: var(--ink, #f8f7ff);
            }

            .market-link:hover .market-title-text {
                color: var(--primary-border, #7c4dff);
            }

            .market-title-text {
                font-weight: 600;
                line-height: 1.35;
            }

            .market-category-pill {
                font-family: var(--font-ui);
                font-size: 10px;
                font-weight: 700;
                color: var(--muted, #a2b4c9);
                letter-spacing: 0.4px;
            }

            .outcome-glyph {
                margin-right: 3px;
                flex-shrink: 0;
            }

            .num-highlight {
                font-weight: 700;
                color: var(--ink, #f8fafc);
            }

            .spot-price {
                color: var(--status-info, #7dd3fc);
            }

            .market-value {
                font-weight: 700;
            }

            .pnl-tag {
                display: inline-block;
                padding: 2px 8px;
                border-radius: var(--radius-sm, 6px);
                font-weight: 600;
            }

            .profit-tag {
                background-color: var(--status-profit-bg, #ecfdf5);
                color: var(--status-profit, #065f46);
                border: 1px solid var(--status-profit-border, #059669);
            }

            .loss-tag {
                background-color: var(--status-loss-bg, #fff1f2);
                color: var(--status-loss, #9f1239);
                border: 1px solid var(--status-loss-border, #e11d48);
            }

            .empty-positions-box {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 64px 20px;
                gap: 16px;
            }

            .empty-icon {
                color: var(--hairline, #1e2638);
            }

            .empty-positions-box h3 {
                font-family: var(--font-ui);
                font-size: 18px;
                color: var(--ink, #f8fafc);
                margin: 0;
            }

            .empty-positions-box p {
                font-family: var(--font-ui);
                font-size: 14px;
                color: var(--muted, #a2b4c9);
                max-width: 440px;
                margin: 0;
            }

            .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 80px 20px;
                gap: 16px;
                color: var(--muted, #a2b4c9);
                font-family: var(--font-ui);
            }

            .spinner {
                width: 36px;
                height: 36px;
                border: 3px solid rgba(166, 3, 76, 0.2);
                border-top-color: var(--primary-border, #e84089);
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }

            @media (max-width: 768px) {
                .portfolio-title {
                    font-size: 22px;
                }
                .metric-card {
                    padding: 16px;
                }
            }
        `
    ]
})
export class PortfolioViewComponent implements OnInit {
    private readonly apiService = inject(ApiService);
    private readonly destroyRef = inject(DestroyRef);
    readonly authStore = inject(AuthStore);

    readonly portfolio = signal<PortfolioResponse | null>(null);
    readonly isLoading = signal<boolean>(true);

    // Cash out modal state
    readonly isCashOutModalOpen = signal<boolean>(false);
    readonly selectedPosition = signal<UserPosition | null>(null);

    readonly positions = computed(() => {
        const raw = this.portfolio()?.positions || [];
        return raw.map((pos) => {
            const pnlNum = parseFloat(pos.unrealized_pnl_usdc || '0');
            return {
                ...pos,
                formattedShares: formatShares(pos.shares_owned),
                formattedAvgBuyPrice: formatPrice(pos.avg_buy_price, 4).replace('$', ''),
                formattedCurrentPrice: formatPrice(pos.current_price, 4).replace('$', ''),
                formattedMarketValue: formatUSDC(pos.current_value_usdc).replace('$', ''),
                formattedPnL: formatUSDC(pos.unrealized_pnl_usdc),
                isPositivePnL: pnlNum >= 0
            };
        });
    });

    readonly formattedTotalValue = computed(() => {
        const p = this.portfolio();
        return p ? formatUSDC(p.total_portfolio_value_usdc).replace('$', '') : '0.00';
    });

    readonly formattedPnL = computed(() => {
        const p = this.portfolio();
        if (!p) return '0.00';
        const pnl = parseFloat(p.total_unrealized_pnl_usdc || '0');
        return formatUSDC(Math.abs(pnl)).replace('$', '');
    });

    readonly formattedPnLPct = computed(() => {
        const p = this.portfolio();
        if (!p) return '';
        const pct = parseFloat(p.total_unrealized_pnl_pct || '0');
        return isNaN(pct) ? '' : Math.abs(pct).toFixed(1);
    });

    readonly isTotalPnLPositive = computed(() => {
        const p = this.portfolio();
        if (!p) return true;
        const pnl = parseFloat(p.total_unrealized_pnl_usdc || '0');
        return pnl >= 0;
    });

    ngOnInit(): void {
        this.fetchPortfolio();
    }

    fetchPortfolio(): void {
        const token = this.authStore.token();
        if (!token) {
            this.isLoading.set(false);
            return;
        }

        this.isLoading.set(true);
        this.apiService
            .getPortfolio(token)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (data) => {
                    this.portfolio.set(data);
                    this.isLoading.set(false);
                },
                error: (err) => {
                    console.warn('Failed to load portfolio:', err);
                    this.isLoading.set(false);
                }
            });
    }

    formatNumber(raw: string | undefined, decimals: number): string {
        if (!raw) return '0.00';
        const n = parseFloat(raw);
        return isNaN(n) ? '0.00' : n.toFixed(decimals);
    }

    isRowPnLPositive(pos: UserPosition): boolean {
        const pnl = parseFloat(pos.unrealized_pnl_usdc || '0');
        return pnl >= 0;
    }

    openCashOutModal(pos: UserPosition): void {
        this.selectedPosition.set(pos);
        this.isCashOutModalOpen.set(true);
    }

    onCashOutCompleted(): void {
        // Refresh positions after liquidation
        this.fetchPortfolio();
    }
}
