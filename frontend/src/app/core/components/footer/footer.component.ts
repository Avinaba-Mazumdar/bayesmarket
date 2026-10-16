import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandIconComponent } from '../../../shared/components/brand-icon/brand-icon.component';

@Component({
    selector: 'app-footer',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, BrandIconComponent],
    template: `
        <footer class="app-footer" role="contentinfo" aria-label="BayesMarket Footer">
            <div class="footer-container">
                <!-- Top: Brand & Regulatory / Simulation Disclaimer -->
                <div class="footer-disclaimer-row">
                    <div class="footer-brand">
                        <app-brand-icon [size]="24"></app-brand-icon>
                        <span class="footer-brand-name">Bayes<span class="brand-highlight">Market</span></span>
                        <span class="footer-badge">Paper Trading Only</span>
                    </div>
                    <p class="footer-disclaimer-text">
                        BayesMarket (<code>bayesmarket.avinaba.com</code>) is an educational binary prediction market simulator and mathematical research
                        exchange. All transactions operate exclusively using simulated play-money credits ("BayesMarket Mock USDC"). Virtual credits have zero
                        (0) real-world monetary value and cannot be redeemed, deposited, or withdrawn for fiat currency or cryptocurrency.
                    </p>
                </div>

                <!-- Bottom: Navigation & Copyright -->
                <div class="footer-bottom-row">
                    <div class="footer-nav" role="navigation" aria-label="Legal and Platform Links">
                        <a routerLink="/" class="footer-link">Markets</a>
                        <span class="dot-divider" aria-hidden="true">&bull;</span>
                        <a routerLink="/portfolio" class="footer-link">Portfolio</a>
                        <span class="dot-divider" aria-hidden="true">&bull;</span>
                        <a routerLink="/privacy" class="footer-link">Privacy Policy</a>
                        <span class="dot-divider" aria-hidden="true">&bull;</span>
                        <a routerLink="/terms" class="footer-link">Terms &amp; Conditions</a>
                        <span class="dot-divider" aria-hidden="true">&bull;</span>
                        <a
                            href="https://github.com/bayesmarket/bayesmarket"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="footer-link external-link"
                            aria-label="BayesMarket GitHub repository (opens in a new tab)"
                        >
                            GitHub OSS
                        </a>
                    </div>

                    <div class="footer-copy">
                        <span>&copy; 2026 BayesMarket. MIT Licensed.</span>
                    </div>
                </div>
            </div>
        </footer>
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
                margin-top: auto;
            }

            .app-footer {
                background-color: var(--canvas-subtle, #0e0c1c);
                border-top: 1px solid var(--hairline, #252140);
                padding: var(--space-xl, 24px) var(--space-lg, 20px);
                font-family: var(--font-ui);
                color: var(--muted, #b8b3d4);
                font-size: 13px;
            }

            .footer-container {
                max-width: 1560px;
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                gap: var(--space-md, 16px);
            }

            .footer-disclaimer-row {
                display: flex;
                flex-direction: column;
                gap: var(--space-xs, 8px);
                padding-bottom: var(--space-md, 16px);
                border-bottom: 1px solid var(--hairline, #1c1836);
            }

            .footer-brand {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .footer-brand-name {
                font-size: 15px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                letter-spacing: -0.01em;
            }

            .brand-highlight {
                color: var(--primary-text, #c4b5fd);
            }

            .footer-badge {
                font-size: 11px;
                font-weight: 600;
                color: var(--accent, #7dd3fc);
                background-color: var(--accent-subtle, rgba(56, 189, 248, 0.12));
                border: 1px solid var(--accent, #7dd3fc);
                padding: 1px 6px;
                border-radius: var(--radius-pill, 9999px);
                letter-spacing: 0.02em;
                text-transform: uppercase;
            }

            .footer-disclaimer-text {
                font-size: 12px;
                line-height: 1.5;
                color: var(--muted, #b8b3d4);
                margin: 0;
                max-width: 1200px;
            }

            .footer-disclaimer-text code {
                font-family: var(--font-mono);
                background-color: var(--surface-card, #131126);
                padding: 1px 4px;
                border-radius: var(--radius-xs, 4px);
                border: 1px solid var(--hairline, #352f5e);
            }

            .footer-bottom-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: var(--space-md, 16px);
            }

            .footer-nav {
                display: flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
            }

            .footer-link {
                color: var(--body, #cbd5e1);
                text-decoration: none;
                font-weight: 500;
                font-size: 13px;
                transition: color 0.15s ease;
                min-height: 24px;
                display: inline-flex;
                align-items: center;
            }

            .footer-link:hover {
                color: var(--primary-text, #c4b5fd);
                text-decoration: underline;
                text-underline-offset: 3px;
            }

            .dot-divider {
                color: var(--hairline, #352f5e);
                font-size: 10px;
            }

            .footer-copy {
                font-size: 12px;
                color: var(--muted, #8b85b3);
            }

            @media (max-width: 768px) {
                .footer-bottom-row {
                    flex-direction: column;
                    align-items: flex-start;
                }
            }
        `
    ]
})
export class FooterComponent {}
