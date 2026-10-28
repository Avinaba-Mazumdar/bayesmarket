import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideCheck, LucideCircleAlert, LucideTriangleAlert, LucideInfo, LucideBell, LucideX } from '@lucide/angular';
import { ButtonComponent } from '../button/button.component';
import { Toast, ToastService } from './toast.service';

@Component({
    selector: 'app-toast-container',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [LucideCheck, LucideCircleAlert, LucideTriangleAlert, LucideInfo, LucideBell, LucideX, ButtonComponent],
    template: `
        <div class="toast-viewport" role="region" aria-label="Notifications" aria-live="polite">
            @for (t of toastService.toasts(); track t.id) {
                <div
                    [class]="'toast-item toast-' + (t.variant || 'default')"
                    [attr.role]="t.variant === 'destructive' ? 'alert' : 'status'"
                    (mouseenter)="toastService.pause(t.id)"
                    (mouseleave)="toastService.resume(t.id)"
                    (focusin)="toastService.pause(t.id)"
                    (focusout)="onFocusOut($event, t.id)"
                >
                    <div class="toast-indicator" aria-hidden="true"></div>

                    <div class="toast-icon-box" aria-hidden="true">
                        @switch (t.variant) {
                            @case ('success') {
                                <svg lucideCheck class="toast-icon icon-success" [size]="18" [strokeWidth]="2.5" aria-hidden="true"></svg>
                            }
                            @case ('destructive') {
                                <svg lucideCircleAlert class="toast-icon icon-destructive" [size]="18" [strokeWidth]="2.5" aria-hidden="true"></svg>
                            }
                            @case ('warning') {
                                <svg lucideTriangleAlert class="toast-icon icon-warning" [size]="18" [strokeWidth]="2.5" aria-hidden="true"></svg>
                            }
                            @case ('info') {
                                <svg lucideInfo class="toast-icon icon-info" [size]="18" [strokeWidth]="2.5" aria-hidden="true"></svg>
                            }
                            @default {
                                <svg lucideBell class="toast-icon icon-default" [size]="18" [strokeWidth]="2.5" aria-hidden="true"></svg>
                            }
                        }
                    </div>

                    <div class="toast-body">
                        <div class="toast-title">{{ t.title }}</div>
                        @if (t.description) {
                            <div class="toast-description">{{ t.description }}</div>
                        }
                    </div>

                    @if (t.action) {
                        <app-button class="toast-action-btn" size="sm" variant="secondary" (btnClick)="onAction(t)">
                            {{ t.action.label }}
                        </app-button>
                    }

                    <app-button class="toast-close-btn" variant="ghost" size="icon" ariaLabel="Close notification" (btnClick)="toastService.dismiss(t.id)">
                        <svg lucideX class="close-icon" [size]="16" aria-hidden="true"></svg>
                    </app-button>
                </div>
            }
        </div>
    `,
    styles: [
        `
            :host {
                display: contents;
            }

            .toast-viewport {
                position: fixed;
                top: 76px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 420px;
                width: calc(100vw - 40px);
                pointer-events: none;
            }

            .toast-item {
                position: relative;
                pointer-events: auto;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                padding: 14px 16px;
                background-color: var(--surface-glass);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-lg);
                overflow: hidden;
                animation: toastIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @keyframes toastIn {
                from {
                    transform: translateY(-8px) scale(0.96);
                    opacity: 0;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }

            /* --- Left Indicator Bar --- */
            .toast-indicator {
                position: absolute;
                top: 0;
                left: 0;
                bottom: 0;
                width: 4px;
            }

            .toast-default .toast-indicator {
                background-color: var(--primary);
            }
            .toast-success .toast-indicator {
                background-color: var(--outcome-yes);
            }
            .toast-destructive .toast-indicator {
                background-color: var(--status-loss-border);
            }
            .toast-warning .toast-indicator {
                background-color: var(--status-warning);
            }
            .toast-info .toast-indicator {
                background-color: var(--status-info);
            }

            /* --- Icons --- */
            .toast-icon-box {
                flex-shrink: 0;
                margin-top: 1px;
            }

            .toast-icon {
                width: 18px;
                height: 18px;
            }

            .icon-default {
                color: var(--primary-border);
            }
            .icon-success {
                color: var(--outcome-yes-text);
            }
            .icon-destructive {
                color: var(--status-loss);
            }
            .icon-warning {
                color: var(--status-warning);
            }
            .icon-info {
                color: var(--status-info);
            }

            /* --- Content --- */
            .toast-body {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }

            .toast-title {
                font-family: var(--font-ui);
                font-size: 14px;
                font-weight: 600;
                line-height: 1.3;
                color: var(--ink);
            }

            .toast-description {
                font-family: var(--font-ui);
                font-size: 13px;
                line-height: 1.4;
                color: var(--muted);
            }

            /* --- Action Button --- */
            .toast-action-btn {
                flex-shrink: 0;
                align-self: center;
            }

            /* --- Close Button --- */
            .toast-close-btn {
                flex-shrink: 0;
                margin: -8px -8px -8px 0;
            }

            .close-icon {
                width: 16px;
                height: 16px;
            }
        `
    ]
})
export class ToastContainerComponent {
    readonly toastService = inject(ToastService);

    /** Resume auto-dismiss only when focus leaves the toast entirely. */
    onFocusOut(event: FocusEvent, id: string): void {
        const toastEl = event.currentTarget as HTMLElement;
        const next = event.relatedTarget as Node | null;
        if (!next || !toastEl.contains(next)) {
            this.toastService.resume(id);
        }
    }

    onAction(toast: Toast): void {
        if (toast.action) {
            toast.action.onClick();
            this.toastService.dismiss(toast.id);
        }
    }
}
