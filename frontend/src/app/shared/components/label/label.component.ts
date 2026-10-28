import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type LabelSize = 'sm' | 'default' | 'lg';

@Component({
    selector: 'app-label',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <label [attr.for]="htmlFor() || null" [class]="labelClass()">
            <ng-content />
            @if (required()) {
                <span class="required-indicator" aria-hidden="true">*</span>
            }
        </label>
    `,
    styles: [
        `
            :host {
                display: inline-block;
            }

            label {
                display: inline-flex;
                align-items: center;
                font-family: var(--font-ui, system-ui, sans-serif);
                font-weight: 600;
                line-height: 1.3;
                letter-spacing: 0.1px;
                color: var(--ink-secondary);
                user-select: none;
                cursor: pointer;
                transition: color 0.15s ease;
            }

            /* --- Sizes --- */
            .label-size-sm {
                font-size: 12px;
            }

            .label-size-default {
                font-size: 13px;
            }

            .label-size-lg {
                font-size: 15px;
            }

            /* --- Error State --- */
            .label-error {
                color: var(--status-loss);
            }

            /* --- Disabled State --- */
            .label-disabled {
                opacity: 0.45;
                cursor: not-allowed;
            }

            .required-indicator {
                color: var(--primary-border);
                margin-left: 3px;
                font-weight: 700;
            }
        `
    ]
})
export class LabelComponent {
    readonly htmlFor = input<string>('');
    readonly required = input<boolean>(false);
    readonly error = input<boolean>(false);
    readonly disabled = input<boolean>(false);
    readonly size = input<LabelSize>('default');

    protected readonly labelClass = computed(() => {
        const classes = ['label', `label-size-${this.size()}`];
        if (this.error()) {
            classes.push('label-error');
        }
        if (this.disabled()) {
            classes.push('label-disabled');
        }
        return classes.join(' ');
    });
}
