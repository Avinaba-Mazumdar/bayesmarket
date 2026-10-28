import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAlertTriangle, LucideArrowLeft, LucideShieldCheck } from '@lucide/angular';
import { BrandIconComponent } from '../../../shared/components/brand-icon/brand-icon.component';

@Component({
    selector: 'app-terms',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, BrandIconComponent, LucideAlertTriangle, LucideArrowLeft, LucideShieldCheck],
    template: `
        <div class="legal-page-container">
            <header class="legal-header">
                <a routerLink="/" class="back-link" aria-label="Return to BayesMarket prediction markets">
                    <svg lucideArrowLeft [size]="16" aria-hidden="true"></svg>
                    <span>Back to Markets</span>
                </a>
                <div class="brand-badge">
                    <app-brand-icon [size]="28"></app-brand-icon>
                    <span class="brand-text">Bayes<span class="brand-highlight">Market</span> Legal</span>
                </div>
                <h1 class="legal-title">Terms and Conditions</h1>
                <p class="legal-subtitle">Effective Date: October 17, 2026 &bull; Domain: <code>bayesmarket.avinaba.com</code> &bull; Version 1.2</p>
            </header>

            <article class="legal-content">
                <!-- Highlight Warning: Educational Paper Trading Only -->
                <section class="callout-card simulation-warning" aria-labelledby="terms-warning-title">
                    <div class="callout-icon-wrap">
                        <svg lucideAlertTriangle [size]="24" class="callout-icon" aria-hidden="true"></svg>
                    </div>
                    <div class="callout-body">
                        <h2 id="terms-warning-title" class="callout-title">Simulation & Educational Use Disclaimer &mdash; Zero Real Money</h2>
                        <p class="callout-text">
                            BayesMarket is strictly an educational paper-trading simulator and algorithmic research exchange. All trading balances, orders,
                            claims, and settlements operate exclusively with simulated virtual credits (<strong>"BayesMarket Mock USDC"</strong>).
                        </p>
                        <p class="callout-subtext">
                            <strong>
                                Virtual Mock USDC has zero (0) real-world monetary value and cannot be withdrawn, redeemed, exchanged, or converted into fiat
                                currency, cryptocurrency, or tangible property. BayesMarket is not a licensed financial broker, investment advisor, or gambling
                                service.
                            </strong>
                        </p>
                    </div>
                </section>

                <!-- Section 1: Agreement to Terms -->
                <section class="legal-section" aria-labelledby="sec-terms-agreement">
                    <h2 id="sec-terms-agreement" class="section-heading">1. Acceptance of Terms</h2>
                    <p>
                        By visiting, registering, trading, or utilizing the web interface at <code>bayesmarket.avinaba.com</code> (the "Platform"), you signify
                        that you have read, understood, and agreed to be bound by these Terms and Conditions ("Terms"). If you do not agree to all terms and
                        conditions set forth herein, you are expressly prohibited from using the Platform and must cease use immediately.
                    </p>
                </section>

                <!-- Section 2: Educational Nature & No Financial Advice -->
                <section class="legal-section" aria-labelledby="sec-terms-educational">
                    <h2 id="sec-terms-educational" class="section-heading">2. Educational Sandbox & No Investment Advice</h2>
                    <p>
                        The Platform is created to research and demonstrate mathematical Constant Product Market Maker (CPMM) pricing algorithms and
                        probabilistic consensus mechanisms.
                    </p>
                    <ul class="legal-list">
                        <li>
                            <strong>No Financial Advisory:</strong> No content, market title, commentary, or probability metric displayed on BayesMarket
                            constitutes financial, investment, legal, regulatory, or tax advice.
                        </li>
                        <li>
                            <strong>No Real-Money Wagering or Gambling:</strong> BayesMarket does not accept deposits or facilitate betting with real currency,
                            bank transfers, or blockchain tokens. Participation is restricted to simulated demonstration balances.
                        </li>
                        <li>
                            <strong>No Regulatory Guarantee:</strong> The Platform is not registered with the U.S. Commodity Futures Trading Commission (CFTC),
                            the Securities and Exchange Commission (SEC), or any equivalent global financial regulatory body.
                        </li>
                    </ul>
                </section>

                <!-- Section 3: Open Source License -->
                <section class="legal-section" aria-labelledby="sec-terms-license">
                    <h2 id="sec-terms-license" class="section-heading">3. Open Source Software & MIT License</h2>
                    <p>The BayesMarket source code is distributed publicly under the terms of the <strong>MIT License</strong>:</p>
                    <div class="code-quote">
                        <p class="mono-text">
                            "THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
                            MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
                            FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
                            CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE."
                        </p>
                    </div>
                </section>

                <!-- Section 4: Market Mechanics & Automated Market Maker -->
                <section class="legal-section" aria-labelledby="sec-terms-amm">
                    <h2 id="sec-terms-amm" class="section-heading">4. Automated Market Maker (AMM) Mechanics & Trading Rules</h2>
                    <p>All binary prediction contracts on BayesMarket follow strict mathematical formulations:</p>
                    <ul class="legal-list">
                        <li>
                            <strong>Complete-Set Constant Product AMM:</strong> Each binary market mints complete sets of paired YES and NO outcome shares
                            collateralized 1:1 by simulated USDC deposits (<code>k = R_yes &times; R_no</code>).
                        </li>
                        <li>
                            <strong>Probabilistic Pricing:</strong> Contract share prices reflect market-implied probabilities ranging between 0.01 and 0.99
                            USDC per share.
                        </li>
                        <li>
                            <strong>Slippage & Price Impact:</strong> Large trades relative to liquidity pool reserves incur mathematical price impact. Users
                            can configure maximum slippage limits in the trading terminal to protect simulated order execution.
                        </li>
                    </ul>
                </section>

                <!-- Section 5: Market Resolutions & Oracle Proofs -->
                <section class="legal-section" aria-labelledby="sec-terms-resolution">
                    <h2 id="sec-terms-resolution" class="section-heading">5. Market Resolution, Settlement & Oracle Proofs</h2>
                    <p>Prediction markets settle based upon the criteria specified in each market's <code>resolution_source</code>:</p>
                    <div class="info-card">
                        <div class="info-card-header">
                            <svg lucideShieldCheck [size]="18" class="info-icon" aria-hidden="true"></svg>
                            <h3>Deterministic Settlement & Oracle Digest</h3>
                        </div>
                        <p>
                            Upon market conclusion, designated system administrators resolve the contract to either YES or NO based on public, verifiable facts.
                            Each resolution generates a SHA-256 settlement digest and oracle proof recorded in the database. Winning share holders receive 1.00
                            simulated USDC per share, while losing shares expire worthless. All simulated settlements are final and irreversible.
                        </p>
                    </div>
                </section>

                <!-- Section 6: Acceptable Use Policy -->
                <section class="legal-section" aria-labelledby="sec-terms-use">
                    <h2 id="sec-terms-use" class="section-heading">6. Acceptable Use Policy</h2>
                    <p>Users of BayesMarket agree to maintain platform stability and fairness:</p>
                    <ul class="legal-list">
                        <li>
                            <strong>No Automated Flooding:</strong> You may not use automated scripts, bots, or distributed attacks to flood our REST or
                            WebSocket APIs, exceed designated rate limits, or bypass the 24-hour claim cooldown interval.
                        </li>
                        <li>
                            <strong>No Exploit Exploitation:</strong> You agree not to exploit mathematical edge cases, concurrency bugs, or security flaws to
                            artificially inflate simulated account balances.
                        </li>
                        <li>
                            <strong>No Malicious Content:</strong> You may not submit malicious payloads, script tags, or deceptive text in market creation or
                            proposal fields.
                        </li>
                    </ul>
                </section>

                <!-- Section 7: Account Lifecycle & Ephemeral Sessions -->
                <section class="legal-section" aria-labelledby="sec-terms-accounts">
                    <h2 id="sec-terms-accounts" class="section-heading">7. Account Lifecycle & Ephemeral Sessions</h2>
                    <p>
                        Guest sessions are provisioned with an initial grant of 1,000 simulated USDC credits. Guest accounts are ephemeral and may be cleared
                        after 7 days of inactivity. Connecting a verified Google OAuth account links your simulation history to your identity. We reserve the
                        right to suspend or terminate any session that violates our Acceptable Use Policy.
                    </p>
                </section>

                <!-- Section 8: Limitation of Liability -->
                <section class="legal-section" aria-labelledby="sec-terms-liability">
                    <h2 id="sec-terms-liability" class="section-heading">8. Limitation of Liability</h2>
                    <p>
                        To the maximum extent permitted by applicable law, in no event shall the authors, maintainers, hosting entities, or contributors of
                        BayesMarket be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, loss of
                        goodwill, system downtime, network interruptions, or any other losses resulting from:
                    </p>
                    <ul class="legal-list">
                        <li>Your access to, use of, or inability to access or use the Platform.</li>
                        <li>Any bugs, errors, glitches, or inaccuracies in mathematical calculations or order book matching.</li>
                        <li>Any unauthorized access to our servers, infrastructure, or session state.</li>
                        <li>Discrepancies in oracle resolution sources or market settlement timings.</li>
                    </ul>
                </section>

                <!-- Section 9: Governing Law & Contact -->
                <section class="legal-section" aria-labelledby="sec-terms-contact">
                    <h2 id="sec-terms-contact" class="section-heading">9. Governing Law, Amendments & Contact</h2>
                    <p>
                        These Terms shall be governed by and construed in accordance with standard open-source conventions and applicable law. We reserve the
                        right to modify these Terms at any time by updating this page with an amended effective date.
                    </p>
                    <div class="contact-box">
                        <p><strong>Maintainer: </strong> Avinaba Mazumdar</p>
                        <p><strong>Legal & Security Inquiries: </strong> <a href="mailto:contact@avinaba.com" class="legal-link">contact&#64;avinaba.com</a></p>
                        <p>
                            <strong>Production Domain: </strong>
                            <a href="https://bayesmarket.avinaba.com" class="legal-link">https://bayesmarket.avinaba.com</a>
                        </p>
                        <p>
                            <strong>Repository: </strong>
                            <a href="https://github.com/Avinaba-Mazumdar/bayesmarket" target="_blank" rel="noopener noreferrer" class="legal-link"
                                >GitHub &mdash; BayesMarket Open Source</a
                            >
                        </p>
                    </div>
                </section>
            </article>
        </div>
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
            }

            .legal-page-container {
                max-width: 960px;
                margin: 0 auto;
                padding: var(--space-xl) var(--space-md) var(--space-section);
                color: var(--ink);
                font-family: var(--font-ui);
            }

            .legal-header {
                margin-bottom: var(--space-xxl);
                border-bottom: 1px solid var(--hairline);
                padding-bottom: var(--space-xl);
            }

            .back-link {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: var(--primary-text);
                text-decoration: none;
                margin-bottom: var(--space-md);
                padding: 6px 12px;
                border-radius: var(--radius-sm);
                background-color: var(--primary-subtle);
                border: 1px solid var(--hairline);
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease;
            }

            .back-link:hover {
                background-color: var(--primary-subtle);
                border-color: var(--primary-border);
            }

            .brand-badge {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: var(--space-xs);
            }

            .brand-text {
                font-size: 16px;
                font-weight: 700;
                color: var(--ink);
                letter-spacing: -0.01em;
            }

            .brand-highlight {
                color: var(--primary-text);
            }

            .legal-title {
                font-size: 32px;
                font-weight: 800;
                color: var(--ink);
                letter-spacing: -0.02em;
                margin: var(--space-xs) 0;
            }

            .legal-subtitle {
                font-size: 14px;
                color: var(--muted);
                margin-bottom: 0;
            }

            .legal-subtitle code {
                font-family: var(--font-mono);
                background-color: var(--surface-card);
                padding: 2px 6px;
                border-radius: var(--radius-xs);
                border: 1px solid var(--hairline);
            }

            /* Warning Callout */
            .callout-card {
                display: flex;
                gap: var(--space-md);
                padding: var(--space-lg);
                border-radius: var(--radius-lg);
                margin-bottom: var(--space-xxl);
            }

            .simulation-warning {
                background-color: rgba(252, 211, 77, 0.1);
                border: 1px solid var(--status-warning-border);
            }

            .callout-icon-wrap {
                flex-shrink: 0;
                width: 44px;
                height: 44px;
                border-radius: var(--radius-md);
                background-color: var(--surface-card);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--hairline);
            }

            .callout-icon {
                color: var(--status-warning);
            }

            .callout-title {
                font-size: 18px;
                font-weight: 700;
                color: var(--ink);
                margin-bottom: var(--space-xxs);
            }

            .callout-text {
                font-size: 15px;
                line-height: var(--line-height-prose);
                color: var(--body);
                margin-bottom: var(--space-xs);
                max-width: none;
            }

            .callout-subtext {
                font-size: 14px;
                color: var(--status-warning);
                margin-bottom: 0;
                max-width: none;
            }

            /* Code Quote for MIT */
            .code-quote {
                background-color: var(--surface-card);
                border-left: 4px solid var(--primary-border);
                border-top: 1px solid var(--hairline);
                border-right: 1px solid var(--hairline);
                border-bottom: 1px solid var(--hairline);
                border-radius: var(--radius-sm);
                padding: var(--space-md);
                margin: var(--space-md) 0;
            }

            .mono-text {
                font-family: var(--font-mono);
                font-size: 13px;
                line-height: 1.6;
                color: var(--muted);
                margin-bottom: 0;
            }

            /* Sections */
            .legal-section {
                margin-bottom: var(--space-xxl);
            }

            .section-heading {
                font-size: 20px;
                font-weight: 700;
                color: var(--ink);
                margin-bottom: var(--space-sm);
                padding-bottom: 6px;
                border-bottom: 1px solid var(--hairline);
            }

            p {
                font-size: 15px;
                line-height: var(--line-height-prose);
                color: var(--body);
                margin-bottom: var(--space-md);
                max-width: none;
            }

            .legal-list {
                list-style: square;
                padding-left: var(--space-xl);
                margin-bottom: var(--space-md);
            }

            .legal-list li {
                font-size: 15px;
                line-height: var(--line-height-prose);
                color: var(--body);
                margin-bottom: var(--space-xs);
            }

            /* Info Card */
            .info-card {
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: var(--space-lg);
                margin: var(--space-md) 0;
            }

            .info-card-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: var(--space-xs);
            }

            .info-card-header h3 {
                font-size: 16px;
                font-weight: 700;
                color: var(--ink);
            }

            .info-icon {
                color: var(--accent);
            }

            .info-card p {
                font-size: 14px;
                color: var(--body);
                margin-bottom: 0;
            }

            /* Contact Box */
            .contact-box {
                background-color: var(--surface-card);
                border: 1px solid var(--hairline);
                border-radius: var(--radius-md);
                padding: var(--space-lg);
                margin-top: var(--space-md);
            }

            .contact-box p {
                margin-bottom: var(--space-xxs);
                font-size: 14px;
            }

            .contact-box p:last-child {
                margin-bottom: 0;
            }

            .legal-link {
                color: var(--link);
                text-decoration: underline;
                text-underline-offset: 3px;
            }

            .legal-link:hover {
                color: var(--link-active);
            }

            @media (max-width: 640px) {
                .legal-title {
                    font-size: 26px;
                }
                .callout-card {
                    flex-direction: column;
                }
            }
        `
    ]
})
export class TermsComponent {}
