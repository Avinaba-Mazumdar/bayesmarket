import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ServerWakeService } from '../../services/server-wake.service';

@Component({
    selector: 'app-server-wake-banner',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <div class="wake-region" role="status" aria-live="polite">
            @if (wake.waking()) {
                <div class="wake-banner">
                    <span class="wake-spinner" aria-hidden="true"></span>
                    <span class="wake-text">
                        <strong>Waking the server.</strong>
                        It sleeps when idle, so the first request can take up to a minute.
                    </span>
                </div>
            }
        </div>
    `,
    styles: [
        `
            .wake-region {
                position: fixed;
                left: 50%;
                bottom: 20px;
                transform: translateX(-50%);
                z-index: 9998;
                width: max-content;
                max-width: calc(100vw - 32px);
                pointer-events: none;
            }

            .wake-banner {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                background-color: var(--surface-glass);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-lg);
                backdrop-filter: blur(12px);
            }

            .wake-text {
                font-family: var(--font-ui);
                font-size: 13px;
                line-height: 1.4;
                color: var(--muted);
            }

            .wake-text strong {
                font-weight: 600;
                color: var(--ink);
            }

            .wake-spinner {
                flex: none;
                width: 14px;
                height: 14px;
                border: 2px solid var(--hairline);
                border-top-color: var(--primary-border);
                border-radius: 50%;
                animation: wake-spin 0.8s linear infinite;
            }

            @keyframes wake-spin {
                to {
                    transform: rotate(360deg);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .wake-spinner {
                    animation: none;
                }
            }
        `
    ]
})
export class ServerWakeBannerComponent {
    protected readonly wake = inject(ServerWakeService);
}
