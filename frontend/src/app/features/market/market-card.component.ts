import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight } from '@lucide/angular';
import { Market } from '../../core/models/market.model';
import { formatUSDC } from '../../core/utils/formatters';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { roundDecimal } from '../../core/utils/decimal';

@Component({
    selector: 'app-market-card',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, BadgeComponent, LucideArrowRight],
    template: `
        <article class="market-card" [attr.aria-label]="cardAriaLabel()">
            <a [routerLink]="['/markets', market().id]" class="market-card-link">
                <!-- Header Meta: Category Badge & Status -->
                <div class="card-meta-row">
                    <div class="category-group">
                        @if (market().status === 'resolved') {
                            <app-badge variant="secondary" size="sm"> RESOLVED: {{ market().winning_outcome || 'SETTLED' }} </app-badge>
                        } @else {
                            <app-badge variant="outline" size="sm">
                                {{ market().category.toUpperCase() }}
                            </app-badge>
                        }
                    </div>
                    <span class="meta-date">
                        {{ market().status === 'resolved' ? 'Settled' : 'Resolves ' + formattedDate() }}
                    </span>
                </div>

                <!-- Market Title -->
                <h3 class="market-title">
                    {{ market().title }}
                </h3>

                <!-- Polymarket Signature Chance Headline -->
                <div class="chance-headline-row">
                    <div class="chance-badge">
                        <span class="chance-val tabular-nums">{{ yesPct() }}%</span>
                        <span class="chance-label">chance</span>
                    </div>
                    <span class="chance-sub">
                        {{ yesPct() >= 50 ? 'Favored' : 'Underdog' }}
                    </span>
                </div>

                <!-- Probability Split Bar (Visualizing Consensus Curve) -->
                <div
                    class="split-bar-container"
                    role="meter"
                    aria-label="Implied probability meter"
                    [attr.aria-valuenow]="yesPct()"
                    aria-valuemin="0"
                    aria-valuemax="100"
                >
                    <div class="split-track">
                        <div class="split-fill-yes" [style.width.%]="yesPct()" [title]="'YES: ' + yesPct() + '%'"></div>
                        <div class="split-fill-no" [style.width.%]="noPct()" [title]="'NO: ' + noPct() + '%'"></div>
                    </div>
                </div>

                <!-- Dual Outcome Probability Action Pills (Polymarket Style) -->
                <div class="pills-row">
                    <div class="pill-badge pill-yes" [attr.aria-label]="'YES implied price: ' + yesPriceCents() + ' cents'">
                        <span class="pill-action-label">YES</span>
                        <span class="pill-price tabular-nums">{{ yesPriceCents() }}¢</span>
                    </div>

                    <div class="pill-badge pill-no" [attr.aria-label]="'NO implied price: ' + noPriceCents() + ' cents'">
                        <span class="pill-action-label">NO</span>
                        <span class="pill-price tabular-nums">{{ noPriceCents() }}¢</span>
                    </div>
                </div>

                <!-- Footer: Volume & Action Hint -->
                <div class="card-footer">
                    <span class="volume-stat">
                        Vol: <strong class="tabular-nums">{{ '$' + formattedVolume() }}</strong>
                    </span>
                    <span class="trade-cta-hint" aria-hidden="true">
                        <span>{{ ctaLabel() }}</span>
                        <svg lucideArrowRight [size]="14" aria-hidden="true"></svg>
                    </span>
                </div>
            </a>
        </article>
    `,
    styles: [
        `
            :host {
                display: block;
                height: 100%;
            }

            .market-card {
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
                transition:
                    transform 0.15s ease,
                    border-color 0.15s ease,
                    box-shadow 0.15s ease;
                height: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
            }

            .market-card:hover {
                transform: translateY(-2px);
                border-color: rgba(124, 77, 255, 0.4);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
            }

            .market-card-link {
                display: flex;
                flex-direction: column;
                height: 100%;
                padding: 16px 18px;
                text-decoration: none;
                color: inherit;
                border-radius: var(--radius-lg);
                outline: none;
            }

            .market-card-link:focus-visible {
                outline: 2px solid var(--focus-outline);
                outline-offset: 2px;
            }

            .card-meta-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 10px;
            }

            .meta-date {
                font-family: var(--font-ui);
                font-size: 11px;
                color: var(--muted);
            }

            .market-title {
                font-family: var(--font-ui);
                font-size: 15px;
                font-weight: 600;
                color: var(--ink);
                line-height: 1.4;
                margin-bottom: 12px;
                flex: 1;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }

            /* Polymarket Chance Headline */
            .chance-headline-row {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                margin-bottom: 6px;
            }

            .chance-badge {
                display: flex;
                align-items: baseline;
                gap: 4px;
            }

            .chance-val {
                font-family: var(--font-mono);
                font-size: 20px;
                font-weight: 800;
                color: var(--outcome-yes-text);
                font-feature-settings: 'tnum' 1;
            }

            .chance-label {
                font-family: var(--font-ui);
                font-size: 12px;
                font-weight: 500;
                color: var(--muted);
            }

            .chance-sub {
                font-family: var(--font-ui);
                font-size: 11px;
                color: var(--muted);
            }

            .split-bar-container {
                margin-bottom: 14px;
            }

            .split-track {
                width: 100%;
                height: 5px;
                border-radius: var(--radius-pill);
                display: flex;
                overflow: hidden;
                background-color: var(--outcome-no-subtle);
            }

            .split-fill-yes {
                background-color: var(--outcome-yes);
                transition: width 0.3s ease;
            }

            .split-fill-no {
                background-color: var(--outcome-no);
                transition: width 0.3s ease;
            }

            .pills-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                margin-bottom: 12px;
            }

            .pill-badge {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 7px 12px;
                border-radius: var(--radius-sm);
                font-family: var(--font-mono);
                font-weight: 700;
                font-size: 13px;
                min-height: 38px;
                user-select: none;
                transition:
                    filter 0.15s ease,
                    transform 0.15s ease;
            }

            .pill-badge:hover {
                filter: brightness(1.15);
            }

            .pill-yes {
                background-color: var(--outcome-yes-subtle);
                border: 1px solid var(--outcome-yes-border);
                color: var(--outcome-yes-text);
            }

            .pill-no {
                background-color: var(--outcome-no-subtle);
                border: 1px solid var(--outcome-no-border);
                color: var(--outcome-no-text);
            }

            .pill-action-label {
                font-family: var(--font-ui);
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.3px;
            }

            .pill-price {
                font-size: 13.5px;
                font-feature-settings: 'tnum' 1;
            }

            .card-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-top: 1px solid var(--hairline);
                padding-top: 10px;
                font-size: 12px;
            }

            .volume-stat {
                font-family: var(--font-ui);
                color: var(--muted);
            }

            .volume-stat strong {
                font-family: var(--font-mono);
                color: var(--ink-secondary);
                font-weight: 600;
                font-feature-settings: 'tnum' 1;
            }

            .trade-cta-hint {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                font-family: var(--font-ui);
                font-weight: 600;
                color: var(--primary-border);
                transition: transform 0.15s ease;
            }

            .market-card:hover .trade-cta-hint {
                transform: translateX(2px);
            }
        `
    ]
})
export class MarketCardComponent {
    readonly market = input.required<Market>();

    /** Only open markets invite a trade; closed ones link to their details. */
    protected readonly ctaLabel = computed(() => {
        const m = this.market();
        const open = m.status === 'active' && Date.parse(m.resolution_date) > Date.now();
        return open ? 'Trade' : 'View';
    });

    protected readonly yesPct = computed(() => {
        const val = roundDecimal(this.market().probability_yes_pct, 0);
        return val === null ? 50 : Number(val);
    });

    protected readonly noPct = computed(() => {
        return Math.max(0, 100 - this.yesPct());
    });

    protected readonly yesPriceCents = computed(() => {
        return this.yesPct().toString();
    });

    protected readonly noPriceCents = computed(() => {
        return this.noPct().toString();
    });

    protected readonly formattedDate = computed(() => {
        const raw = this.market().resolution_date;
        if (!raw) return 'Soon';
        const d = new Date(raw);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    });

    protected readonly formattedVolume = computed(() => {
        const raw = this.market().reserves?.total_volume_usdc || '0';
        return formatUSDC(raw).replace('$', '');
    });

    protected readonly cardAriaLabel = computed(() => {
        return `${this.market().title}. Category: ${this.market().category}. YES at ${this.yesPriceCents()} cents, NO at ${this.noPriceCents()} cents.`;
    });
}
