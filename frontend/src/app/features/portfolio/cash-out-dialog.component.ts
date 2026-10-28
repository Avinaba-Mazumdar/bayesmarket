import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideArrowUp, LucideArrowDown, LucideCircleAlert } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { CashOutResponse, SellQuoteResponse, UserPosition } from '../../core/models/market.model';
import { addDecimal, applyTolerance, compareDecimal, formatUsd, normalizeDecimal, truncateDecimal } from '../../core/utils/decimal';
import { InputComponent } from '../../shared/components/input/input.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

@Component({
    selector: 'app-cash-out-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DialogComponent, ButtonComponent, BadgeComponent, InputComponent, LucideArrowUp, LucideArrowDown, LucideCircleAlert],
    template: `
        <app-dialog
            [open]="isOpen()"
            [title]="'Confirm AMM Liquidation'"
            [description]="'Liquidate your outcome shares back into the automated liquidity pool for USDC cash.'"
            size="default"
            dialogRole="alertdialog"
            [closeOnOverlayClick]="!isExecuting()"
            [closeOnEscape]="!isExecuting()"
            [showCloseButton]="!isExecuting()"
            (closed)="onDismiss()"
        >
            @if (position(); as pos) {
                <div class="liquidation-breakdown">
                    <!-- Market Summary Card -->
                    <div class="market-summary-box">
                        <span class="summary-label">Market</span>
                        <p class="market-question">{{ pos.market_title }}</p>
                    </div>

                    <!-- Outcome & Shares Badge Row -->
                    <div class="meta-badges-row">
                        <div class="meta-item">
                            <span class="meta-label">Liquidating Outcome</span>
                            <app-badge [variant]="pos.outcome === 'YES' ? 'outline' : 'destructive'" size="lg">
                                @if (pos.outcome === 'YES') {
                                    <svg lucideArrowUp class="badge-glyph" [size]="14" aria-hidden="true"></svg>
                                } @else {
                                    <svg lucideArrowDown class="badge-glyph" [size]="14" aria-hidden="true"></svg>
                                }
                                {{ pos.outcome }}
                            </app-badge>
                        </div>

                        <div class="meta-item">
                            <span class="meta-label">Shares to Sell</span>
                            <div class="shares-entry">
                                <app-input
                                    id="cash-out-shares-input"
                                    type="text"
                                    variant="mono"
                                    size="default"
                                    [value]="sharesInput()"
                                    [error]="sharesError() ?? ''"
                                    (valueChange)="onSharesChange($event)"
                                    ariaLabel="Shares to sell"
                                />
                                <app-button variant="outline" size="sm" ariaLabel="Sell all shares in this position" (btnClick)="setAllShares()">
                                    All
                                </app-button>
                            </div>
                            <span class="shares-owned tabular-nums">of {{ formattedShares() }} owned</span>
                        </div>
                    </div>

                    <!-- Liquidation Financials Table -->
                    <div class="financial-table" role="table" aria-label="Liquidation calculation breakdown">
                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Current Spot Price</span>
                            <span class="cell-val tabular-nums" role="cell">{{ '$' + formattedPrice() }}</span>
                        </div>

                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Quoted Payout</span>
                            <span class="cell-val tabular-nums highlight-val" role="cell">
                                {{ formattedProceeds() }}
                            </span>
                        </div>

                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Est. Price Impact</span>
                            <span class="cell-val tabular-nums" role="cell">{{ formattedImpact() }}</span>
                        </div>

                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Min Payout ({{ slippageTolerancePct }}% Slippage Tolerance)</span>
                            <span class="cell-val tabular-nums min-payout-val" role="cell">
                                {{ formattedMinPayout() }}
                            </span>
                        </div>

                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Unrealized P&L Impact</span>
                            <span class="cell-val tabular-nums" [class.profit-val]="isPnLPositive()" [class.loss-val]="!isPnLPositive()" role="cell">
                                {{ pos.unrealized_pnl_usdc || pos.unrealized_pnl || '$0.00' }}
                                @if (pos.unrealized_pnl_pct) {
                                    ({{ pos.unrealized_pnl_pct }}%)
                                }
                            </span>
                        </div>

                        <div class="table-row balance-preview-row" role="row">
                            <span class="cell-label" role="rowheader">Est. Post-Liquidation Cash</span>
                            <span class="cell-val tabular-nums balance-preview" role="cell">
                                {{ '$' + estimatedPostBalance() }}
                            </span>
                        </div>
                    </div>

                    @if (quoteError(); as err) {
                        <div class="amm-notice quote-error" role="alert">
                            <svg lucideCircleAlert class="notice-glyph" [size]="16" aria-hidden="true"></svg>
                            <span>{{ err }}</span>
                            <app-button variant="outline" size="default" ariaLabel="Retry sell quote" (btnClick)="refreshQuote()">Retry Quote</app-button>
                        </div>
                    }

                    @if (!canSell()) {
                        <div class="amm-notice quote-error" role="status">
                            <svg lucideCircleAlert class="notice-glyph" [size]="16" aria-hidden="true"></svg>
                            <span>Selling is closed for this market right now.</span>
                        </div>
                    }

                    <div class="amm-notice" role="note">
                        <svg lucideCircleAlert class="notice-glyph" [size]="16" aria-hidden="true"></svg>
                        <span>
                            Shares sell into the AMM bonding curve, so large sales move the price. The sale is rejected if the price moves against you by more
                            than the tolerance since this quote.
                        </span>
                    </div>
                </div>
            }

            @if (position(); as pos) {
                <div footer class="dialog-actions-row">
                    <app-button variant="secondary" size="default" [disabled]="isExecuting()" ariaLabel="Cancel cash out liquidation" (btnClick)="onDismiss()">
                        Cancel
                    </app-button>

                    <app-button
                        variant="primary"
                        size="default"
                        [loading]="isExecuting() || isQuoting()"
                        [disabled]="isExecuting() || minPayout() === null || !!sharesError() || !canSell()"
                        ariaLabel="Confirm liquidation and sell shares for USDC"
                        (btnClick)="onConfirmCashOut(pos)"
                    >
                        @if (isExecuting()) {
                            <span>Liquidating Shares...</span>
                        } @else {
                            <span>Confirm Cash Out</span>
                        }
                    </app-button>
                </div>
            }
        </app-dialog>
    `,
    styles: [
        `
            .liquidation-breakdown {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .market-summary-box {
                background-color: var(--canvas-subtle);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: 12px 14px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .summary-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--muted);
            }

            .market-question {
                font-family: var(--font-ui);
                font-size: 14.5px;
                font-weight: 600;
                color: var(--ink);
                margin: 0;
                line-height: 1.35;
            }

            .meta-badges-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: 12px 14px;
            }

            .meta-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .meta-label {
                font-family: var(--font-ui);
                font-size: 11px;
                color: var(--muted);
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }

            .shares-amount {
                font-family: var(--font-mono);
                font-size: 15px;
                font-weight: 700;
                color: var(--ink);
            }

            .badge-glyph {
                margin-right: 4px;
                flex-shrink: 0;
            }

            .financial-table {
                display: flex;
                flex-direction: column;
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                background-color: var(--canvas);
                overflow: hidden;
            }

            .table-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px;
                border-bottom: 1px solid var(--hairline);
                font-size: 13px;
            }

            .table-row:last-child {
                border-bottom: none;
            }

            .cell-label {
                font-family: var(--font-ui);
                color: var(--muted);
            }

            .cell-val {
                font-family: var(--font-mono);
                font-weight: 600;
                color: var(--ink);
                font-feature-settings: 'tnum' 1;
            }

            .highlight-val {
                font-size: 15px;
                color: var(--status-profit);
            }

            .profit-val {
                color: var(--status-profit);
            }

            .loss-val {
                color: var(--status-loss);
            }

            .balance-preview-row {
                background-color: var(--status-info-bg);
            }

            .balance-preview {
                font-size: 14.5px;
                color: var(--status-info);
            }

            .amm-notice {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                background-color: var(--primary-subtle);
                border: 1px solid var(--primary-border);
                border-radius: var(--radius-md);
                padding: 10px 12px;
                font-family: var(--font-ui);
                font-size: 12px;
                color: var(--primary-text);
                line-height: 1.45;
            }

            .notice-glyph {
                flex-shrink: 0;
                margin-top: 1px;
            }

            .shares-entry {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
            }

            .shares-owned {
                font-size: 12px;
                color: var(--muted);
            }

            .dialog-actions-row {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 12px;
                width: 100%;
            }
        `
    ]
})
export class CashOutDialogComponent {
    readonly isOpen = model<boolean>(false);
    readonly position = input<UserPosition | null>(null);
    /** False while the market is not open for trading; the sale cannot be submitted. */
    readonly canSell = input<boolean>(true);

    readonly cashedOut = output<CashOutResponse>();
    readonly dialogDismissed = output<void>();

    private readonly apiService = inject(ApiService);
    private readonly authStore = inject(AuthStore);
    private readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);

    /** Max adverse movement between the SELL quote and execution. */
    readonly slippageTolerancePct = '2.0';

    readonly isExecuting = signal<boolean>(false);
    readonly isQuoting = signal<boolean>(false);

    /** The reader's entry for how many shares to sell; defaults to the whole position. */
    readonly sharesInput = signal<string>('');
    private sharesDebounce: ReturnType<typeof setTimeout> | null = null;

    /** The entry as a canonical 8-decimal string, or null when it is not a number. */
    readonly sharesToSell = computed(() => normalizeDecimal(this.sharesInput(), 8));

    readonly sharesError = computed<string | null>(() => {
        const shares = this.sharesToSell();
        const owned = this.position()?.shares_owned;
        if (shares === null || compareDecimal(shares, '0') !== 1) {
            return 'Enter how many shares to sell.';
        }
        if (owned && compareDecimal(shares, owned) === 1) {
            return `You hold ${owned} shares in this position.`;
        }
        return null;
    });
    readonly sellQuote = signal<SellQuoteResponse | null>(null);
    readonly quoteError = signal<string | null>(null);

    /** Server-side slippage floor: the quoted payout reduced by the tolerance. */
    readonly minPayout = computed(() => {
        const quote = this.sellQuote();
        return quote ? applyTolerance(quote.payout_usdc, this.slippageTolerancePct) : null;
    });

    constructor() {
        // Fetch an authoritative SELL quote whenever the dialog opens for a position
        effect(() => {
            const pos = this.position();
            if (this.isOpen() && pos) {
                untracked(() => {
                    this.sharesInput.set(pos.shares_owned);
                    this.refreshQuote();
                });
            } else {
                untracked(() => {
                    this.sellQuote.set(null);
                    this.quoteError.set(null);
                });
            }
        });
    }

    /** Updates the share entry; the quote is refreshed after the reader pauses typing. */
    onSharesChange(value: string | number): void {
        this.sharesInput.set(String(value ?? ''));
        if (this.sharesDebounce) clearTimeout(this.sharesDebounce);
        this.sharesDebounce = setTimeout(() => this.refreshQuote(), 300);
    }

    setAllShares(): void {
        this.sharesInput.set(this.position()?.shares_owned ?? '');
        this.refreshQuote();
    }

    refreshQuote(): void {
        const pos = this.position();
        const shares = this.sharesToSell();
        if (!pos || shares === null || this.sharesError()) {
            this.sellQuote.set(null);
            this.quoteError.set(null);
            this.isQuoting.set(false);
            return;
        }

        this.isQuoting.set(true);
        this.quoteError.set(null);
        this.sellQuote.set(null);
        this.apiService
            .getSellQuote(pos.market_id, pos.outcome, shares)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (quote) => {
                    this.isQuoting.set(false);
                    this.sellQuote.set(quote);
                },
                error: (err) => {
                    this.isQuoting.set(false);
                    this.quoteError.set(err?.error?.message || 'Could not get a sell quote for this position.');
                }
            });
    }

    protected readonly formattedShares = computed(() => {
        const pos = this.position();
        if (!pos) return '0.00';
        const n = parseFloat(pos.shares_owned);
        return isNaN(n) ? '0.00' : n.toFixed(2);
    });

    protected readonly formattedPrice = computed(() => {
        const pos = this.position();
        if (!pos) return '0.0000';
        const n = parseFloat(pos.current_price);
        return isNaN(n) ? '0.0000' : n.toFixed(4);
    });

    protected readonly formattedProceeds = computed(() => {
        const quote = this.sellQuote();
        if (quote) return `$${truncateDecimal(quote.payout_usdc, 2)} USDC`;
        return this.isQuoting() ? 'Quoting…' : '—';
    });

    protected readonly formattedImpact = computed(() => {
        const quote = this.sellQuote();
        return quote ? `${truncateDecimal(quote.price_impact_pct.replace(/^-/, ''), 2)}%` : '—';
    });

    protected readonly formattedMinPayout = computed(() => {
        const min = this.minPayout();
        return min === null ? '—' : `$${truncateDecimal(min, 2)} USDC`;
    });

    protected readonly isPnLPositive = computed(() => {
        const pos = this.position();
        if (!pos) return true;
        const pnl = parseFloat(pos.unrealized_pnl_usdc || pos.unrealized_pnl || '0');
        return pnl >= 0;
    });

    protected readonly estimatedPostBalance = computed(() => {
        const balance = this.authStore.cashBalanceRaw();
        const quote = this.sellQuote();
        const post = quote ? (addDecimal(balance, quote.payout_usdc) ?? balance) : balance;
        return formatUsd(post).slice(1); // the template adds the $ sign
    });

    onDismiss(): void {
        if (this.isExecuting()) return;
        this.isOpen.set(false);
        this.dialogDismissed.emit();
    }

    onConfirmCashOut(pos: UserPosition): void {
        const token = this.authStore.token();
        if (!token) {
            this.toastService.error('Authentication Required', 'Please wait for your guest session to initialize.');
            return;
        }

        const minPayout = this.minPayout();
        if (minPayout === null) {
            this.toastService.error('Quote Required', 'Wait for the sell quote before confirming.');
            return;
        }

        this.isExecuting.set(true);
        const idempotencyKey = `cashout-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        this.apiService
            .cashOut(
                {
                    market_id: pos.market_id,
                    outcome: pos.outcome,
                    shares: this.sharesToSell() ?? '0',
                    min_payout_usdc: minPayout
                },
                token,
                idempotencyKey
            )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (receipt) => {
                    this.isExecuting.set(false);
                    this.isOpen.set(false);

                    // Update cash balance in AuthStore
                    this.authStore.updateBalance(receipt.new_cash_balance);

                    this.toastService.success(
                        'Shares Liquidated',
                        `Successfully sold ${parseFloat(receipt.shares_sold).toFixed(2)} ${receipt.outcome} shares for $${parseFloat(receipt.payout_usdc).toFixed(2)} USDC.`
                    );

                    this.cashedOut.emit(receipt);
                },
                error: (err) => {
                    this.isExecuting.set(false);
                    const msg = err?.error?.message || 'Failed to liquidate outcome shares back into the pool.';
                    this.toastService.error('Liquidation Failed', msg);
                    // The pool moved; show the current price before the user retries
                    if (err?.error?.error === 'slippage_exceeded') {
                        this.refreshQuote();
                    }
                }
            });
    }
}
