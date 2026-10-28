import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'profit' | 'loss' | 'warning' | 'info' | 'resolved';

export type BadgeSize = 'default' | 'sm' | 'lg';

@Component({
    selector: 'app-badge',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <span [class]="badgeClass()">
            <ng-content />
        </span>
    `,
    styles: [
        `
            :host {
                display: inline-flex;
                vertical-align: middle;
            }

            .badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                font-family: var(--font-ui, system-ui, sans-serif);
                font-weight: 600;
                line-height: 1;
                letter-spacing: 0.15px;
                border-radius: var(--radius-pill);
                border: 1px solid transparent;
                user-select: none;
                white-space: nowrap;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease,
                    color 0.15s ease;
            }

            /* --- Sizes --- */
            .badge-size-default {
                padding: 4px 10px;
                font-size: 12px;
                min-height: 22px;
            }

            .badge-size-sm {
                padding: 2px 7px;
                font-size: 11px;
                min-height: 18px;
            }

            .badge-size-lg {
                padding: 6px 14px;
                font-size: 13px;
                min-height: 26px;
            }

            /* --- Variants --- */
            /* Default (Brand Electric Royal Indigo #3600b3) */
            .badge-variant-default {
                background-color: var(--primary);
                color: var(--on-primary);
                border-color: var(--primary-border);
            }

            /* Secondary (Elevated Obsidian Surface) */
            .badge-variant-secondary {
                background-color: var(--surface-card-elevated);
                color: var(--ink-secondary);
                border-color: var(--hairline);
            }

            /* Destructive (Loss / Danger #be123c) */
            .badge-variant-destructive {
                background-color: var(--status-loss-bg);
                color: var(--status-loss);
                border-color: var(--status-loss-border);
            }

            /* Outline (Transparent hairline) */
            .badge-variant-outline {
                background-color: transparent;
                color: var(--ink-secondary);
                border-color: var(--hairline);
            }

            /* Profit / Success / YES Outcome (Mint #34d399) */
            .badge-variant-profit {
                background-color: var(--status-profit-bg);
                color: var(--status-profit);
                border-color: var(--status-profit-border);
            }

            /* Loss / NO Outcome (Rose #fda4af) */
            .badge-variant-loss {
                background-color: var(--status-loss-bg);
                color: var(--status-loss);
                border-color: var(--status-loss-border);
            }

            /* Warning / Pending (Amber #fcd34d) */
            .badge-variant-warning {
                background-color: var(--status-warning-bg);
                color: var(--status-warning);
                border-color: var(--status-warning-border);
            }

            /* Info / Telemetry (Sky Blue #7dd3fc) */
            .badge-variant-info {
                background-color: var(--status-info-bg);
                color: var(--status-info);
                border-color: var(--status-info-border);
            }

            /* Resolved / Settled (Purple #d8b4fe) */
            .badge-variant-resolved {
                background-color: var(--status-resolved-bg);
                color: var(--status-resolved);
                border-color: var(--status-resolved-border);
            }
        `
    ]
})
export class BadgeComponent {
    readonly variant = input<BadgeVariant>('default');
    readonly size = input<BadgeSize>('default');

    protected readonly badgeClass = computed(() => {
        const v = this.variant();
        return ['badge', `badge-${v}`, `badge-variant-${v}`, `badge-size-${this.size()}`].join(' ');
    });
}
