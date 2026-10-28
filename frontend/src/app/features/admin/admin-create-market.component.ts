import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { LucideArrowRight, LucideCircleCheck, LucideInfo } from '@lucide/angular';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { CreateMarketRequest, CreateMarketResponse } from '../../core/models/market.model';
import { compareDecimal, diffDecimal, formatDecimal, multiplyDecimal, normalizeDecimal, shiftDecimal } from '../../core/utils/decimal';
import { WritableSignal } from '@angular/core';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { LabelComponent } from '../../shared/components/label/label.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';

@Component({
    selector: 'app-admin-create-market',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LucideArrowRight, LucideCircleCheck, LucideInfo, ButtonComponent, InputComponent, LabelComponent, SelectComponent, TextareaComponent, RouterLink],
    template: `
        <div class="tab-pane create-market-grid">
            <!-- Left Form Column -->
            <div class="form-card">
                <h2 class="card-title">Market Parameters</h2>
                <p class="card-desc">Define the event question, resolution criteria, and initial liquidity parameters.</p>

                <form class="market-form" (submit)="onSubmitCreateMarket($event)">
                    <!-- Title -->
                    <div class="form-group">
                        <app-label htmlFor="m-title" size="default">Market Question / Title *</app-label>
                        <app-input
                            id="m-title"
                            size="default"
                            [value]="title()"
                            (valueChange)="onValueChange(title, $event)"
                            placeholder="e.g. Will Ethereum break all-time high before Dec 31, 2026?"
                            ariaLabel="Market Title"
                        />
                    </div>

                    <!-- Category & Resolution Date -->
                    <div class="form-row-2">
                        <div class="form-group">
                            <app-label htmlFor="m-category" size="default">Category *</app-label>
                            <app-select
                                id="m-category"
                                [options]="categories()"
                                [value]="category()"
                                (valueChange)="category.set($event)"
                                placeholder="Select Category"
                                ariaLabel="Market Category"
                            />
                        </div>

                        <div class="form-group">
                            <app-label htmlFor="m-date" size="default">Resolution Date (your local time) *</app-label>
                            <app-input
                                id="m-date"
                                type="datetime-local"
                                size="default"
                                variant="mono"
                                [value]="resolutionDateInput()"
                                (valueChange)="onValueChange(resolutionDateInput, $event)"
                                ariaLabel="Resolution Date"
                            />
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="form-group">
                        <app-label htmlFor="m-desc" size="default">Detailed Resolution Criteria & Rules *</app-label>
                        <app-textarea
                            id="m-desc"
                            [rows]="4"
                            [value]="description()"
                            (valueChange)="description.set($event)"
                            placeholder="State the objective condition for YES versus NO outcome..."
                            ariaLabel="Market Description"
                        />
                    </div>

                    <!-- Resolution Source -->
                    <div class="form-group">
                        <app-label htmlFor="m-source" size="default">Authoritative Resolution Source *</app-label>
                        <app-input
                            id="m-source"
                            size="default"
                            [value]="resolutionSource()"
                            (valueChange)="onValueChange(resolutionSource, $event)"
                            placeholder="e.g. Official NASA telemetry, SEC filing, or Coinbase index..."
                            ariaLabel="Resolution Source"
                        />
                    </div>

                    <!-- Collateral & Probability -->
                    <div class="form-row-2">
                        <div class="form-group">
                            <app-label htmlFor="m-collateral" size="default">Initial Pool Collateral (USDC)</app-label>
                            <app-input
                                id="m-collateral"
                                type="number"
                                variant="mono"
                                size="default"
                                [value]="collateralInput()"
                                (valueChange)="onValueChange(collateralInput, $event)"
                                placeholder="10000"
                                ariaLabel="Initial Collateral"
                            />
                        </div>

                        <div class="form-group">
                            <app-label htmlFor="m-prob" size="default">Starting Implied Probability (YES %)</app-label>
                            <app-input
                                id="m-prob"
                                type="number"
                                variant="mono"
                                size="default"
                                [value]="probabilityInput()"
                                (valueChange)="onValueChange(probabilityInput, $event)"
                                placeholder="50"
                                ariaLabel="Starting Probability"
                            />
                        </div>
                    </div>

                    <div class="form-actions">
                        <app-button
                            type="submit"
                            variant="primary"
                            size="lg"
                            [fullWidth]="true"
                            [loading]="isSubmitting()"
                            (btnClick)="onSubmitCreateMarket($event)"
                            ariaLabel="Submit new market creation"
                        >
                            Create Market & Initialize CPMM Pool
                        </app-button>
                    </div>
                </form>
            </div>

            <!-- Right Column: Live CPMM Invariant Preview -->
            <div class="preview-column">
                <div class="preview-card">
                    <h3 class="preview-title">CPMM Bonding Preview</h3>
                    <p class="preview-subtitle">Derived fixed-point pool reserves ($k = R_&#123;YES&#125; imes R_&#123;NO&#125;$)</p>

                    <div class="prob-visual-track" role="progressbar" aria-label="Implied initial probability split">
                        <div class="track-yes" [style.width.%]="numericProbability()"></div>
                        <div class="track-no" [style.width.%]="100 - numericProbability()"></div>
                    </div>

                    <div class="prob-split-labels">
                        <span class="label-yes tabular-nums">▲ YES: {{ numericProbability() }}¢ ({{ numericProbability() }}%)</span>
                        <span class="label-no tabular-nums">▼ NO: {{ 100 - numericProbability() }}¢ ({{ 100 - numericProbability() }}%)</span>
                    </div>

                    <div class="preview-stats-grid">
                        <div class="stat-box">
                            <span class="stat-k">Collateral Reserve</span>
                            <span class="stat-v tabular-nums">&#36;{{ formattedCollateral() }} USDC</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-k">Virtual YES Reserve (R_yes)</span>
                            <span class="stat-v tabular-nums">{{ formattedReserveYes() }}</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-k">Virtual NO Reserve (R_no)</span>
                            <span class="stat-v tabular-nums">{{ formattedReserveNo() }}</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-k">Constant Product (k)</span>
                            <span class="stat-v tabular-nums">{{ formattedInvariantK() }}</span>
                        </div>
                    </div>

                    <div class="info-alert">
                        <svg lucideInfo class="info-icon" [size]="16" aria-hidden="true"></svg>
                        <span>
                            Every issued share remains 100% redeemable for 1.00 USDC collateral. Spot prices clear exactly to the configured probability.
                        </span>
                    </div>
                </div>

                @if (createdMarket(); as cm) {
                    <div class="success-banner" role="status">
                        <div class="success-header">
                            <svg lucideCircleCheck class="success-icon" [size]="20" aria-hidden="true"></svg>
                            <span class="success-title">Market Successfully Created!</span>
                        </div>
                        <p class="success-text">"{{ cm.title }}" is now live on the trading engine.</p>
                        <div class="success-actions">
                            <a [routerLink]="'/markets/' + cm.slug" class="view-market-link">
                                <span>View Market Page</span>
                                <svg lucideArrowRight [size]="14" aria-hidden="true"></svg>
                            </a>
                        </div>
                    </div>
                }
            </div>
        </div>
    `
})
export class AdminCreateMarketComponent implements OnInit {
    private readonly apiService = inject(ApiService);
    private readonly toastService = inject(ToastService);
    private readonly authStore = inject(AuthStore);

    readonly categories = input.required<SelectOption[]>();
    readonly created = output<void>();

    readonly isSubmitting = signal<boolean>(false);

    // Create Market Form fields
    readonly title = signal<string>('');
    readonly category = signal<string>('ai');
    readonly description = signal<string>('');
    readonly resolutionSource = signal<string>('');
    readonly resolutionDateInput = signal<string>('');

    readonly collateralInput = signal<string>('10000');
    readonly probabilityInput = signal<string>('50');

    readonly createdMarket = signal<CreateMarketResponse | null>(null);

    readonly probabilityPct = computed(() => {
        const parsed = normalizeDecimal(this.probabilityInput().trim(), 2);
        if (parsed === null || compareDecimal(parsed, '1') === -1) return '1';
        if (compareDecimal(parsed, '99') === 1) return '99';
        return parsed;
    });

    readonly numericProbability = computed(() => Number(this.probabilityPct()));

    readonly probabilityYes = computed(() => shiftDecimal(this.probabilityPct(), -2, 8) ?? '0.01');

    readonly collateralAmount = computed(() => {
        const parsed = normalizeDecimal(this.collateralInput().trim(), 8);
        return parsed === null || compareDecimal(parsed, '0') !== 1 ? '10000' : parsed;
    });

    readonly formattedCollateral = computed(() => formatDecimal(this.collateralAmount(), 2, true) ?? '0.00');

    readonly formattedReserveYes = computed(() => {
        const pNo = diffDecimal('1', this.probabilityYes(), 8) ?? '0';
        return multiplyDecimal(this.collateralAmount(), pNo, 2) ?? '0.00';
    });

    readonly formattedReserveNo = computed(() => multiplyDecimal(this.collateralAmount(), this.probabilityYes(), 2) ?? '0.00');

    readonly formattedInvariantK = computed(() => multiplyDecimal(this.formattedReserveYes(), this.formattedReserveNo(), 0, true) ?? '0');

    onValueChange(targetSignal: WritableSignal<string>, val: string | number): void {
        targetSignal.set(String(val ?? ''));
    }

    ngOnInit(): void {
        this.initDefaultDate();
    }

    private initDefaultDate(): void {
        const future = new Date();
        future.setMonth(future.getMonth() + 3);
        const y = future.getFullYear();
        const m = String(future.getMonth() + 1).padStart(2, '0');
        const d = String(future.getDate()).padStart(2, '0');
        this.resolutionDateInput.set(`${y}-${m}-${d}T23:59`);
    }

    private getEffectiveToken(): string | null {
        return this.authStore.token();
    }

    // --- Market Creation ---
    onSubmitCreateMarket(e: Event): void {
        e.preventDefault();

        const title = this.title().trim();
        const desc = this.description().trim();
        const source = this.resolutionSource().trim();
        const rawDate = this.resolutionDateInput().trim();

        if (!title || !desc || !source || !rawDate) {
            this.toastService.warning('Validation Error', 'Please complete all required fields');
            return;
        }

        const payload: CreateMarketRequest = {
            title,
            description: desc,
            category: this.category(),
            resolution_source: source,
            resolution_date: new Date(rawDate).toISOString(),
            initial_collateral_usdc: this.collateralAmount(),
            initial_probability_yes: this.probabilityYes()
        };

        this.isSubmitting.set(true);
        this.apiService.createMarket(payload, this.getEffectiveToken()).subscribe({
            next: (res) => {
                this.isSubmitting.set(false);
                this.createdMarket.set(res);
                this.toastService.success('Market Created', `"${res.title}" successfully provisioned!`);
                this.title.set('');
                this.description.set('');
                this.resolutionSource.set('');
                this.created.emit();
            },
            error: (err) => {
                this.isSubmitting.set(false);
                const msg = err?.error?.message || 'Failed to create market';
                this.toastService.error('Creation Error', msg);
            }
        });
    }
}
