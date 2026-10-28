import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';

export type TextareaSize = 'sm' | 'default' | 'lg';
export type TextareaVariant = 'default' | 'mono';

@Component({
    selector: 'app-textarea',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div [class]="wrapperClass()">
            <textarea
                [id]="id() || null"
                [name]="name() || null"
                [value]="value()"
                [placeholder]="placeholder()"
                [rows]="rows()"
                [disabled]="disabled()"
                [readOnly]="readOnly()"
                [required]="required()"
                [attr.aria-invalid]="!!error()"
                [attr.aria-label]="ariaLabel() || null"
                (input)="onInputChange($event)"
                (focus)="textareaFocus.emit($event)"
                (blur)="textareaBlur.emit($event)"
                class="native-textarea"
            ></textarea>
        </div>

        @if (errorMessage()) {
            <span class="textarea-error-msg" role="alert">{{ errorMessage() }}</span>
        }
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
            }

            .textarea-wrapper {
                display: flex;
                width: 100%;
                background-color: var(--surface-terminal);
                border: 1px solid var(--border-strong);
                border-radius: var(--radius-lg);
                padding: 10px 14px;
                box-sizing: border-box;
                transition:
                    border-color 0.15s ease,
                    box-shadow 0.15s ease,
                    background-color 0.15s ease;
            }

            .textarea-wrapper:focus-within {
                border-color: var(--focus-outline);
                box-shadow: 0 0 0 2px var(--focus-ring);
            }

            .native-textarea {
                width: 100%;
                min-height: 80px;
                background: transparent;
                border: none;
                outline: none;
                box-shadow: none;
                resize: vertical;
                color: var(--ink);
                font-family: var(--font-ui);
                font-size: 14px;
                line-height: 1.5;
                box-sizing: border-box;
            }

            .native-textarea:focus,
            .native-textarea:focus-visible {
                outline: none;
                box-shadow: none;
            }

            .native-textarea::placeholder {
                color: var(--muted);
                opacity: 0.8;
            }

            /* --- Sizes --- */
            .textarea-size-sm {
                padding: 8px 12px;
            }
            .textarea-size-sm .native-textarea {
                min-height: 64px;
                font-size: 13px;
            }

            .textarea-size-default {
                padding: 10px 14px;
            }
            .textarea-size-default .native-textarea {
                min-height: 80px;
                font-size: 14px;
            }

            .textarea-size-lg {
                padding: 14px 16px;
            }
            .textarea-size-lg .native-textarea {
                min-height: 120px;
                font-size: 15px;
            }

            /* --- Variants --- */
            .textarea-variant-mono .native-textarea {
                font-family: var(--font-mono);
                font-feature-settings: 'tnum' 1;
                letter-spacing: 0.2px;
            }

            /* --- Error State --- */
            .textarea-error {
                border-color: var(--status-loss-border);
            }
            .textarea-error:focus-within {
                border-color: var(--status-loss-border);
                box-shadow: 0 0 0 2px rgba(251, 113, 133, 0.35);
            }

            /* --- Disabled State --- */
            .textarea-disabled {
                opacity: 0.45;
                cursor: not-allowed;
                background-color: rgba(14, 19, 29, 0.4);
            }
            .textarea-disabled .native-textarea {
                cursor: not-allowed;
            }

            /* --- Error Message --- */
            .textarea-error-msg {
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
export class TextareaComponent {
    readonly value = model<string>('');
    readonly id = input<string>('');
    readonly name = input<string>('');
    readonly placeholder = input<string>('');
    readonly rows = input<number>(3);
    readonly disabled = input<boolean>(false);
    readonly readOnly = input<boolean>(false);
    readonly required = input<boolean>(false);
    readonly size = input<TextareaSize>('default');
    readonly variant = input<TextareaVariant>('default');
    readonly error = input<string | boolean>('');
    readonly ariaLabel = input<string>('');

    readonly textareaFocus = output<FocusEvent>();
    readonly textareaBlur = output<FocusEvent>();

    protected readonly errorMessage = computed(() => {
        const err = this.error();
        return typeof err === 'string' ? err : '';
    });

    protected readonly wrapperClass = computed(() => {
        const classes = ['textarea-wrapper', `textarea-size-${this.size()}`, `textarea-variant-${this.variant()}`];
        if (this.error()) {
            classes.push('textarea-error');
        }
        if (this.disabled()) {
            classes.push('textarea-disabled');
        }
        return classes.join(' ');
    });

    protected onInputChange(event: Event): void {
        const target = event.target as HTMLTextAreaElement;
        this.value.set(target.value);
    }
}
