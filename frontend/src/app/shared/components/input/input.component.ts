import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

export type InputType = 'text' | 'number' | 'password' | 'email' | 'search' | 'tel' | 'url' | 'datetime-local';
export type InputSize = 'sm' | 'default' | 'lg';
export type InputVariant = 'default' | 'mono';

@Component({
    selector: 'app-input',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="wrapperClass()">
            <div class="prefix-slot">
                <ng-content select="[prefix]" />
            </div>

            <input
                [type]="type()"
                [id]="id() || null"
                [name]="name() || null"
                [value]="value()"
                [placeholder]="placeholder()"
                [disabled]="disabled()"
                [readOnly]="readOnly()"
                [required]="required()"
                [attr.aria-invalid]="!!error()"
                [attr.aria-label]="ariaLabel() || null"
                (input)="onInputChange($event)"
                (focus)="inputFocus.emit($event)"
                (blur)="inputBlur.emit($event)"
                class="native-input"
            />

            <div class="suffix-slot">
                <ng-content select="[suffix]" />
            </div>
        </div>

        @if (errorMessage()) {
            <span class="input-error-msg" role="alert">{{ errorMessage() }}</span>
        }
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
            }

            .input-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                background-color: var(--surface-terminal);
                border: 1px solid var(--border-strong);
                border-radius: var(--radius-lg);
                padding: 0 14px;
                box-sizing: border-box;
                transition:
                    border-color 0.15s ease,
                    box-shadow 0.15s ease,
                    background-color 0.15s ease;
            }

            .input-wrapper:focus-within {
                border-color: var(--focus-outline);
                box-shadow: 0 0 0 2px var(--focus-ring);
            }

            .native-input {
                flex: 1;
                width: 100%;
                background: transparent;
                border: none;
                outline: none;
                box-shadow: none;
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: 14px;
                line-height: 1.4;
                box-sizing: border-box;
            }

            .native-input:focus,
            .native-input:focus-visible {
                outline: none;
                box-shadow: none;
            }

            .native-input::placeholder {
                color: var(--muted);
                opacity: 0.8;
            }

            /* --- Sizes (WCAG 2.2 AAA Touch Target: min 40px) --- */
            .input-size-default {
                min-height: var(--touch-target-min);
            }
            .input-size-default .native-input {
                font-size: 14px;
            }

            .input-size-sm {
                min-height: var(--touch-target-min);
                padding: 0 10px;
            }
            .input-size-sm .native-input {
                font-size: 13px;
            }

            .input-size-lg {
                min-height: 52px;
                padding: 0 16px;
            }
            .input-size-lg .native-input {
                font-size: 16px;
            }

            /* --- Variants --- */
            .input-variant-mono .native-input {
                font-family: var(--font-mono);
                font-feature-settings: 'tnum' 1;
                letter-spacing: 0.2px;
            }

            /* --- Error State --- */
            .input-error {
                border-color: var(--status-loss-border);
            }
            .input-error:focus-within {
                border-color: var(--status-loss-border);
                box-shadow: 0 0 0 2px rgba(251, 113, 133, 0.35);
            }

            /* --- Disabled State --- */
            .input-disabled {
                opacity: 0.45;
                cursor: not-allowed;
                background-color: rgba(14, 19, 29, 0.4);
            }
            .input-disabled .native-input {
                cursor: not-allowed;
            }

            /* --- Prefix & Suffix --- */
            .prefix-slot,
            .suffix-slot {
                display: flex;
                align-items: center;
                flex-shrink: 0;
                color: var(--muted);
                font-size: 14px;
            }

            .prefix-slot:empty,
            .suffix-slot:empty {
                display: none;
            }

            /* --- Error Message --- */
            .input-error-msg {
                display: block;
                font-family: var(--font-ui);
                font-size: 12px;
                font-weight: 500;
                color: var(--status-loss);
                margin-top: 5px;
                padding-left: 2px;
            }
        `
    ]
})
export class InputComponent {
    readonly value = model<string | number>('');
    readonly type = input<InputType>('text');
    readonly id = input<string>('');
    readonly name = input<string>('');
    readonly placeholder = input<string>('');
    readonly disabled = input<boolean>(false);
    readonly readOnly = input<boolean>(false);
    readonly required = input<boolean>(false);
    readonly size = input<InputSize>('default');
    readonly variant = input<InputVariant>('default');
    readonly error = input<string | boolean>('');
    readonly ariaLabel = input<string>('');

    readonly inputFocus = output<FocusEvent>();
    readonly inputBlur = output<FocusEvent>();

    protected readonly errorMessage = computed(() => {
        const err = this.error();
        return typeof err === 'string' ? err : '';
    });

    protected readonly wrapperClass = computed(() => {
        const classes = ['input-wrapper', `input-size-${this.size()}`, `input-variant-${this.variant()}`];
        if (this.error()) {
            classes.push('input-error');
        }
        if (this.disabled()) {
            classes.push('input-disabled');
        }
        return classes.join(' ');
    });

    protected onInputChange(event: Event): void {
        const target = event.target as HTMLInputElement;
        // The DOM string is emitted as typed so no digits are lost to a float conversion.
        this.value.set(target.value);
    }
}
