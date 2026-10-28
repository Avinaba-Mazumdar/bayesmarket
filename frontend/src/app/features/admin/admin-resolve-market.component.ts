import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { LucideArrowDown, LucideArrowUp, LucideCheck } from '@lucide/angular';
import { handleRovingKeydown } from '../../core/utils/roving-focus';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { Market, ResolveMarketResponse } from '../../core/models/market.model';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { LabelComponent } from '../../shared/components/label/label.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { SwitchComponent } from '../../shared/components/switch/switch.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';

@Component({
    selector: 'app-admin-resolve-market',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        LucideArrowDown,
        LucideArrowUp,
        LucideCheck,
        ButtonComponent,
        LabelComponent,
        SelectComponent,
        TextareaComponent,
        SwitchComponent,
        DialogComponent
    ],
    template: `
        <div class="tab-pane resolve-market-pane">
            <div class="form-card resolve-card">
                <h2 class="card-title">Settle & Distribute Collateral</h2>
                <p class="card-desc">Select a mature prediction market, designate the authoritative verified outcome, and trigger payout settlement.</p>

                <div class="market-form">
                    <div class="form-group">
                        <app-label htmlFor="resolve-market-select">Select Market (active, suspended or locked) *</app-label>
                        <app-select
                            id="resolve-market-select"
                            [options]="marketOptions()"
                            [value]="selectedMarketId()"
                            (valueChange)="selectedMarketId.set($event)"
                            placeholder="Choose market to resolve..."
                            ariaLabel="Market to resolve"
                        />
                    </div>

                    <!-- Winning Outcome Toggle -->
                    <div class="form-group">
                        <app-label>Authoritative Winning Outcome *</app-label>
                        <div class="outcome-select-row" role="radiogroup" aria-label="Winning outcome" (keydown)="rovingKeydown($event, '[role=radio]')">
                            <app-button
                                variant="yes"
                                size="lg"
                                [selected]="winningOutcome() === 'YES'"
                                buttonRole="radio"
                                ariaLabel="Resolve to outcome YES"
                                (btnClick)="winningOutcome.set('YES')"
                            >
                                <svg lucideArrowUp class="outcome-glyph" [size]="16" aria-hidden="true"></svg>
                                <span>OUTCOME YES (1.00 USDC)</span>
                            </app-button>

                            <app-button
                                variant="no"
                                size="lg"
                                [selected]="winningOutcome() === 'NO'"
                                buttonRole="radio"
                                ariaLabel="Resolve to outcome NO"
                                (btnClick)="winningOutcome.set('NO')"
                            >
                                <svg lucideArrowDown class="outcome-glyph" [size]="16" aria-hidden="true"></svg>
                                <span>OUTCOME NO (1.00 USDC)</span>
                            </app-button>
                        </div>
                    </div>

                    <!-- Oracle Proof -->
                    <div class="form-group">
                        <app-label htmlFor="oracle-proof-input">Oracle Proof Verification & Evidence URL *</app-label>
                        <app-textarea
                            id="oracle-proof-input"
                            [rows]="3"
                            [value]="oracleProof()"
                            (valueChange)="oracleProof.set($event)"
                            placeholder="Record the official proof reference or verification URL (e.g. FOMC meeting announcement link)..."
                            ariaLabel="Oracle proof input"
                        />
                    </div>

                    @if (selectedMarketBeforeDeadline(); as deadline) {
                        <div class="form-group resolve-early-group" role="group" aria-labelledby="resolve-early-label">
                            <div class="resolve-early-row">
                                <app-switch
                                    id="resolve-early-switch"
                                    [checked]="resolveEarly()"
                                    (checkedChange)="resolveEarly.set($event)"
                                    ariaLabel="Resolve before the resolution date"
                                />
                                <app-label id="resolve-early-label" htmlFor="resolve-early-switch">Resolve before the resolution date</app-label>
                            </div>
                            <p class="field-hint">
                                This market's resolution date is {{ deadline | date: 'medium' }}. Only resolve early if the outcome is already decided and the
                                proof above shows it.
                            </p>
                        </div>
                    }

                    <div class="form-actions">
                        <app-button
                            variant="primary"
                            size="lg"
                            [fullWidth]="true"
                            [loading]="isResolving()"
                            [disabled]="!selectedMarketId() || !oracleProof() || (!!selectedMarketBeforeDeadline() && !resolveEarly())"
                            (btnClick)="onSubmitResolveMarket()"
                            ariaLabel="Execute market resolution and payouts"
                        >
                            Execute Resolution & Credit Winners
                        </app-button>
                    </div>
                </div>

                @if (resolutionSummary(); as res) {
                    <div class="resolution-summary-box" role="status">
                        <div class="res-summary-title">
                            <svg lucideCheck class="res-check-icon" [size]="18" aria-hidden="true"></svg>
                            <span>Settlement Completed</span>
                        </div>
                        <div class="res-stats-grid">
                            <div class="res-stat">
                                <span class="stat-k">Winning Outcome:</span>
                                <span class="stat-v tabular-nums">{{ res.winning_outcome }}</span>
                            </div>
                            <div class="res-stat">
                                <span class="stat-k">Traders Credited:</span>
                                <span class="stat-v tabular-nums">{{ res.winners_credited }}</span>
                            </div>
                            <div class="res-stat">
                                <span class="stat-k">Total Payout:</span>
                                <span class="stat-v tabular-nums">&#36;{{ res.total_payout_usdc }} USDC</span>
                            </div>
                        </div>
                        @if (res.settlement_digest || res.proof_hash) {
                            <div class="res-audit-section">
                                @if (res.settlement_digest) {
                                    <div class="res-audit-row">
                                        <span class="stat-k">Settlement Digest:</span>
                                        <code class="audit-digest-val">{{ res.settlement_digest }}</code>
                                    </div>
                                }
                                @if (res.proof_hash) {
                                    <div class="res-audit-row">
                                        <span class="stat-k">Proof Hash:</span>
                                        <code class="audit-digest-val">{{ res.proof_hash }}</code>
                                    </div>
                                }
                                @if (res.oracle_proof) {
                                    <div class="res-audit-row">
                                        <span class="stat-k">Oracle Proof:</span>
                                        <code class="audit-digest-val">{{ res.oracle_proof }}</code>
                                    </div>
                                }
                            </div>
                        }
                    </div>
                }
            </div>
        </div>
        <!-- Resolution Confirmation: final, and pays out every winning position (SC 3.3.6) -->
        <app-dialog
            [open]="resolveConfirmOpen()"
            (closed)="resolveConfirmOpen.set(false)"
            title="Confirm Market Resolution"
            description="Resolution is final. It pays out every winning position and cannot be undone."
            size="sm"
            dialogRole="alertdialog"
            ariaLabel="Confirm market resolution"
        >
            <div class="delete-body">
                <p class="delete-warning-text">
                    Resolve <strong>{{ selectedMarketTitle() }}</strong> to <strong>{{ winningOutcome() }}</strong
                    >?
                </p>
                <div class="danger-box">
                    <p class="danger-text">Every {{ winningOutcome() }} share is redeemed at $1.00 USDC. Every other share expires at $0.00.</p>
                </div>
                <div class="dialog-actions">
                    <app-button variant="outline" size="default" type="button" (btnClick)="resolveConfirmOpen.set(false)" ariaLabel="Cancel resolution">
                        Cancel
                    </app-button>
                    <app-button
                        variant="destructive"
                        size="default"
                        type="button"
                        [loading]="isResolving()"
                        (btnClick)="confirmResolveMarket()"
                        ariaLabel="Confirm final resolution"
                    >
                        Resolve Market
                    </app-button>
                </div>
            </div>
        </app-dialog>
    `
})
export class AdminResolveMarketComponent {
    protected readonly rovingKeydown = handleRovingKeydown;

    private readonly apiService = inject(ApiService);
    private readonly toastService = inject(ToastService);
    private readonly authStore = inject(AuthStore);

    readonly markets = input.required<Market[]>();
    readonly resolved = output<void>();

    readonly isResolving = signal<boolean>(false);

    // Resolve Market Form fields
    readonly selectedMarketId = signal<string>('');
    readonly winningOutcome = signal<'YES' | 'NO'>('YES');
    readonly oracleProof = signal<string>('');
    readonly resolveConfirmOpen = signal<boolean>(false);
    readonly selectedMarketTitle = computed(() => this.markets().find((m) => m.id === this.selectedMarketId())?.title ?? '');
    readonly resolveEarly = signal<boolean>(false);

    /** Resolution date of the selected market when it has not passed yet, otherwise null. */
    readonly selectedMarketBeforeDeadline = computed<string | null>(() => {
        const market = this.markets().find((m) => m.id === this.selectedMarketId());
        if (!market) return null;
        return new Date(market.resolution_date).getTime() > Date.now() ? market.resolution_date : null;
    });
    readonly resolutionSummary = signal<ResolveMarketResponse | null>(null);

    readonly marketOptions = computed<SelectOption[]>(() => {
        return this.markets()
            .filter((m) => !this.isTerminal(m))
            .map((m) => ({
                value: m.id,
                label: m.title
            }));
    });

    /** Resolved and voided markets are final: they can't be edited, voided, deleted or resolved. */
    isTerminal(m: Market): boolean {
        return m.status === 'resolved' || m.status === 'voided';
    }

    private getEffectiveToken(): string | null {
        return this.authStore.token();
    }

    // --- Market Resolution ---
    /** Opens the confirmation step. Nothing is sent until the reader confirms, because resolution moves money. */
    onSubmitResolveMarket(): void {
        if (!this.selectedMarketId() || !this.oracleProof().trim()) {
            this.toastService.warning('Validation Error', 'Select a market and provide oracle proof');
            return;
        }
        this.resolveConfirmOpen.set(true);
    }

    confirmResolveMarket(): void {
        this.resolveConfirmOpen.set(false);
        const marketId = this.selectedMarketId();
        const proof = this.oracleProof().trim();
        const outcome = this.winningOutcome();

        if (!marketId || !proof) {
            this.toastService.warning('Validation Error', 'Select a market and provide oracle proof');
            return;
        }

        this.isResolving.set(true);
        const idempotencyKey = `resolve-${marketId}-${Date.now()}`;
        const request = { winning_outcome: outcome, oracle_proof: proof, resolve_early: !!this.selectedMarketBeforeDeadline() && this.resolveEarly() };
        this.apiService.resolveMarket(marketId, request, this.getEffectiveToken(), idempotencyKey).subscribe({
            next: (res) => {
                this.isResolving.set(false);
                this.resolveEarly.set(false);
                this.resolutionSummary.set(res);
                this.toastService.success('Market Resolved', `Outcome ${res.winning_outcome} settled. Credited ${res.winners_credited} traders.`);
                this.resolved.emit();
            },
            error: (err) => {
                this.isResolving.set(false);
                const msg = err?.error?.message || 'Failed to resolve market';
                this.toastService.error('Resolution Error', msg);
            }
        });
    }
}
