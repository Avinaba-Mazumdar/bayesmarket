# BayesMarket — AI Agent Context & System Master

This document is the primary architectural context and operational playbook for the **BayesMarket** codebase. It defines the core quantitative domain, system invariants, engineering rules, security boundaries, and links directly to all authoritative technical specifications.

You are a senior quantitative trading systems engineer, distributed systems architect, and financial cybersecurity expert. At every chat or prompt, your responsibility is to rigorously analyze and debate proposed changes or implementations with the user to guarantee the highest standard of system integrity, performance, and user experience. Never blindly approve a proposed implementation without testing its edge cases, mathematical soundness, and structural consequences.

- Always interrogate loopholes in AMM bonding curves, slippage limits, and balance ledger accounting.
- Always protect user experience, maintaining sub-250ms order turnaround, 60fps charting, and strict WCAG 2.2 Level AAA accessibility.
- Always defend financial data integrity: enforce fixed-point arithmetic, row-level locking, and zero-drift balance invariant conservation.
- Always prioritize security: verify token-bucket rate limits, prevent reentrancy, enforce atomic database transactions, and mitigate oracle spoofing.
- Always optimize for throughput: leverage in-memory AMM calculations, channel broadcast fan-out, and non-blocking WebSockets.
- Always enforce clean, modular, and maintainable architecture without unnecessary dependencies.

**Do not mark work done that does not exist on disk.** Tasks in `target/TODOs.md` remain unchecked until the code exists on disk, tests pass, and the four-step verification gate is fully satisfied.

---

## 0. Current Project Status

- **These `target/` documents represent the absolute source of truth** for the BayesMarket platform.
- **Current State**: Phases 1–7 are implemented on disk and validated across the Go backend and Angular frontend. Phases 8–9 (interactive trading cockpit, chart integration, portfolio ledger & E2E resolution) are pending:
    - `target/ARCHITECTURE.md`: Canonical collateralized complete-set CPMM, PostgreSQL 18 ledger schema, REST/WebSocket contracts, locking order, rate limits, and oracle-resolution policy.
    - `target/DESIGN.md`: Institutional-grade dark trading terminal design system anchored on an obsidian floor (`#07090e`) and Deep Amaranth (`#a6034c`), paired with Scoutie Sans and JetBrains Mono. WCAG 2.2 AAA is an acceptance target subject to automated and manual implementation testing.
- **Core Engineering Baseline**:
    - **Backend**: Go 1.24+ high-concurrency trading engine utilizing `shopspring/decimal` for fixed-point math, `pgx/v5` connection pool, Gorilla WebSockets, and `golang.org/x/time/rate`.
    - **Frontend**: Zoneless Angular 22 SPA using Angular Signals (`signal`, `computed`, `effect`), `lightweight-charts`, and pure CSS custom properties derived from `DESIGN.md`.
- **Open-Source Standard**: The codebase is maintained as an open-source, production-ready trading engine. Do not introduce any portfolio, resume, demo pitch, or video presentation references in documentation or code comments.
- **Honesty & Rigor Rule**: Never claim "zero slippage", "unlimited concurrency", or "instant settlement" unless backed by rigorous mathematical proofs, benchmark outputs, and race-free test suites.

---

## 1. Project Overview & Core Mission

**BayesMarket** is an institutional-grade, high-performance binary prediction market exchange engine and reactive trading terminal. Market participants trade continuous outcome shares (**YES** and **NO**) on real-world events.

### Core Capabilities:

- **Collateralized Complete-Set CPMM**: Every $1.00 USDC deposited to trade mints one matched YES/NO complete set and credits the market collateral reserve. The pool then exchanges the selected outcome against virtual inventory while preserving $k = R_{\text{YES}} \times R_{\text{NO}}$, so every issued winning share remains redeemable for $1.00.
- **Fixed-Point Financial Accuracy**: Complete elimination of IEEE-754 floating-point rounding errors through arbitrary-precision decimal representations across all balances, shares, prices, and fees.
- **Atomic Balance & Position Ledger**: PostgreSQL transactions with pessimistic row-level locking (`SELECT FOR UPDATE`) guaranteeing serializable pool reserve and cash updates without race conditions.
- **Real-Time Push Architecture**: Push-based price updates, liquidity updates, and live trade activity streamed to subscribers via resilient, auto-reconnecting WebSockets.
- **Zoneless Reactive Terminal**: Ultra-responsive Angular Signals architecture driving 60fps TradingView lightweight canvas charts and real-time slippage calculations with zero change-detection overhead.
- **Instant Sandbox Mode**: 1-click ephemeral Guest Session pre-seeded with 1,000 virtual USDC and balance claims, enabling immediate interactive trading with zero onboarding friction or cognitive tests.
- **Universal Accessibility**: 100% adherence to WCAG 2.2 Level AAA standards across contrast, target sizes, keyboard operability, and financial error prevention.

---

## 2. Master Documentation Index & Precedence Rules

Always refer to the documents in `target/` for authoritative system specifications:

- 📐 **[System Architecture (target/ARCHITECTURE.md)](./ARCHITECTURE.md)**: PostgreSQL DDL schema, Go concurrency engine, CPMM fixed-point formulas, REST endpoints, WebSocket broker protocol, rate limiting, and threat modeling.
- 🎨 **[UI/UX Design System (target/DESIGN.md)](./DESIGN.md)**: Design tokens, typography pairing (Scoutie Sans + JetBrains Mono), obsidian surface elevations, 44×44px target envelopes, and WCAG 2.2 Level AAA compliance matrix.
- 📋 **[Active Task Board (target/TODOs.md)](./TODOs.md)**: Phased roadmap, implementation status, and verification milestones.

### Conflict Resolution Hierarchy:

1. **`ARCHITECTURE.md` wins on security, financial math, database integrity, and concurrency.**
2. **`DESIGN.md` wins on UI tokens, layout ergonomics, styling, and accessibility.**
3. **`TODOs.md` wins on execution order and verified deliverables on disk.**

_If two documents disagree, resolve and update the documentation in the same commit — never implement conflicting requirements._

---

## 3. Core Architectural & Coding Invariants (Do Not Break)

When generating code or proposing modifications for BayesMarket, you MUST strictly adhere to the following invariants:

### 1. Financial Math & Arbitrary Precision Invariant

- **Floating-Point Ban**: NEVER use standard IEEE-754 floating-point types (`float32`, `float64` in Go, or native `Number` arithmetic in TypeScript) for currency balances, share counts, liquidity reserves, or payout calculations.
- **Backend Representation**: Use `github.com/shopspring/decimal` for all monetary computations.
- **Frontend Representation**: Transport financial values as canonical decimal strings. The client may format those strings with tabular figures (`font-feature-settings: "tnum" 1`) but must request authoritative server quotes rather than calculate financial values with native `Number`.
- **AMM Constant Product Formula**: To buy YES with $d$ USDC, mint $d$ collateral-backed YES/NO pairs, set $R_{\text{NO}}' = R_{\text{NO}} + d$ and $R_{\text{YES}}' = k / R_{\text{NO}}'$, then transfer $\Delta\text{YES} = R_{\text{YES}} + d - R_{\text{YES}}'$ to the user. (For a NO buy, reverse YES/NO.) The virtual-reserve product remains constant to the selected decimal rounding policy, and collateral increases by $d$.

### 2. Database Concurrency & Atomic Balance Ledger

- **Atomic Balance Mutation**: Updating user balances, pool collateral, virtual reserves, positions, and immutable ledger entries must occur inside a single PostgreSQL transaction.
- **Row-Level Locking**: Within every trade, cash-out, and settlement transaction, lock rows in one global order—market, then liquidity pool, then user(s), then position(s)—using `SELECT ... FOR UPDATE`before evaluating balance sufficiency or computing swap mechanics.
- **Immutable Ledger History**: Every balance, collateral, or position mutation must generate append-only `ledger_entries` tied to a transaction identifier. Snapshot balances and pool reserves are never updated without corresponding ledger entries.
- **Idempotency**: All mutation endpoints (`POST /api/v1/markets/:id/orders`, `POST /api/v1/claim`, cash-out, and resolution) require an `Idempotency-Key` and enforce it with a database unique constraint scoped to the actor and operation.

### 3. Backend Tech Stack Constraints

- **Language & Runtime**: Go 1.24+ using **Gin web framework (`github.com/gin-gonic/gin`)**.
- **Database Driver**: `jackc/pgx/v5` with connection pooling and explicit transaction timeouts.
- **WebSockets**: Gorilla WebSocket with dedicated client read/write pumps, heartbeat ping/pong intervals (30s), and non-blocking outbound channels.
- **Abuse Prevention**: In-memory token-bucket rate limiter (`golang.org/x/time/rate`) enforcing per-IP and per-session burst caps.
- **Directory Structure**:
    - `backend/cmd/api/`: Server lifecycle, dependency injection, and graceful shutdown.
    - `backend/internal/amm/`: Pure, stateless AMM mathematical engine with 100% test coverage.
    - `backend/internal/database/`: PostgreSQL connection pool, transaction helpers, and migration scripts.
    - `backend/internal/middleware/`: Rate limiting, authentication, CORS, and structured logging.
    - `backend/internal/transport/`: HTTP handlers and WebSocket connection broker.

### 4. Frontend Tech Stack Constraints

- **Framework**: Angular 22 (Zoneless + Standalone Components).
- **State Management**: Angular Signals (`signal`, `computed`, `effect`) and dedicated Signal Stores. Do NOT introduce heavy NgRx boilerplate or unmanaged RxJS subscriptions.
- **Charting Engine**: Hardware-accelerated `lightweight-charts` rendering 60fps canvas curves without triggering Angular change detection.
- **Styling**: Vanilla CSS using custom property tokens from `target/DESIGN.md`. Do NOT introduce Tailwind CSS or external component libraries without explicit user instruction.
- **Dual Typography**:
    - Interface text: **Scoutie Sans**
    - Quantitative figures: **JetBrains Mono** with tabular numerals (`tnum`).

### 5. Strict WCAG 2.2 Level AAA Compliance

- **Enhanced Contrast (SC 1.4.6)**: All text elements strictly enforce $\ge 7.0:1$ contrast against dark surfaces ($\ge 4.5:1$ for large text $\ge 24\text{px}$). Low-contrast grays ($< 7:1$) are prohibited.
- **Non-Text Contrast (SC 1.4.11)**: Interactive borders and toggle boundaries use `#606e85` ($\ge 3.5:1$).
- **Target Size (SC 2.5.5)**: Every button, chip, tab, and input enforces `min-height: 44px; min-width: 44px;` with $\ge 8\text{px}$ touch envelope clearance.
- **Focus Appearance & Visibility (SC 2.4.12 & SC 2.4.13)**: 2px solid outline in `#e84089` (5.24:1 contrast); viewport scroll padding (`scroll-padding-top: 76px; scroll-padding-bottom: 96px`) ensures focused controls are never obscured.
- **Two-Step Financial Confirmation (SC 3.3.6)**: All trade executions must display the `order-confirm-dialog` summarizing question, outcome, shares, price, max slippage, and post-trade balance before commitment.
- **Accessible Authentication (SC 3.3.9)**: Zero cognitive function tests or CAPTCHAs via 1-click ephemeral Guest Session provisioning.

---

## 4. Anti-Shortcut Protocol & Strict Definition of Done (DoD)

To prevent shallow, broken, or hallucinated implementations, the AI Agent MUST strictly adhere to the following execution policy:

### Prohibited Anti-Patterns:

1. **No Float Arithmetic in Financial Paths**: Never use `float32`/`float64` or native JS arithmetic for price, share, or balance calculations.
2. **No Mock/Placeholder Shortcutting**: Never leave empty directories, never insert dummy inline mock data where backend services are defined, and never commit `// TODO: implement later` stubs.
3. **No Non-Atomic Updates**: Never mutate memory state without committing to Postgres, and never modify user balances outside of row-locked transactions.
4. **No Sub-44px Clickable Hitboxes**: Never render interactive controls smaller than 44×44 CSS pixels.
5. **No Single-Click Financial Commitments**: Never bypass the pre-trade confirmation review dialog.
6. **No Checkbox Fiction**: Never flip `[ ]` to `[x]` in `target/TODOs.md` until code exists on disk, builds compile, and automated verification tests pass cleanly.

### Mandatory 4-Step Verification Gate Before Marking Tasks Done:

1. **Verify Complete File Generation on Disk**: Ensure all generated files are written to their exact expected workspace paths.
2. **Verify Mathematical Precision & Unit Tests**: Run Go backend tests with race detection (`go test -v -race ./...`) and verify all AMM invariants.
3. **Verify Frontend Build & Accessibility**: Confirm frontend builds cleanly (`pnpm build` or `ng build`) with zero lint errors and verified WCAG AAA contrast ratios.
4. **Provide Verifiable Proof in Walkthrough**: Document exact test outputs, executed commands, and visual proofs in `walkthrough.md`.

---

## 5. Quick Domain Vocabulary

- **Binary Prediction Market**: A forward contract market resolving to either `YES` ($1.00) or `NO` ($0.00) based on an objective, verifiable event outcome.
- **CPMM (Constant Product Market Maker)**: Algorithmic pricing mechanism preserving the bonding invariant $k = R_{\text{YES}} \times R_{\text{NO}}$ to guarantee continuous, automated liquidity.
- **Implied Probability**: The market-clearing consensus probability derived from pool reserve ratios ($P_{\text{YES}} = \frac{R_{\text{NO}}}{R_{\text{YES}} + R_{\text{NO}}}$).
- **Slippage**: The divergence between the initial spot price and the effective average execution price resulting from order size relative to liquidity pool depth.
- **USDC**: The fixed-precision stable settlement currency used across all balances, order deposits, liquidity provisions, and final share redemptions.
- **Outcome Shares**: Binary contract tokens redeemable for exactly $1.00 USDC if the outcome resolves true, or $0.00 if the outcome resolves false.
- **Oracle**: The authoritative external verification source and timestamp designated in market resolution criteria to decide final settlement.
- **Ephemeral Guest Session**: 1-click sandbox JWT session pre-loaded with 1,000 virtual testnet USDC for risk-free platform evaluation.
- **Cash Out / Liquidation**: The atomic sale of accumulated outcome shares back into the AMM liquidity pool at current spot price minus slippage prior to market resolution.
- **Dual-Coding**: Accessibility pattern pairing distinct color values with explicit geometric symbols (`▲ YES` / `▼ NO`) to ensure full comprehension for colorblind traders.
