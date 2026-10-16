import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideShield, LucideLock, LucideArrowLeft, LucideFileText, LucideDatabase, LucideServer } from '@lucide/angular';
import { BrandIconComponent } from '../../../shared/components/brand-icon/brand-icon.component';

@Component({
    selector: 'app-privacy-policy',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, BrandIconComponent, LucideShield, LucideLock, LucideArrowLeft, LucideFileText, LucideDatabase, LucideServer],
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
                <h1 class="legal-title">Privacy Policy</h1>
                <p class="legal-subtitle">Effective Date: October 17, 2026 &bull; Domain: <code>bayesmarket.avinaba.com</code> &bull; Version 1.2</p>
            </header>

            <article class="legal-content">
                <!-- Highlight Callout: Virtual Currency & Simulation Notice -->
                <section class="callout-card simulation-callout" aria-labelledby="sim-notice-title">
                    <div class="callout-icon-wrap">
                        <svg lucideShield [size]="24" class="callout-icon" aria-hidden="true"></svg>
                    </div>
                    <div class="callout-body">
                        <h2 id="sim-notice-title" class="callout-title">Educational Paper-Trading Simulation Notice</h2>
                        <p class="callout-text">
                            BayesMarket (<code>https://bayesmarket.avinaba.com</code>) is an open-source binary prediction market exchange engineered strictly
                            for educational, mathematical research, and simulation purposes. All trading activities utilize simulated play-money credits
                            (<strong>"BayesMarket Mock USDC"</strong>).
                        </p>
                        <p class="callout-subtext">
                            <strong>No real money, fiat currency, bank accounts, or cryptocurrency wallets are ever collected, processed, or stored.</strong>
                        </p>
                    </div>
                </section>

                <!-- Section 1: Overview -->
                <section class="legal-section" aria-labelledby="sec-overview">
                    <h2 id="sec-overview" class="section-heading">1. Introduction & Open Source Scope</h2>
                    <p>
                        This Privacy Policy describes how BayesMarket ("we", "us", "our", or the "Platform"), hosted at
                        <code>bayesmarket.avinaba.com</code>, collects, handles, and protects information when you visit or interact with our exchange
                        interface. BayesMarket is an open-source software project licensed under the <strong>MIT License</strong>.
                    </p>
                    <p>
                        We are committed to operating with radical transparency and minimizing data collection. We adhere to privacy-by-design principles,
                        strictly isolating user data within modern cryptographic session boundaries and avoiding predatory data brokerage, cross-site tracking
                        cookies, and behavioral advertising.
                    </p>
                </section>

                <!-- Section 2: Information We Collect -->
                <section class="legal-section" aria-labelledby="sec-collection">
                    <h2 id="sec-collection" class="section-heading">2. Information We Collect</h2>
                    <p>
                        We only process information essential to operating the market simulation, enforcing abuse prevention, and safeguarding platform
                        integrity:
                    </p>

                    <div class="info-grid">
                        <div class="info-card">
                            <div class="info-card-header">
                                <svg lucideLock [size]="18" class="info-icon" aria-hidden="true"></svg>
                                <h3>Ephemeral Guest Sessions</h3>
                            </div>
                            <p>
                                Visitors can trade immediately as an anonymous guest. The application generates a pseudonymous UUID v4 identifier. We do not
                                collect names, email addresses, or phone numbers for guest accounts. Guest balances and positions are bound strictly to that
                                session UUID.
                            </p>
                        </div>

                        <div class="info-card">
                            <div class="info-card-header">
                                <svg lucideFileText [size]="18" class="info-icon" aria-hidden="true"></svg>
                                <h3>Google OAuth 2.0 Profiles</h3>
                            </div>
                            <p>
                                If you choose to connect a Google account via Google Identity Services (GIS), Google shares your basic public profile (name,
                                email address, and avatar image URL) upon your explicit authorization. We use this strictly to identify your trader profile
                                across sessions.
                            </p>
                        </div>

                        <div class="info-card">
                            <div class="info-card-header">
                                <svg lucideDatabase [size]="18" class="info-icon" aria-hidden="true"></svg>
                                <h3>Market & Trading Records</h3>
                            </div>
                            <p>
                                All simulated market quotes, orders, cashouts, and claim history are recorded in our relational database to compute real-time
                                Constant Product Market Maker (CPMM) reserves, share balances, and trade audit trails.
                            </p>
                        </div>

                        <div class="info-card">
                            <div class="info-card-header">
                                <svg lucideServer [size]="18" class="info-icon" aria-hidden="true"></svg>
                                <h3>Abuse Mitigation & IP Addresses</h3>
                            </div>
                            <p>
                                Client IP addresses are evaluated by in-memory rate limiters and claim cooldown engines (e.g. enforcing our 24-hour claim
                                interval and anti-DDoS thresholds). IP addresses in database claim records are stored for operational integrity and are not
                                linked to advertising profiles.
                            </p>
                        </div>
                    </div>
                </section>

                <!-- Section 3: Storage & Cookie Policy -->
                <section class="legal-section" aria-labelledby="sec-cookies">
                    <h2 id="sec-cookies" class="section-heading">3. Storage & Cookie Policy</h2>
                    <p>BayesMarket rejects pervasive tracking. We do not use third-party tracking cookies, web beacons, or ad pixels:</p>
                    <ul class="legal-list">
                        <li>
                            <strong>Session Tokens (<code>sessionStorage</code>):</strong> Authentication tokens (Bearer JWT) are stored within your browser's
                            <code>sessionStorage</code>. They are automatically cleared when you close your browser tab, preventing long-term disk residency.
                        </li>
                        <li>
                            <strong>User Preferences (<code>localStorage</code>):</strong> We store your chosen visual display theme (light vs. obsidian dark
                            mode) locally on your device for immediate rendering upon return.
                        </li>
                        <li>
                            <strong>Zero Tracking Cookies:</strong> We do not issue cross-domain tracking cookies. Session state is passed explicitly via HTTP
                            <code>Authorization</code> request headers, preventing cookie hijacking across subdomains.
                        </li>
                    </ul>
                </section>

                <!-- Section 4: Third-Party Infrastructure -->
                <section class="legal-section" aria-labelledby="sec-providers">
                    <h2 id="sec-providers" class="section-heading">4. Infrastructure & Third-Party Service Providers</h2>
                    <p>BayesMarket utilizes high-reliability, security-hardened cloud providers to host its open-source infrastructure:</p>
                    <div class="table-wrapper">
                        <table class="legal-table" aria-label="Third-party service providers and their data processing scope">
                            <thead>
                                <tr>
                                    <th scope="col">Provider</th>
                                    <th scope="col">Purpose</th>
                                    <th scope="col">Location & Privacy Posture</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td><strong>Vercel Inc.</strong></td>
                                    <td>Edge CDN hosting of static Angular SPA frontend assets at <code>bayesmarket.avinaba.com</code></td>
                                    <td>Global Edge Network &bull; SOC 2 Type II certified &bull; GDPR compliant</td>
                                </tr>
                                <tr>
                                    <td><strong>Render Services, Inc.</strong></td>
                                    <td>Containerized Go REST & WebSocket execution backend</td>
                                    <td>United States (Oregon/Virginia) &bull; TLS 1.3 encrypted in transit</td>
                                </tr>
                                <tr>
                                    <td><strong>Neon, Inc.</strong></td>
                                    <td>Serverless PostgreSQL database storing simulated markets and balances</td>
                                    <td>AWS us-east-2 &bull; Encrypted at rest (AES-256) and in transit (SSLMode=require)</td>
                                </tr>
                                <tr>
                                    <td><strong>Google LLC</strong></td>
                                    <td>Optional OAuth 2.0 single sign-on authentication and Google Fonts</td>
                                    <td>Subject to Google Privacy Policy & OAuth Consent Scopes</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <!-- Section 5: Subdomain Security & Isolation -->
                <section class="legal-section" aria-labelledby="sec-subdomain">
                    <h2 id="sec-subdomain" class="section-heading">5. Subdomain Security & Isolation</h2>
                    <p>BayesMarket operates under the dedicated subdomain <code>bayesmarket.avinaba.com</code>. We enforce strict browser-level isolation:</p>
                    <ul class="legal-list">
                        <li>
                            <strong>Strict-Transport-Security (HSTS):</strong> All communications require TLS/HTTPS with a 1-year max-age policy, blocking
                            downgrade attacks.
                        </li>
                        <li>
                            <strong>Framing & Clickjacking Defense:</strong> HTTP headers emit <code>X-Frame-Options: DENY</code> and
                            <code>Content-Security-Policy: frame-ancestors 'none'</code>, prohibiting rogue sites or sibling subdomains from embedding the
                            trading terminal.
                        </li>
                        <li>
                            <strong>Origin Scoping:</strong> Browser <code>sessionStorage</code> is bound strictly to
                            <code>https://bayesmarket.avinaba.com:443</code>, preventing scripts on other <code>*.avinaba.com</code> subdomains from reading
                            session tokens.
                        </li>
                    </ul>
                </section>

                <!-- Section 6: Data Retention & User Rights -->
                <section class="legal-section" aria-labelledby="sec-rights">
                    <h2 id="sec-rights" class="section-heading">6. Data Retention & Your Rights</h2>
                    <p>
                        Under modern privacy frameworks including the European Union General Data Protection Regulation (GDPR) and the California Consumer
                        Privacy Act (CCPA), you retain the following rights:
                    </p>
                    <ul class="legal-list">
                        <li>
                            <strong>Right to Deletion:</strong> You may request complete erasure of your user profile and simulation trading history at any
                            time.
                        </li>
                        <li>
                            <strong>Right of Access:</strong> You may request an export of all simulated trades, balances, and profile attributes associated
                            with your email.
                        </li>
                        <li>
                            <strong>Ephemeral Session Lifecycle:</strong> Inactive guest trading sessions are automatically purged after 7 days of inactivity.
                        </li>
                    </ul>
                </section>

                <!-- Section 7: Contact Information -->
                <section class="legal-section" aria-labelledby="sec-contact">
                    <h2 id="sec-contact" class="section-heading">7. Contact Information & Inquiries</h2>
                    <p>If you have questions, privacy concerns, or data erasure requests regarding BayesMarket, please contact our maintainers:</p>
                    <div class="contact-box">
                        <p><strong>Maintainer: </strong> Avinaba Mazumdar</p>
                        <p><strong>Primary Contact: </strong> <a href="mailto:contact@avinaba.com" class="legal-link">contact&#64;avinaba.com</a></p>
                        <p><strong>Web Domain: </strong> <a href="https://bayesmarket.avinaba.com" class="legal-link">https://bayesmarket.avinaba.com</a></p>
                        <p>
                            <strong>Source Repository: </strong>
                            <a href="https://github.com/bayesmarket/bayesmarket" target="_blank" rel="noopener noreferrer" class="legal-link"
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
                padding: var(--space-xl, 24px) var(--space-md, 16px) var(--space-section, 48px);
                color: var(--ink, #0f172a);
                font-family: var(--font-ui);
            }

            .legal-header {
                margin-bottom: var(--space-xxl, 32px);
                border-bottom: 1px solid var(--hairline, #252140);
                padding-bottom: var(--space-xl, 24px);
            }

            .back-link {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
                font-weight: 600;
                color: var(--primary-text, #c4b5fd);
                text-decoration: none;
                margin-bottom: var(--space-md, 16px);
                padding: 6px 12px;
                border-radius: var(--radius-sm, 6px);
                background-color: var(--primary-subtle, rgba(124, 77, 255, 0.12));
                border: 1px solid var(--hairline, #352f5e);
                transition:
                    background-color 0.15s ease,
                    border-color 0.15s ease;
            }

            .back-link:hover {
                background-color: var(--primary-subtle, rgba(124, 77, 255, 0.25));
                border-color: var(--primary-border, #c4b5fd);
            }

            .brand-badge {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: var(--space-xs, 8px);
            }

            .brand-text {
                font-size: 16px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                letter-spacing: -0.01em;
            }

            .brand-highlight {
                color: var(--primary-text, #c4b5fd);
            }

            .legal-title {
                font-size: 32px;
                font-weight: 800;
                color: var(--ink, #f8f7ff);
                letter-spacing: -0.02em;
                margin: var(--space-xs, 8px) 0;
            }

            .legal-subtitle {
                font-size: 14px;
                color: var(--muted, #b8b3d4);
                margin-bottom: 0;
            }

            .legal-subtitle code {
                font-family: var(--font-mono);
                background-color: var(--surface-card, #131126);
                padding: 2px 6px;
                border-radius: var(--radius-xs, 4px);
                border: 1px solid var(--hairline, #352f5e);
            }

            /* Simulation Callout */
            .callout-card {
                display: flex;
                gap: var(--space-md, 16px);
                padding: var(--space-lg, 20px);
                border-radius: var(--radius-lg, 14px);
                margin-bottom: var(--space-xxl, 32px);
            }

            .simulation-callout {
                background-color: var(--primary-subtle, rgba(124, 77, 255, 0.12));
                border: 1px solid var(--primary-border, #c4b5fd);
            }

            .callout-icon-wrap {
                flex-shrink: 0;
                width: 44px;
                height: 44px;
                border-radius: var(--radius-md, 10px);
                background-color: var(--surface-card, #131126);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid var(--hairline, #352f5e);
            }

            .callout-icon {
                color: var(--primary-text, #c4b5fd);
            }

            .callout-title {
                font-size: 18px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                margin-bottom: var(--space-xxs, 4px);
            }

            .callout-text {
                font-size: 15px;
                line-height: var(--line-height-prose, 1.6);
                color: var(--body, #cbd5e1);
                margin-bottom: var(--space-xs, 8px);
                max-width: none;
            }

            .callout-subtext {
                font-size: 14px;
                color: var(--primary-text, #c4b5fd);
                margin-bottom: 0;
                max-width: none;
            }

            /* Sections */
            .legal-section {
                margin-bottom: var(--space-xxl, 36px);
            }

            .section-heading {
                font-size: 20px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
                margin-bottom: var(--space-sm, 12px);
                padding-bottom: 6px;
                border-bottom: 1px solid var(--hairline, #252140);
            }

            p {
                font-size: 15px;
                line-height: var(--line-height-prose, 1.6);
                color: var(--body, #cbd5e1);
                margin-bottom: var(--space-md, 16px);
                max-width: none;
            }

            .legal-list {
                list-style: square;
                padding-left: var(--space-xl, 24px);
                margin-bottom: var(--space-md, 16px);
            }

            .legal-list li {
                font-size: 15px;
                line-height: var(--line-height-prose, 1.6);
                color: var(--body, #cbd5e1);
                margin-bottom: var(--space-xs, 8px);
            }

            /* Info Grid */
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: var(--space-md, 16px);
                margin-top: var(--space-md, 16px);
            }

            .info-card {
                background-color: var(--surface-card, #131126);
                border: 1px solid var(--hairline, #352f5e);
                border-radius: var(--radius-md, 10px);
                padding: var(--space-md, 16px);
            }

            .info-card-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: var(--space-xs, 8px);
            }

            .info-card-header h3 {
                font-size: 16px;
                font-weight: 700;
                color: var(--ink, #f8f7ff);
            }

            .info-icon {
                color: var(--accent, #7dd3fc);
            }

            .info-card p {
                font-size: 14px;
                color: var(--muted, #b8b3d4);
                margin-bottom: 0;
            }

            /* Tables */
            .table-wrapper {
                overflow-x: auto;
                border: 1px solid var(--hairline, #352f5e);
                border-radius: var(--radius-md, 10px);
                margin: var(--space-md, 16px) 0;
                background-color: var(--surface-card, #131126);
            }

            .legal-table {
                width: 100%;
                border-collapse: collapse;
                text-align: left;
                font-size: 14px;
            }

            .legal-table th,
            .legal-table td {
                padding: var(--space-sm, 12px) var(--space-md, 16px);
                border-bottom: 1px solid var(--hairline, #352f5e);
            }

            .legal-table th {
                background-color: var(--surface-card-elevated, #1a1733);
                font-weight: 700;
                color: var(--ink, #f8f7ff);
            }

            .legal-table td {
                color: var(--body, #cbd5e1);
            }

            .legal-table tbody tr:last-child td {
                border-bottom: none;
            }

            /* Contact Box */
            .contact-box {
                background-color: var(--surface-card, #131126);
                border: 1px solid var(--hairline, #352f5e);
                border-radius: var(--radius-md, 10px);
                padding: var(--space-lg, 20px);
                margin-top: var(--space-md, 16px);
            }

            .contact-box p {
                margin-bottom: var(--space-xxs, 6px);
                font-size: 14px;
            }

            .contact-box p:last-child {
                margin-bottom: 0;
            }

            .legal-link {
                color: var(--link, #c4b5fd);
                text-decoration: underline;
                text-underline-offset: 3px;
            }

            .legal-link:hover {
                color: var(--link-active, #ffffff);
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
export class PrivacyPolicyComponent {}
