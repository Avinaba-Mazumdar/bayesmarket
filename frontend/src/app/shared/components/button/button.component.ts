import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideLoaderCircle } from '@lucide/angular';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'yes' | 'no' | 'chip';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'pill';

@Component({
    selector: 'app-button',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LucideLoaderCircle],
    host: {
        '[class.full-width]': 'fullWidth()'
    },
    template: `
        <button
            [type]="type()"
            [disabled]="disabled() || loading()"
            [class]="buttonClass()"
            [attr.aria-busy]="loading()"
            [attr.role]="buttonRole()"
            [attr.aria-pressed]="buttonRole() ? null : isToggleable() ? selected() : null"
            [attr.aria-selected]="buttonRole() === 'tab' ? selected() : null"
            [attr.aria-checked]="buttonRole() === 'radio' ? selected() : null"
            [attr.tabindex]="buttonRole() === 'tab' || buttonRole() === 'radio' ? (selected() ? 0 : -1) : null"
            [attr.aria-label]="ariaLabel() || null"
            (click)="onClick($event)"
        >
            @if (loading()) {
                <svg lucideLoaderCircle class="btn-spinner" [size]="16" [strokeWidth]="2.5" aria-hidden="true"></svg>
            }
            <ng-content />
        </button>
    `,
    styles: [
        `
            :host {
                display: inline-block;
            }
            :host(.full-width) {
                display: block;
                width: 100%;
            }

            button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                white-space: nowrap;
                flex-wrap: nowrap;
                font-family: var(--font-ui, system-ui, sans-serif);
                font-weight: 600;
                line-height: 1.3;
                letter-spacing: 0.1px;
                border-radius: var(--radius-lg);
                cursor: pointer;
                text-decoration: none;
                user-select: none;
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease,
                    color 0.15s ease,
                    transform 0.1s ease,
                    box-shadow 0.15s ease;
                outline: none;
            }

            button:focus-visible {
                outline: 2px solid var(--focus-outline);
                outline-offset: 2px;
            }

            button:active:not(:disabled) {
                transform: scale(0.98);
            }

            button:disabled {
                opacity: 0.45;
                cursor: not-allowed;
                filter: grayscale(30%);
            }

            /* --- Sizes (WCAG 2.2 AAA Touch Target: min 44x44px, SC 2.5.5) --- */
            .btn-size-default {
                min-height: var(--touch-target-min);
                min-width: var(--touch-target-min);
                padding: 8px 16px;
                font-size: 14px;
            }

            .btn-size-sm {
                min-height: var(--touch-target-min);
                min-width: var(--touch-target-min);
                padding: 6px 12px;
                font-size: 13px;
            }

            .btn-size-lg {
                min-height: 48px;
                min-width: var(--touch-target-min);
                padding: 12px 24px;
                font-size: 15px;
            }

            .btn-size-icon {
                min-height: var(--touch-target-min);
                min-width: var(--touch-target-min);
                width: var(--touch-target-min);
                height: var(--touch-target-min);
                padding: 0;
            }

            .btn-size-pill {
                min-height: var(--touch-target-min);
                min-width: var(--touch-target-min);
                padding: 8px 16px;
                font-size: 13px;
                border-radius: var(--radius-pill);
            }

            /* --- Variants --- */
            /* Primary (Electric Royal Indigo CTA) */
            .btn-variant-primary {
                background-color: var(--primary);
                color: var(--on-primary);
                border: 1px solid var(--primary-border);
                box-shadow: 0 2px 10px rgba(54, 0, 179, 0.4);
            }
            .btn-variant-primary:hover:not(:disabled) {
                background-color: var(--primary-hover);
                box-shadow: var(--shadow-glow-primary);
            }
            .btn-variant-primary:active:not(:disabled) {
                background-color: var(--primary-active);
            }

            /* Secondary (Obsidian Card Surface) */
            .btn-variant-secondary {
                background-color: var(--surface-card);
                color: var(--ink);
                border: 1px solid var(--hairline);
                box-shadow: var(--shadow-sm);
            }
            .btn-variant-secondary:hover:not(:disabled) {
                background-color: var(--surface-card-elevated);
                border-color: var(--primary-border);
            }

            /* Destructive (Loss / Sell / Cancel) */
            .btn-variant-destructive {
                background-color: #be123c;
                color: #ffffff;
                border: 1px solid var(--status-loss-border);
                box-shadow: var(--shadow-sm);
            }
            .btn-variant-destructive:hover:not(:disabled) {
                background-color: #9f1239;
                box-shadow: var(--shadow-glow-no);
            }

            /* Outline */
            .btn-variant-outline {
                background-color: transparent;
                color: var(--ink-secondary);
                border: 1px solid var(--hairline);
            }
            .btn-variant-outline:hover:not(:disabled) {
                background-color: var(--surface-card);
                color: var(--ink);
                border-color: var(--border-strong);
            }

            /* Ghost */
            .btn-variant-ghost {
                background-color: transparent;
                color: var(--muted);
                border: 1px solid transparent;
            }
            .btn-variant-ghost:hover:not(:disabled) {
                background-color: var(--primary-subtle);
                color: var(--ink);
            }

            /* Link */
            .btn-variant-link {
                background-color: transparent;
                color: var(--link);
                border: none;
                padding: 0;
                min-height: auto;
                min-width: auto;
            }
            .btn-variant-link:hover:not(:disabled) {
                text-decoration: underline;
                color: var(--link-active);
            }

            /* Outcome YES (Mint) & NO (Rose) */
            .btn-variant-yes,
            .btn-variant-no {
                border-radius: var(--radius-md);
                white-space: nowrap;
                flex-wrap: nowrap;
            }

            .btn-variant-yes.btn-size-lg,
            .btn-variant-no.btn-size-lg {
                padding: 10px 12px;
                gap: 6px;
                font-size: 14px;
            }

            /* --- Unselected Outcome Buttons --- */
            .btn-variant-yes:not(.selected) {
                background-color: var(--outcome-yes-subtle);
                color: var(--outcome-yes-text);
                border: 1px solid var(--outcome-yes-border);
            }
            .btn-variant-yes:not(.selected):hover:not(:disabled) {
                background-color: var(--outcome-yes-subtle);
                color: var(--outcome-yes-text);
                border-color: var(--outcome-yes-border);
                box-shadow: var(--shadow-glow-yes);
            }

            .btn-variant-no:not(.selected) {
                background-color: var(--outcome-no-subtle);
                color: var(--outcome-no-text);
                border: 1px solid var(--outcome-no-border);
            }
            .btn-variant-no:not(.selected):hover:not(:disabled) {
                background-color: var(--outcome-no-subtle);
                color: var(--outcome-no-text);
                border-color: var(--outcome-no-border);
                box-shadow: var(--shadow-glow-no);
            }

            /* --- Selected Outcome Buttons (Solid High-Contrast CTA) --- */
            .btn-variant-yes.selected {
                background-color: var(--outcome-yes-solid);
                color: var(--outcome-yes-solid-text);
                border: 1px solid var(--outcome-yes-solid);
                font-weight: 700;
                box-shadow: 0 0 16px var(--outcome-yes-glow);
            }
            .btn-variant-yes.selected:hover:not(:disabled) {
                background-color: var(--outcome-yes-solid-hover);
                border-color: var(--outcome-yes-solid-hover);
                color: var(--outcome-yes-solid-text);
                box-shadow: 0 0 20px var(--outcome-yes-glow);
            }
            .btn-variant-yes.selected:active:not(:disabled) {
                background-color: var(--outcome-yes-solid-hover);
                border-color: var(--outcome-yes-solid-hover);
                color: var(--outcome-yes-solid-text);
            }

            .btn-variant-no.selected {
                background-color: var(--outcome-no-solid);
                color: var(--outcome-no-solid-text);
                border: 1px solid var(--outcome-no-solid);
                font-weight: 700;
                box-shadow: 0 0 16px var(--outcome-no-glow);
            }
            .btn-variant-no.selected:hover:not(:disabled) {
                background-color: var(--outcome-no-solid-hover);
                border-color: var(--outcome-no-solid-hover);
                color: var(--outcome-no-solid-text);
                box-shadow: 0 0 20px var(--outcome-no-glow);
            }
            .btn-variant-no.selected:active:not(:disabled) {
                background-color: var(--outcome-no-solid-hover);
                border-color: var(--outcome-no-solid-hover);
                color: var(--outcome-no-solid-text);
            }

            /* Chip (Amount presets & timeframe intervals) */
            .btn-variant-chip {
                background-color: var(--surface-card);
                color: var(--ink-secondary);
                font-family: var(--font-mono, monospace);
                font-size: 13px;
                letter-spacing: 0.1px;
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: 6px 12px;
                min-height: var(--touch-target-min);
                font-feature-settings: 'tnum' 1;
            }
            .btn-variant-chip:hover:not(:disabled) {
                background-color: var(--surface-card-elevated);
                border-color: var(--primary-border);
                color: var(--ink);
            }
            .btn-variant-chip.selected {
                background-color: var(--primary-subtle);
                border-color: var(--primary-border);
                color: var(--primary-text);
                font-weight: 700;
                box-shadow: 0 0 10px var(--primary-glow);
            }
            .btn-variant-chip.selected:hover:not(:disabled) {
                background-color: var(--primary-subtle);
                border-color: var(--primary-border);
                color: var(--primary-text);
            }

            /* Full Width */
            .btn-full-width {
                width: 100%;
            }

            /* Spinner Animation */
            .btn-spinner {
                width: 16px;
                height: 16px;
                animation: spin 0.8s linear infinite;
                flex-shrink: 0;
            }

            @keyframes spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
        `
    ]
})
export class ButtonComponent {
    readonly variant = input<ButtonVariant>('primary');
    readonly size = input<ButtonSize>('default');
    readonly type = input<'button' | 'submit' | 'reset'>('button');
    readonly disabled = input<boolean>(false);
    readonly loading = input<boolean>(false);
    readonly fullWidth = input<boolean>(false);
    readonly selected = input<boolean>(false);
    /** ARIA role for the inner <button> (e.g. 'tab' or 'radio'). The role must sit on the focusable element. */
    readonly buttonRole = input<'tab' | 'radio' | null>(null);
    readonly ariaLabel = input<string>('');

    readonly btnClick = output<MouseEvent>();

    protected readonly isToggleable = computed(() => {
        return this.variant() === 'yes' || this.variant() === 'no' || this.variant() === 'chip';
    });

    protected readonly buttonClass = computed(() => {
        const v = this.variant();
        const classes = ['btn', `btn-${v}`, `btn-variant-${v}`, `btn-size-${this.size()}`];
        if (this.fullWidth()) {
            classes.push('btn-full-width');
        }
        if (this.selected()) {
            classes.push('selected');
        }
        return classes.join(' ');
    });

    protected onClick(event: MouseEvent): void {
        if (!this.disabled() && !this.loading()) {
            this.btnClick.emit(event);
        }
    }
}
