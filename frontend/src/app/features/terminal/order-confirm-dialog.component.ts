import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideArrowUp, LucideArrowDown, LucideInfo } from '@lucide/angular';
import { ApiService } from '../../core/services/api.service';
import { absDecimal, applyTolerance, formatDecimal, truncateDecimal } from '../../core/utils/decimal';
import { formatShares } from '../../core/utils/formatters';
import { newIdempotencyKey } from '../../core/utils/idempotency';
import { OrderResponse } from '../../core/models/market.model';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { OrderIntent } from './order-terminal.component';

@Component({
    selector: 'app-order-confirm-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [DialogComponent, ButtonComponent, BadgeComponent, LucideArrowUp, LucideArrowDown, LucideInfo],
    template: `
        <app-dialog
            [open]="isOpen()"
            [title]="'Confirm Order Execution'"
            [description]="'Review your order details carefully before you commit funds.'"
            size="default"
            dialogRole="alertdialog"
            [closeOnOverlayClick]="!isExecuting()"
            [closeOnEscape]="!isExecuting()"
            [showCloseButton]="!isExecuting()"
            (closed)="onDismiss()"
        >
            @if (intent(); as ord) {
                <div class="confirm-breakdown">
                    <!-- Market Question Summary -->
                    <div class="market-summary-card">
                        <span class="market-label">Market</span>
                        <p class="market-title">{{ ord.marketTitle }}</p>
                    </div>

                    <!-- Outcome & Amount Primary Badges -->
                    <div class="badges-row">
                        <div class="badge-item">
                            <span class="item-label">Outcome</span>
                            <app-badge [variant]="ord.outcome === 'YES' ? 'outline' : 'destructive'" size="lg">
                                @if (ord.outcome === 'YES') {
                                    <svg lucideArrowUp class="badge-glyph" [size]="14" aria-hidden="true"></svg>
                                } @else {
                                    <svg lucideArrowDown class="badge-glyph" [size]="14" aria-hidden="true"></svg>
                                }
                                {{ ord.outcome }}
                            </app-badge>
                        </div>
                        <div class="badge-item">
                            <span class="item-label">Order Total</span>
                            <span class="total-amount tabular-nums">{{ '$' + formattedDeposit() }} USDC</span>
                        </div>
                    </div>

                    <!-- Financial Invariants Table -->
                    <div class="financial-table" role="table" aria-label="Trade execution breakdown">
                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Est. Shares Received</span>
                            <span class="cell-val tabular-nums shares-val" role="cell"> {{ formattedShares() }} Shares </span>
                        </div>
                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Avg. Execution Price</span>
                            <span class="cell-val tabular-nums" role="cell">
                                {{ '$' + formattedPrice() }}
                            </span>
                        </div>
                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Slippage Tolerance</span>
                            <span class="cell-val tabular-nums" role="cell"> {{ ord.maxSlippagePct }}% </span>
                        </div>
                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Min. Shares Received</span>
                            <span class="cell-val tabular-nums min-shares-val" role="cell"> {{ formattedMinShares() }} Shares </span>
                        </div>
                        <div class="table-row" role="row">
                            <span class="cell-label" role="rowheader">Est. Price Impact</span>
                            <span class="cell-val tabular-nums" role="cell"> {{ formattedImpact() }}% </span>
                        </div>
                        <div class="table-row balance-preview-row" role="row">
                            <span class="cell-label" role="rowheader">Post-Trade Balance</span>
                            <span class="cell-val tabular-nums balance-preview" role="cell">
                                {{ ord.postTradeBalance }}
                            </span>
                        </div>
                    </div>

                    <div class="paper-trade-callout" role="note">
                        <span class="paper-trade-pill">PAPER TRADE</span>
                        <span class="paper-trade-text">Executed with simulated USDC test funds. No real money or cryptocurrency is involved.</span>
                    </div>

                    <div class="reversibility-notice" role="note">
                        <svg lucideInfo class="notice-icon" [size]="16" aria-hidden="true"></svg>
                        <span>
                            Orders fill at the quoted price, or the order is rejected. You can sell shares back to the pool at any time before the market
                            resolves, but a large sale moves the price against you.
                        </span>
                    </div>
                </div>
            }

            @if (intent(); as ord) {
                <!-- Footer Action Buttons -->
                <div footer class="dialog-actions-row">
                    <app-button
                        variant="secondary"
                        size="default"
                        [disabled]="isExecuting()"
                        ariaLabel="Dismiss order confirmation and edit amount"
                        (btnClick)="onDismiss()"
                    >
                        Edit Order
                    </app-button>

                    <app-button
                        variant="primary"
                        size="default"
                        [loading]="isExecuting()"
                        [disabled]="isExecuting()"
                        ariaLabel="Confirm and place trade on market"
                        (btnClick)="onConfirmTrade(ord)"
                    >
                        @if (isExecuting()) {
                            <span>Executing Order...</span>
                        } @else {
                            <span>Confirm & Place Trade</span>
                        }
                    </app-button>
                </div>
            }
        </app-dialog>
    `,
    styles: [
        `
            .confirm-breakdown {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .market-summary-card {
                background-color: var(--canvas-subtle);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: 12px 14px;
            }

            .market-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: var(--muted);
            }

            .market-title {
                font-family: var(--font-ui);
                font-size: 15px;
                font-weight: 600;
                color: var(--ink);
                margin: 4px 0 0 0;
                line-height: 1.4;
            }

            .badges-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 0;
            }

            .badge-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .item-label {
                font-family: var(--font-ui);
                font-size: 11px;
                font-weight: 600;
                color: var(--muted);
            }

            .badge-glyph {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                margin-right: 4px;
            }

            .total-amount {
                font-family: var(--font-mono);
                font-size: 18px;
                font-weight: 700;
                color: var(--ink);
                font-feature-settings: 'tnum' 1;
            }

            .financial-table {
                background-color: var(--canvas);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
                padding: 8px 16px;
                display: flex;
                flex-direction: column;
            }

            .table-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 0;
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

            .shares-val {
                color: var(--status-profit);
                font-weight: 700;
            }

            .balance-preview-row {
                margin-top: 4px;
                padding-top: 12px;
                border-top: 1px dashed var(--hairline);
            }

            .balance-preview {
                color: var(--status-info);
                font-weight: 700;
            }

            .paper-trade-callout {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                background-color: rgba(168, 85, 247, 0.08);
                border: 1px solid rgba(168, 85, 247, 0.25);
                border-radius: var(--radius-md);
            }

            .paper-trade-pill {
                font-family: var(--font-mono);
                font-size: 10.5px;
                font-weight: 800;
                color: var(--primary-border);
                background-color: rgba(168, 85, 247, 0.16);
                padding: 2px 6px;
                border-radius: var(--radius-sm);
                letter-spacing: 0.5px;
                flex-shrink: 0;
            }

            .paper-trade-text {
                font-family: var(--font-ui);
                font-size: 12px;
                color: var(--muted);
                line-height: 1.35;
            }

            .reversibility-notice {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                background-color: var(--status-info-bg);
                border: 1px solid var(--status-info-border);
                border-radius: var(--radius-md);
                padding: 10px 12px;
                font-family: var(--font-ui);
                font-size: 12px;
                color: var(--status-info);
                line-height: 1.45;
            }

            .notice-icon {
                flex-shrink: 0;
                margin-top: 1px;
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
export class OrderConfirmDialogComponent {
    readonly isOpen = model<boolean>(false);
    readonly intent = input<OrderIntent | null>(null);

    readonly orderPlaced = output<OrderResponse>();
    readonly dialogDismissed = output<void>();

    protected readonly apiService = inject(ApiService);
    protected readonly authStore = inject(AuthStore);
    protected readonly toastService = inject(ToastService);
    private readonly destroyRef = inject(DestroyRef);

    readonly isExecuting = signal<boolean>(false);

    /** One key per review: a retry of the same intent reuses it, so it replays instead of executing twice. */
    private idempotencyKey: string | null = null;
    private keyIntent: OrderIntent | null = null;

    private keyForIntent(ord: OrderIntent): string {
        if (this.keyIntent !== ord || this.idempotencyKey === null) {
            this.keyIntent = ord;
            this.idempotencyKey = newIdempotencyKey('order');
        }
        return this.idempotencyKey;
    }

    protected readonly formattedDeposit = computed(() => {
        const ord = this.intent();
        if (!ord) return '0.00';
        return formatShares(ord.amountUSDC);
    });

    protected readonly formattedShares = computed(() => {
        const ord = this.intent();
        if (!ord?.quote) return '0.00';
        return formatShares(ord.quote.shares_received);
    });

    protected readonly formattedPrice = computed(() => {
        const ord = this.intent();
        if (!ord?.quote) return '0.0000';
        return formatDecimal(ord.quote.avg_price, 4, false) ?? '0.0000';
    });

    /** Server-side slippage floor: the quoted shares reduced by the user's tolerance. */
    protected readonly minSharesOut = computed(() => {
        const ord = this.intent();
        if (!ord?.quote) return null;
        return applyTolerance(ord.quote.shares_received, ord.maxSlippagePct);
    });

    protected readonly formattedMinShares = computed(() => {
        const min = this.minSharesOut();
        return min === null ? '—' : truncateDecimal(min, 2);
    });

    protected readonly formattedImpact = computed(() => {
        const ord = this.intent();
        if (!ord?.quote) return '0.00';
        return formatDecimal(absDecimal(ord.quote.price_impact_pct) ?? '0', 2, false) ?? '0.00';
    });

    onDismiss(): void {
        if (this.isExecuting()) return;
        this.isOpen.set(false);
        this.dialogDismissed.emit();
    }

    onConfirmTrade(ord: OrderIntent): void {
        const token = this.authStore.token();
        if (!token) {
            this.toastService.error('Authentication Required', 'Please wait for your guest session to initialize.');
            return;
        }

        const minSharesOut = this.minSharesOut();
        if (minSharesOut === null) {
            this.toastService.error('Invalid Quote', 'Could not derive a minimum fill from the quote. Edit the order and try again.');
            return;
        }

        this.isExecuting.set(true);
        const idempotencyKey = this.keyForIntent(ord);

        this.apiService
            .placeOrder(
                ord.marketId,
                {
                    outcome: ord.outcome,
                    amount_usdc: ord.amountUSDC,
                    min_shares_out: minSharesOut
                },
                token,
                idempotencyKey
            )
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (receipt) => {
                    this.isExecuting.set(false);
                    this.isOpen.set(false);
                    this.keyIntent = null;
                    this.idempotencyKey = null;

                    // Update store cash balance
                    this.authStore.updateBalance(receipt.new_cash_balance);

                    this.toastService.success(
                        'Trade Executed Successfully',
                        `Filled ${formatShares(receipt.shares_filled)} ${receipt.outcome} shares at $${formatDecimal(receipt.execution_price, 4) ?? '0.0000'}`
                    );

                    this.orderPlaced.emit(receipt);
                },
                error: (err) => {
                    this.isExecuting.set(false);
                    const errMsg = err?.error?.message || 'Order execution failed due to slippage or insufficient balance.';
                    this.toastService.error('Trade Rejected', errMsg);
                }
            });
    }
}
