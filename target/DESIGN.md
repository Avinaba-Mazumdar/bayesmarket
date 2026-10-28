---
version: 1.2.0
name: bayesmarket-design-system
description: Institutional-grade, high-precision binary prediction market exchange interface. Light-first palette: indigo primary (#4338ca), deep teal accent (#075985), and dual-coded binary outcomes (YES deep green #065f46, NO deep rose #9f1239). The dark theme uses the same hues in darker shades. Scoutie Sans paired with JetBrains Mono. WCAG 2.2 Level AAA is the implementation and verification target across applicable success criteria.

colors:
    canvas: '#f8f9fc'
    canvas-subtle: '#f1f5f9'
    surface-card: '#ffffff'
    surface-card-elevated: '#ffffff'
    surface-terminal: '#f8fafc'
    surface-glass: 'rgba(255, 255, 255, 0.92)'
    surface-glass-border: 'rgba(15, 23, 42, 0.12)'
    dock-bg: 'rgba(255, 255, 255, 0.94)'
    primary: '#4338ca'
    primary-text: '#4338ca'
    primary-active: '#312e81'
    primary-hover: '#3730a3'
    primary-subtle: 'rgba(67, 56, 202, 0.08)'
    primary-border: '#4338ca'
    primary-glow: 'rgba(67, 56, 202, 0.25)'
    accent: '#075985'
    accent-active: '#0c4a6e'
    accent-subtle: 'rgba(7, 89, 133, 0.1)'
    outcome-yes: '#065f46'
    outcome-yes-text: '#065f46'
    outcome-yes-active: '#044e39'
    outcome-yes-subtle: 'rgba(6, 95, 70, 0.09)'
    outcome-yes-border: 'rgba(6, 95, 70, 0.35)'
    outcome-yes-glow: 'rgba(6, 95, 70, 0.2)'
    outcome-yes-solid: '#065f46'
    outcome-yes-solid-hover: '#044e39'
    outcome-yes-solid-text: '#ffffff'
    outcome-no: '#9f1239'
    outcome-no-text: '#9f1239'
    outcome-no-active: '#881337'
    outcome-no-subtle: 'rgba(159, 18, 57, 0.09)'
    outcome-no-border: 'rgba(159, 18, 57, 0.35)'
    outcome-no-glow: 'rgba(159, 18, 57, 0.2)'
    outcome-no-solid: '#9f1239'
    outcome-no-solid-hover: '#881337'
    outcome-no-solid-text: '#ffffff'
    ink: '#0f172a'
    ink-secondary: '#1e293b'
    body: '#334155'
    muted: '#3b4861'
    hairline: '#cbd5e1'
    border-strong: '#64748b'
    on-primary: '#ffffff'
    on-outcome: '#ffffff'
    on-dark: '#0f172a'
    status-profit: '#065f46'
    status-profit-bg: '#ecfdf5'
    status-profit-border: '#059669'
    status-loss: '#9f1239'
    status-loss-bg: '#fff1f2'
    status-loss-border: '#e11d48'
    status-warning: '#78350f'
    status-warning-bg: '#fef3c7'
    status-warning-border: '#b45309'
    status-info: '#075985'
    status-info-bg: '#f0f9ff'
    status-info-border: '#0284c7'
    status-resolved: '#581c87'
    status-resolved-bg: '#f5f3ff'
    status-resolved-border: '#7c3aed'
    link: '#3730a3'
    link-active: '#1e1b4b'
    focus-outline: '#3730a3'
    focus-ring: 'rgba(55, 48, 163, 0.35)'
    dialog-overlay: 'rgba(15, 23, 42, 0.55)'
shadows:
    sm: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.05)'
    md: '0 4px 6px -1px rgba(15, 23, 42, 0.09), 0 2px 4px -2px rgba(15, 23, 42, 0.05)'
    lg: '0 10px 15px -3px rgba(15, 23, 42, 0.09), 0 4px 6px -4px rgba(15, 23, 42, 0.05)'
    terminal: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)'
    glow-primary: '0 0 20px rgba(67, 56, 202, 0.18)'
    glow-yes: '0 0 16px rgba(6, 95, 70, 0.18)'
    glow-no: '0 0 16px rgba(159, 18, 57, 0.18)'

typography:
    display-xl:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 32px
        fontWeight: 700
        lineHeight: 1.2
        letterSpacing: -0.5px
    display-lg:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 26px
        fontWeight: 700
        lineHeight: 1.25
        letterSpacing: -0.3px
    display-md:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 22px
        fontWeight: 600
        lineHeight: 1.3
        letterSpacing: -0.2px
    title-lg:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 19px
        fontWeight: 600
        lineHeight: 1.35
        letterSpacing: 0
    title-md:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 17px
        fontWeight: 600
        lineHeight: 1.4
        letterSpacing: 0
    title-sm:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 15px
        fontWeight: 600
        lineHeight: 1.45
        letterSpacing: 0
    body-lg:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 16px
        fontWeight: 400
        lineHeight: 1.55
        letterSpacing: 0
    body-md:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 14px
        fontWeight: 400
        lineHeight: 1.55
        letterSpacing: 0
    body-sm:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 13px
        fontWeight: 400
        lineHeight: 1.5
        letterSpacing: 0
    label-md:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 14px
        fontWeight: 600
        lineHeight: 1.35
        letterSpacing: 0.1px
    label-sm:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 12px
        fontWeight: 600
        lineHeight: 1.3
        letterSpacing: 0.2px
    button:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 15px
        fontWeight: 600
        lineHeight: 1.3
        letterSpacing: 0.1px
    button-sm:
        fontFamily: 'Scoutie Sans, system-ui, -apple-system, sans-serif'
        fontSize: 13px
        fontWeight: 600
        lineHeight: 1.3
        letterSpacing: 0.1px
    probability-hero:
        fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace'
        fontSize: 36px
        fontWeight: 700
        lineHeight: 1.1
        letterSpacing: -1px
    kpi-metric:
        fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace'
        fontSize: 24px
        fontWeight: 700
        lineHeight: 1.2
        letterSpacing: -0.5px
    mono-md:
        fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace'
        fontSize: 15px
        fontWeight: 600
        lineHeight: 1.35
        letterSpacing: 0
    mono-sm:
        fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace'
        fontSize: 13px
        fontWeight: 500
        lineHeight: 1.4
        letterSpacing: 0
    mono-xs:
        fontFamily: 'JetBrains Mono, SFMono-Regular, Menlo, monospace'
        fontSize: 11px
        fontWeight: 500
        lineHeight: 1.3
        letterSpacing: 0.2px

rounded:
    xs: 4px
    sm: 6px
    md: 10px
    lg: 14px
    xl: 20px
    pill: 9999px
    full: 9999px

spacing:
    xxs: 4px
    xs: 8px
    sm: 12px
    md: 16px
    lg: 20px
    xl: 24px
    xxl: 32px
    section: 48px

components:
    button-primary:
        backgroundColor: '{colors.primary}'
        textColor: '{colors.on-primary}'
        typography: '{typography.button}'
        rounded: '{rounded.lg}'
        padding: 14px 20px
        minHeight: 48px
        minWidth: 44px
    button-primary-hover:
        backgroundColor: '{colors.primary-hover}'
        textColor: '{colors.on-primary}'
        rounded: '{rounded.lg}'
    button-primary-active:
        backgroundColor: '{colors.primary-active}'
        textColor: '{colors.on-primary}'
        rounded: '{rounded.lg}'
    button-yes:
        backgroundColor: '{colors.outcome-yes-subtle}'
        textColor: '{colors.outcome-yes-text}'
        typography: '{typography.button}'
        rounded: '{rounded.md}'
        padding: 12px 18px
        minHeight: 44px
        minWidth: 44px
    button-yes-active:
        backgroundColor: '{colors.outcome-yes-active}'
        textColor: '{colors.on-outcome}'
        rounded: '{rounded.md}'
    button-no:
        backgroundColor: '{colors.outcome-no-subtle}'
        textColor: '{colors.outcome-no-text}'
        typography: '{typography.button}'
        rounded: '{rounded.md}'
        padding: 12px 18px
        minHeight: 44px
        minWidth: 44px
    button-no-active:
        backgroundColor: '{colors.outcome-no-active}'
        textColor: '{colors.on-outcome}'
        rounded: '{rounded.md}'
    button-secondary:
        backgroundColor: '{colors.surface-card}'
        textColor: '{colors.ink}'
        typography: '{typography.button}'
        rounded: '{rounded.lg}'
        padding: 14px 20px
        minHeight: 44px
        minWidth: 44px
    button-claim:
        backgroundColor: '{colors.primary-subtle}'
        textColor: '#4338ca'
        borderColor: '{colors.primary-border}'
        typography: '{typography.button-sm}'
        rounded: '{rounded.pill}'
        padding: 10px 18px
        minHeight: 44px
        minWidth: 44px
    button-icon-touch:
        backgroundColor: '{colors.surface-card}'
        textColor: '{colors.ink}'
        rounded: '{rounded.md}'
        size: 44px
        minHeight: 44px
        minWidth: 44px
    quick-amount-chip:
        backgroundColor: '{colors.canvas-subtle}'
        textColor: '{colors.ink}'
        borderColor: '{colors.border-strong}'
        typography: '{typography.mono-sm}'
        rounded: '{rounded.md}'
        padding: 10px 16px
        minHeight: 44px
        minWidth: 52px
    chart-interval-chip:
        backgroundColor: '{colors.canvas-subtle}'
        textColor: '{colors.ink-secondary}'
        borderColor: '{colors.border-strong}'
        typography: '{typography.mono-xs}'
        rounded: '{rounded.sm}'
        padding: 8px 14px
        minHeight: 44px
        minWidth: 44px
    top-header-dock:
        backgroundColor: '{colors.surface-glass}'
        textColor: '{colors.ink}'
        typography: '{typography.title-sm}'
        height: 64px
    order-terminal-panel:
        backgroundColor: '{colors.surface-terminal}'
        textColor: '{colors.ink}'
        borderColor: '{colors.border-strong}'
        rounded: '{rounded.xl}'
        padding: 20px
    probability-pill-yes:
        backgroundColor: '{colors.outcome-yes-subtle}'
        textColor: '{colors.outcome-yes-text}'
        borderColor: '{colors.outcome-yes-border}'
        typography: '{typography.mono-md}'
        rounded: '{rounded.pill}'
        padding: 8px 14px
        minHeight: 44px
        minWidth: 44px
    probability-pill-no:
        backgroundColor: '{colors.outcome-no-subtle}'
        textColor: '{colors.outcome-no-text}'
        borderColor: '{colors.outcome-no-border}'
        typography: '{typography.mono-md}'
        rounded: '{rounded.pill}'
        padding: 8px 14px
        minHeight: 44px
        minWidth: 44px
    market-card:
        backgroundColor: '{colors.surface-card}'
        textColor: '{colors.ink}'
        borderColor: '{colors.hairline}'
        typography: '{typography.title-sm}'
        rounded: '{rounded.lg}'
        padding: 18px
    market-card-hover:
        backgroundColor: '{colors.surface-card-elevated}'
        textColor: '{colors.ink}'
        borderColor: '{colors.border-strong}'
        rounded: '{rounded.lg}'
    price-chart-container:
        backgroundColor: '{colors.surface-terminal}'
        borderColor: '{colors.border-strong}'
        rounded: '{rounded.xl}'
        padding: 16px
        minHeight: 360px
    live-trade-item:
        backgroundColor: '{colors.surface-card}'
        textColor: '{colors.ink}'
        typography: '{typography.mono-sm}'
        rounded: '{rounded.sm}'
        padding: 10px 14px
        minHeight: 44px
    position-row:
        backgroundColor: '{colors.surface-card}'
        textColor: '{colors.ink}'
        typography: '{typography.mono-sm}'
        rounded: '{rounded.md}'
        padding: 14px 16px
        minHeight: 52px
    slippage-callout:
        backgroundColor: '{colors.status-warning-bg}'
        textColor: '{colors.status-warning}'
        borderColor: '{colors.status-warning-border}'
        typography: '{typography.body-sm}'
        rounded: '{rounded.md}'
        padding: 12px 16px
    text-input:
        backgroundColor: '{colors.canvas-subtle}'
        textColor: '{colors.ink}'
        borderColor: '{colors.border-strong}'
        typography: '{typography.mono-md}'
        rounded: '{rounded.md}'
        padding: 12px 16px
        height: 48px
        minHeight: 48px
    text-input-focus:
        backgroundColor: '{colors.canvas-subtle}'
        textColor: '{colors.ink}'
        borderColor: '{colors.primary-border}'
        rounded: '{rounded.md}'
    order-confirm-dialog:
        backgroundColor: '{colors.surface-card-elevated}'
        textColor: '{colors.ink}'
        borderColor: '{colors.primary-border}'
        rounded: '{rounded.xl}'
        padding: 24px
        minWidth: 320px
    glossary-popover:
        backgroundColor: '{colors.surface-card-elevated}'
        textColor: '{colors.ink}'
        borderColor: '{colors.border-strong}'
        rounded: '{rounded.md}'
        padding: 12px 16px
        minWidth: 260px
---

> **Superseded palette.** Earlier revisions of this file specified an obsidian (`#07090e`) and Deep Amaranth (`#a6034c`) palette. That palette is no longer used. The `colors` and `shadows` values in this frontmatter are the light-theme values from `frontend/src/styles/tokens.css`. Any later sentence that quotes `#07090e`, `#a6034c`, `#e84089`, `#10b981` as the default YES color, or `#fb7185` as the default NO color is historical. Implement `tokens.css`. The dark theme is opt-in via `data-theme="dark"` and is defined only in that file.

# BayesMarket Design System & Interface Specification

## 1. Overview & Architectural Ethos

**BayesMarket** is an institutional-grade, high-concurrency binary prediction exchange where market participants trade continuous outcome shares (**YES** and **NO**) on verifiable future events.

Unlike retail betting platforms or casual mobile apps, BayesMarket operates as an **algorithmic financial trading terminal**. The UI facilitates instant price discovery, real-time probability curve interpretation, slippage calculation, and atomic trade execution in **under 250 milliseconds**.

### 1.1 Foundational Brand Architecture

The visual architecture is anchored by the light theme in `frontend/src/styles/tokens.css`:

1. **Canvas (`{colors.canvas}` — `#f8f9fc`)**: A light trading floor. Cards are `#ffffff`. Text uses slate ink `#0f172a` (the token file states 18.75:1 on white).
2. **Primary (`{colors.primary}` — `#4338ca`)**: Indigo for execution CTAs and brand marks. The token file states white on `#4338ca` is 8.33:1.
3. **Dual-Coded Binary Outcome Spectrum**:
    - **YES (`{colors.outcome-yes}` — `#065f46`)**: Deep green. The token file states white on this solid is 7.78:1.
    - **NO (`{colors.outcome-no}` — `#9f1239`)**: Deep rose. The token file states white on this solid is 8.08:1.

Focus uses `#3730a3` (`--focus-outline`), not the retired `#e84089` ring. Interactive borders use `#64748b` (`--border-strong`). 4. **Dual Typography Pairing**: - **Display & Interface Typography**: Set in **Scoutie Sans**, a contemporary geometric sans-serif delivering athletic posture, open counters, and instant legibility across market titles, order tabs, and navigation headers. - **Quantitative Monospace Sub-System**: Set in **JetBrains Mono** across all price feeds, probabilities, pool reserves, USDC denominations, order slips, and slippage calculations to eliminate layout jitter and guarantee vertical tabular scanning.

### 1.2 WCAG 2.2 Level AAA Acceptance Requirements

BayesMarket is designed to satisfy the highest international benchmark for digital accessibility: **WCAG 2.2 Level AAA**. The following are implementation acceptance criteria; certification requires automated checks and manual assistive-technology testing after the application exists:

- **Perceivable**:
    - **SC 1.3.6 (Identify Purpose - AAA)**: Programmatic landmark identification (`role="banner"`, `role="main"`, `role="region"`, `role="navigation"`) and form input autocomplete attributes.
    - **SC 1.4.6 (Contrast Enhanced - AAA)**: Minimum **7.0:1** contrast for normal text; minimum **4.5:1** for large text across every surface elevation.
    - **SC 1.4.8 (Visual Presentation - AAA)**: Line lengths strictly capped at $\le 68\text{ch}$ ($\le 80$ characters), line-height $\ge 1.55$, paragraph bottom margin $\ge 2.25\text{em}$, no justified text, full 200% zoom reflow without horizontal scrolling, and support for OS forced-colors high-contrast mode.
    - **SC 1.4.9 (Images of Text - No Exception - AAA)**: Zero rasterized images of text; all figures, odds, and metrics use native DOM or SVG vector typography.
    - **SC 1.4.11 (Non-text Contrast - Level AA/AAA Baseline)**: Minimum **3.0:1** contrast for all interactive borders (`#64748b` — 4.52:1 on canvas, 4.76:1 on card), toggle switches, and graphical boundaries.
- **Operable**:
    - **SC 2.1.3 (Keyboard - No Exception - AAA)**: 100% of functionality is keyboard operable without pointer dependency or specific keystroke timings.
    - **SC 2.2.3 & 2.2.6 (No Timing & Timeouts - AAA)**: No arbitrary timeout countdowns on order drafting; user session state is preserved across $> 20$ hours.
    - **SC 2.2.4 (Interruptions - AAA)**: Accessible user controls to postpone, mute, or throttle streaming WebSocket trade tickers and screen reader announcements.
    - **SC 2.2.5 (Re-authenticating - AAA)**: Automatic restoration of drafted order slips and portfolio parameters upon session renewal without data loss.
    - **SC 2.3.2 & 2.3.3 (Three Flashes & Animation from Interactions - AAA)**: 0 flashes $> 3\text{Hz}$; full `prefers-reduced-motion` suppression of micro-animations and glowing pulses.
    - **SC 2.4.8 (Location - AAA)**: Explicit hierarchical breadcrumbs, `aria-current="page"` navigation indicators, and dynamic market-titled document headers.
    - **SC 2.4.9 (Link Purpose - Link Only - AAA)**: All link text explicitly conveys destination and intent from the anchor string alone.
    - **SC 2.4.10 (Section Headings - AAA)**: Strict semantic `h1` through `h4` hierarchy without skipped levels.
    - **SC 2.4.12 (Focus Not Obscured - Enhanced - AAA)**: Zero percent obscuration via viewport scroll offsets (`scroll-padding-top: 76px; scroll-padding-bottom: 96px`) and modal inert traps.
    - **SC 2.4.13 (Focus Appearance - AAA)**: 2px solid perimeter outline in `#3730a3` (9.44:1 contrast on the canvas) with 2px offset and secondary outer ring, enclosing the entire interactive perimeter.
    - **SC 2.5.5 (Target Size - Enhanced - AAA)**: Universal minimum **44×44 CSS pixels** for every button, chip, tab, and input, separated by at least **8px** of touch envelope clearance.
    - **SC 2.5.6 (Concurrent Input Mechanisms - AAA)**: Seamless interchange between touch, mouse, keyboard, and stylus.
- **Understandable**:
    - **SC 3.1.3 & 3.1.4 (Unusual Words & Abbreviations - AAA)**: Integrated popover definitions for domain jargon ("AMM", "CPMM", "Slippage", "Oracle") and semantic `<abbr>` tags.
    - **SC 3.1.5 (Reading Level - AAA)**: Plain-language summaries for complex market resolution rules at lower secondary reading level (Grade 7-8).
    - **SC 3.1.6 (Pronunciation - AAA)**: Pronunciation cues for domain terminology ("Bayes", "USDC").
    - **SC 3.2.5 (Change on Request - AAA)**: Context changes occur strictly on explicit user action.
    - **SC 3.3.5 (Help - AAA)**: Inline context-sensitive help icons with popovers adjacent to slippage tolerance and liquidity depth.
    - **SC 3.3.6 (Error Prevention - All - AAA)**: Mandatory two-step Order Confirmation Review dialog before financial trade commitment: Check, Confirm, Reversible prior to settlement.
    - **SC 3.3.9 (Accessible Authentication - Enhanced - AAA)**: Zero cognitive function tests or CAPTCHAs via 1-click ephemeral Guest Session provisioning.
- **Robust**:
    - **SC 4.1.3 (Status Messages - Baseline)**: Polite and assertive ARIA live regions for price updates and order confirmations.

---

## 2. Color System & Contrast Engineering

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          COLOR PALETTE SPECTRUM                             │
├───────────────────┬───────────────────┬──────────────────┬──────────────────┤
│ BRAND SIGNATURE   │ OUTCOME YES       │ OUTCOME NO       │ LIGHT CANVAS     │
│ Indigo            │ Deep Green        │ Deep Rose        │ Trading Floor    │
│ #4338ca           │ #065f46           │ #9f1239          │ #f8f9fc          │
└───────────────────┴───────────────────┴──────────────────┴──────────────────┘
```

### 2.1 Brand & Interactive Tones

- **Primary Brand** (`{colors.primary}` — `#4338ca`): Indigo. The foundational brand color. Used for primary commit CTAs (`"Execute Trade"`, `"Confirm Swap"`), active navigation indicators, and primary highlight badges. `#ffffff` text on `#4338ca` achieves **7.90:1** contrast (**Exceeds 7.0:1 AAA**).
- **Primary Active** (`{colors.primary-active}` — `#312e81`): Pressed state for primary buttons with tactile mechanical scale depression. `#ffffff` on `#312e81` achieves **11.42:1** contrast (**Exceeds 7.0:1 AAA**).
- **Primary Hover** (`{colors.primary-hover}` — `#3730a3`): Calibrated hover shade. `#ffffff` on `#3730a3` achieves **9.93:1** contrast (**Exceeds 7.0:1 AAA**).
- **Primary Subtle** (`{colors.primary-subtle}` — `rgba(67, 56, 202, 0.08)`): Tonal background for active tabs, selected token pills, and guest claim controls. `{colors.primary}` text on this tint (about `#f0effb` on white) achieves **6.94:1** (**Passes AA; below AAA 7.0:1**).
- **Primary Border / Focus Ring** (`{colors.primary-border}` / `{colors.focus-outline}` — `#4338ca` / `#3730a3`): High-definition perimeter outline for active cards and focused order inputs. `#4338ca` is **7.51:1** against canvas `#f8f9fc` and **7.90:1** against card `#ffffff`. The focus outline `#3730a3` is **9.44:1** on canvas (**Exceeds 3.0:1 Focus/Non-Text AAA**).
- **Primary Glow** (`{colors.primary-glow}` — `rgba(67, 56, 202, 0.25)`): Ambient radial bloom surrounding execution triggers.

### 2.2 Binary Outcome Color Semantics (Dual-Coded AAA)

In a Constant Product Market Maker ($P_{\text{YES}} + P_{\text{NO}} = 1.00$), binary outcomes are dual-coded with geometric glyphs (`▲ YES` vs `▼ NO`) and calibrated light tints:

- **YES Outcome** (`{colors.outcome-yes}` — `#065f46` / Text: `{colors.outcome-yes-text}` — `#065f46`):
    - Text Color: `#065f46`. Contrast against `{colors.canvas}` is **7.30:1** (**Exceeds 7.0:1 AAA**). Contrast against card `{colors.surface-card}` is **7.68:1** (**Exceeds 7.0:1 AAA**).
    - Background Capsule: `{colors.outcome-yes-subtle}` (`rgba(6, 95, 70, 0.09)`, about `#e9f1ee` on white). `#065f46` text on this capsule is **6.69:1** (**Passes AA 4.5:1; below AAA 7.0:1**).
    - Active Solid Button State: `#ffffff` text on `#065f46` solid base achieves **7.68:1** (**Exceeds 7.0:1 AAA**).
    - Border: `{colors.outcome-yes-border}` (`rgba(6, 95, 70, 0.35)`).
- **NO Outcome** (`{colors.outcome-no}` — `#9f1239` / Text: `{colors.outcome-no-text}` — `#9f1239`):
    - Text Color: `#9f1239`. Contrast against `{colors.canvas}` is **7.61:1** (**Exceeds 7.0:1 AAA**). Contrast against card `{colors.surface-card}` is **8.02:1** (**Exceeds 7.0:1 AAA**).
    - Background Capsule: `{colors.outcome-no-subtle}` (`rgba(159, 18, 57, 0.09)`, about `#f6eaed` on white). `#9f1239` text on this capsule is **6.84:1** (**Passes AA 4.5:1; below AAA 7.0:1**).
    - Active Solid Button State: `#ffffff` text on `#9f1239` solid base achieves **8.02:1** (**Exceeds 7.0:1 AAA**).
    - Border: `{colors.outcome-no-border}` (`rgba(159, 18, 57, 0.35)`).

### 2.3 Trading Floor Surfaces & Depth Hierarchy

- **Canvas Floor** (`{colors.canvas}` — `#f8f9fc`): Light trading floor ($L \approx 0.947$). Hosts the entire SPA layout.
- **Canvas Subtle** (`{colors.canvas-subtle}` — `#f1f5f9`): Slate tint for input fields, inactive tabs, and table header rows.
- **Surface Card** (`{colors.surface-card}` — `#ffffff`): Modular cards for market listings, open positions, and telemetry widgets, with a 1px `{colors.hairline}` (`#cbd5e1`) border.
- **Surface Card Elevated** (`{colors.surface-card-elevated}` — `#ffffff`): Hover state for market cards, modal dialogs, and dropdown menus, separated from the page by shadow.
- **Surface Terminal** (`{colors.surface-terminal}` — `#f8fafc`): Dedicated cockpit surface hosting the TradingView canvas and execution order book.
- **Surface Glass** (`{colors.surface-glass}` — `rgba(255, 255, 255, 0.92)`): Translucent header and mobile dock with `backdrop-filter: blur(16px)`.

### 2.4 Text, Ink & Non-Text Hierarchy (AAA Verified Across All Elevations)

- **Ink Primary** (`{colors.ink}` — `#f8fafc`): Crisp Slate-50 white text for market titles, active prices, and execution amounts. Delivers a **19.03:1** contrast ratio against canvas and **17.28:1** against card surfaces (**Strictly Exceeds 7.0:1 AAA**).
- **Ink Secondary** (`{colors.ink-secondary}` — `#cbd5e1`): Slate-300 for category labels, resolution dates, table headers, and pool volume metrics (**13.41:1** on canvas, **12.18:1** on card — **Strictly Exceeds 7.0:1 AAA**).
- **Body / Muted Copy** (`{colors.body}` / `{colors.muted}` — `#a2b4c9`): Specially calibrated Slate-350 for market resolution criteria and helper notes. Delivers **9.40:1** on canvas, **8.53:1** on card, and **7.77:1** on elevated cards/modals (`#171f30`) (**Strictly Exceeds 7.0:1 AAA everywhere**; generic `#94a3b8` dropped below 7:1 on elevated cards).
- **Border Strong** (`{colors.border-strong}` — `#64748b`): High-definition perimeter boundary for inputs, chips, and segmented toggle switches. Achieves **4.52:1** against canvas and **4.76:1** against card (**Exceeds 3.0:1 SC 1.4.11 Non-text Contrast**).
- **Hairline** (`{colors.hairline}` — `#1e2638`): Structural visual dividers between table rows.

---

## 3. Typography & Quantitative Formatting

### 3.1 Dual-Type Architecture

```
Interface Font:   "Scoutie Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
Quantitative Font: "JetBrains Mono", "SFMono-Regular", Menlo, Monaco, Consolas, monospace
```

1. **Scoutie Sans (Interface & Narrative)**: Applied across market questions, navigation items, category selectors, button labels, and resolution criteria. Enforces line-height $\ge 1.55$ on running copy to satisfy WCAG 2.2 SC 1.4.8.
2. **JetBrains Mono (Quantitative Financial Numbers)**: Applied across share counts, probabilities (`72.4%`), dollar balances (`$1,000.00 USDC`), slippage percentages (`1.25%`), pool reserves, and countdown timers. Enforces fixed tabular width (`font-feature-settings: "tnum" 1`) to eliminate character jitter during live price feeds.
3. **Images of Text Prohibition (SC 1.4.9 Level AAA)**: All odds, statistics, badges, and slogans are strictly rendered as DOM text or vector SVG text elements with selectable strings. Zero rasterized PNG/JPEG graphics containing textual content are permitted.

### 3.2 Typographic Scale (WCAG 2.2 AAA Compliant)

| Token                           | Font Family    | Size | Weight | Line Height | Tracking | Application Context                                            |
| :------------------------------ | :------------- | :--- | :----- | :---------- | :------- | :------------------------------------------------------------- |
| `{typography.display-xl}`       | Scoutie Sans   | 32px | 700    | 1.2         | -0.5px   | Market detail hero headline, Major resolution banner           |
| `{typography.display-lg}`       | Scoutie Sans   | 26px | 700    | 1.25        | -0.3px   | Catalog category headers, Portfolio balance hero               |
| `{typography.display-md}`       | Scoutie Sans   | 22px | 600    | 1.3         | -0.2px   | Section titles, Order terminal mode toggle                     |
| `{typography.title-lg}`         | Scoutie Sans   | 19px | 600    | 1.35        | 0        | Market card question title, Modal dialog headlines             |
| `{typography.title-md}`         | Scoutie Sans   | 17px | 600    | 1.4         | 0        | Order slip outcome selector, Resolution source title           |
| `{typography.title-sm}`         | Scoutie Sans   | 15px | 600    | 1.45        | 0        | Table column heads, Navigation tabs, Category pills            |
| `{typography.body-lg}`          | Scoutie Sans   | 16px | 400    | 1.55        | 0        | Market resolution rules prose (WCAG 1.4.8 $\ge 1.5$)           |
| `{typography.body-md}`          | Scoutie Sans   | 14px | 400    | 1.55        | 0        | Standard helper notes, Tooltip captions (WCAG 1.4.8 $\ge 1.5$) |
| `{typography.body-sm}`          | Scoutie Sans   | 13px | 400    | 1.5         | 0        | Timestamp tags, Pool fee disclosures, Footers                  |
| `{typography.label-md}`         | Scoutie Sans   | 14px | 600    | 1.35        | 0.1px    | Form field labels, Slider endpoints                            |
| `{typography.label-sm}`         | Scoutie Sans   | 12px | 600    | 1.3         | 0.2px    | Status tags (`ACTIVE`, `RESOLVED`), Category badges            |
| `{typography.button}`           | Scoutie Sans   | 15px | 600    | 1.3         | 0.1px    | Primary action triggers (`Buy YES`, `Execute Trade`)           |
| `{typography.button-sm}`        | Scoutie Sans   | 13px | 600    | 1.3         | 0.1px    | Claim, Quick share amount pills (`+$50`, `Max`)                |
| `{typography.probability-hero}` | JetBrains Mono | 36px | 700    | 1.1         | -1.0px   | Main market implied probability (`72% YES`)                    |
| `{typography.kpi-metric}`       | JetBrains Mono | 24px | 700    | 1.2         | -0.5px   | User cash balance, 24h Volume counters (`$142,500 USDC`)       |
| `{typography.mono-md}`          | JetBrains Mono | 15px | 600    | 1.35        | 0        | Order input value, Expected shares filled, Avg price           |
| `{typography.mono-sm}`          | JetBrains Mono | 13px | 500    | 1.4         | 0        | Live trade stream rows, Slippage percentage, Pool reserves     |
| `{typography.mono-xs}`          | JetBrains Mono | 11px | 500    | 1.3         | 0.2px    | Chart axis labels, Tx hashes, Timestamp watermarks             |

---

## 4. Spacing, Layout Grid & SC 1.4.8 Visual Rules

### 4.1 The 8-Point Modular Grid

All spatial margins, padding envelopes, and component dimensions derive from an 8-point core scale:

- `{spacing.xxs}`: `4px` (Tag internal padding, icon-to-metric gap)
- `{spacing.xs}`: `8px` (Minimum spacing between adjacent 44px touch targets)
- `{spacing.sm}`: `12px` (Card interior padding on mobile, input field vertical inset)
- `{spacing.md}`: `16px` (Default panel margin, gap between market cards)
- `{spacing.lg}`: `20px` (Order terminal content padding, navigation bar horizontal inset)
- `{spacing.xl}`: `24px` (Modal interior padding, chart container margins)
- `{spacing.xxl}`: `32px` (Major trading cockpit column separation)
- `{spacing.section}`: `48px` (Landing page section vertical separation)

### 4.2 Ergonomic Density & SC 1.4.8 Visual Presentation Rules (Level AAA)

1. **Paragraph Line Length**: Reading blocks (such as Market Resolution Criteria) enforce `max-width: 68ch` (under the 80-character maximum mandate of WCAG 2.2 SC 1.4.8).
2. **Left-Alignment Only**: Text justification is strictly prohibited (`text-align: left; text-justify: none`).
3. **Paragraph Spacing**: Margin-bottom between paragraphs is set to `2.25em` (at least 1.5× the line spacing of 1.5).
4. **Fluid Zoom (200%)**: CSS layout uses fluid grid/flex wrapping with relative units (`rem`/`em`). At 200% browser zoom, the 3-column desktop layout automatically collapses into a vertical single-column cockpit with zero horizontal scrollbars or clipped text.
5. **High-Contrast Forced Colors**: The entire UI incorporates `@media (forced-colors: active)` support to inherit system high-contrast theme outlines.

---

## 5. Elevation, Depth & Glassmorphism

```
Level 0: Canvas Floor          Level 1: Cards & Panels        Level 2: Modals & Terminals
[ #f8f9fc Canvas ]   ───►   [ #ffffff with Hairline ]  ───►  [ Frosted Glass + Radial Glow ]
```

| Level                    | Background                       | Border                              | Shadow Treatment                          | Application Context                                   |
| :----------------------- | :------------------------------- | :---------------------------------- | :---------------------------------------- | :---------------------------------------------------- |
| **0: Canvas Floor**      | `{colors.canvas}`                | None                                | None                                      | Application background floor                          |
| **1: Card Rest**         | `{colors.surface-card}`          | 1px `{colors.hairline}`             | `{shadows.sm}`                            | Market catalog cards, Position table                  |
| **2: Card Hover**        | `{colors.surface-card-elevated}` | 1px `{colors.border-strong}`        | `{shadows.md}`                            | Clickable market cards, Category pills                |
| **3: Terminal Cockpit**  | `{colors.surface-terminal}`      | 1px `{colors.border-strong}`        | `{shadows.terminal}`                      | Order execution terminal, TradingView chart container |
| **4: Sticky Glass Dock** | `{colors.surface-glass}`         | 1px `{colors.surface-glass-border}` | `backdrop-filter: blur(16px)`             | Sticky top navigation dock, Mobile order slip         |
| **5: Floating Dialog**   | `{colors.surface-card-elevated}` | 1px `{colors.primary-border}`       | `{shadows.lg}` + `{shadows.glow-primary}` | Cash Out modal, Market resolution trigger             |

---

## 6. Shapes, Corners & Touch Targets (WCAG 2.2 SC 2.5.5 Level AAA)

### 6.1 Border Radius Scale

- `{rounded.xs}` (`4px`): Micro badges, chart tooltips, transaction hash tags.
- `{rounded.sm}` (`6px`): Table cells, live trade ticker pills.
- `{rounded.md}` (`10px`): Order terminal inputs, YES/NO toggle buttons, category pills.
- `{rounded.lg}` (`14px`): Primary action buttons (`{component.button-primary}`), market cards.
- `{rounded.xl}` (`20px`): TradingView chart panels, execution terminal outer frames, modals.
- `{rounded.pill}` (`9999px`): Probability badges, Guest Balance pill, Claim button.
- `{rounded.full}` (`9999px`): Circular avatars, status ping lights, icon buttons.

### 6.2 Strict 44×44px Target Size Enforcement (SC 2.5.5 Level AAA)

To fully satisfy **WCAG 2.2 SC 2.5.5 Target Size (Enhanced — Level AAA)**:

1. **Universal Minimum Dimension**: Every interactive element (buttons, tabs, inputs, icon triggers, claim pills, quick-fill chips, chart timeframe pills, table cash out buttons) enforces `min-height: 44px; min-width: 44px;`.
2. **Spacing Isolation**: Adjacent interactive targets maintain at least `8px` (`{spacing.xs}`) of visual gap so circular touch envelopes never collide.
3. **Quick-Fill Sizing Chips**: Preset buttons (`$10`, `$50`, `$100`, `Max`) use `height: 44px; min-width: 52px; padding: 10px 16px;`.
4. **Chart Interval Selectors**: Timeframe controls (`1H`, `1D`, `1W`, `ALL`) measure `height: 44px; min-width: 44px; padding: 8px 14px;`.

---

## 7. Component Specifications

### 7.1 Action Triggers & Buttons

**`button-primary`** — Main execution CTA (`"Buy YES"`, `"Execute Trade"`, `"Confirm Swap"`).

- Default: Background `{colors.primary}` (`#4338ca`), Text `{colors.on-primary}` (`#ffffff`), Type `{typography.button}`, Corner `{rounded.lg}`, Padding `14px 20px`, Height `48px` (min 48×44px).
- Hover: Background `{colors.primary-hover}` (`#3730a3`), Box-shadow `{shadows.glow-primary}`.
- Active: Background `{colors.primary-active}` (`#312e81`), Transform `scale(0.98)`.
- Contrast Verification: `#ffffff` on `#4338ca` = **7.90:1** (**Passes AAA 7.0:1**). `#ffffff` on `#3730a3` hover = **9.93:1** (**Passes AAA 7.0:1**).

**`button-yes`** — Direct affirmative binary outcome selector.

- Default: Background `{colors.outcome-yes-subtle}` (`rgba(6, 95, 70, 0.09)`), Text `{colors.outcome-yes-text}` (`#065f46`), Border 1px `{colors.outcome-yes-border}` (`rgba(6, 95, 70, 0.35)`), Corner `{rounded.md}`, Type `{typography.button}`, Height `44px`, Min-Width `44px`.
- Active / Selected: Background `{colors.outcome-yes}` (`#065f46`), Text `#ffffff`, Box-shadow `{shadows.glow-yes}`, Transform `scale(0.98)`.
- Contrast Verification: `#065f46` on its capsule = **6.69:1** (**Passes AA; below AAA 7.0:1**). Selected text `#ffffff` on `#065f46` = **7.68:1** (**Passes AAA 7.0:1**).

**`button-no`** — Direct negative binary outcome selector.

- Default: Background `{colors.outcome-no-subtle}` (`rgba(159, 18, 57, 0.09)`), Text `{colors.outcome-no-text}` (`#9f1239`), Border 1px `{colors.outcome-no-border}` (`rgba(159, 18, 57, 0.35)`), Corner `{rounded.md}`, Type `{typography.button}`, Height `44px`, Min-Width `44px`.
- Active / Selected: Background `{colors.outcome-no}` (`#9f1239`), Text `#ffffff`, Box-shadow `{shadows.glow-no}`, Transform `scale(0.98)`.
- Contrast Verification: `#9f1239` on its capsule = **6.84:1** (**Passes AA; below AAA 7.0:1**). Selected text `#ffffff` on `#9f1239` = **8.02:1** (**Passes AAA 7.0:1**).

**`button-claim`** — Ephemeral guest sandbox balance refill trigger.

- Container: Background `{colors.primary-subtle}` (`rgba(67, 56, 202, 0.08)` on card = `#f0effb`), Border 1px `{colors.primary-border}` (`#4338ca`), Text `{colors.primary}` (`#4338ca`), Corner `{rounded.pill}`, Padding `10px 18px`, Min-Height `44px`, Min-Width `44px`.
- Contrast: `#4338ca` on `#f0effb` = **6.94:1** (**Passes AA; below AAA 7.0:1**). Border `#4338ca` against card = **7.90:1** (**Passes AAA**).
- Cooldown State: Opacity `0.65`, Cursor `not-allowed`.

---

### 7.2 Navigation & Docks

**`top-header-dock`** — Sticky top navigation shell (`64px` height).

- Background: `{colors.surface-glass}` with `backdrop-filter: blur(16px)` and 1px bottom border `{colors.hairline}`.
- Left Cluster: BayesMarket monogram in Indigo (`#4338ca`) + wordmark in `{typography.title-lg}` Scoutie Sans. Category navigation tabs (`AI`, `Crypto`, `Tech`, `Macro`) with `min-height: 44px` touch hitboxes and `aria-current="page"`.
- Right Cluster: Ephemeral Guest Balance indicator (`"$1,000.00 USDC"` in `{typography.mono-sm}`), `[+ Claim]` button (44px height), and live WebSocket telemetry connection pulse (🟢 connected with explicit aria-label).

---

### 7.3 Market Discovery & Catalog Cards

**`market-card`** — Primary prediction card in the discovery grid.

- Container: Background `{colors.surface-card}`, Border 1px `{colors.hairline}`, Corner `{rounded.lg}`, Padding `18px`, Transition `all 150ms ease`.
- Header: Category badge (`AI`, `Crypto`), Resolution countdown (`"Dec 31, 2026"` in `{typography.body-sm}`).
- Body: Market question headline in `{typography.title-lg}` Scoutie Sans.
- Metrics Bar:
    - Dual probability split bar (e.g. 72% Green / 28% Red progress track with 3:1 graphical boundary).
    - High-contrast probability pills: `▲ 72¢ YES` ({colors.outcome-yes-text}) vs `▼ 28¢ NO` ({colors.outcome-no-text}). Both pills have `min-height: 44px; min-width: 44px`.
- Footer: 24h Volume counter (`"$14,250 Volume"` in `{typography.mono-xs}`) + liquidity pool depth indicator.

---

### 7.4 Execution Terminal & Slippage Estimator

**`order-terminal-panel`** — The core order execution widget.

- Container: Background `{colors.surface-terminal}`, Border 1px `{colors.border-strong}`, Corner `{rounded.xl}`, Padding `20px`.
- Outcome Toggle: Full-width segmented switch between `[BUY YES]` and `[BUY NO]` (both segments $\ge 44\text{px}$ touch height).
- Input Field: High-density numerical currency input (`USDC`) with embedded `MAX` button (44px target) and balance indicator.
- Dynamic AMM Slippage Drawer:
    - Estimated Shares Filled: `{typography.mono-md}`.
    - Average Execution Price: `{typography.mono-sm}` (e.g. `$0.73 USDC`).
    - Expected Price Impact / Slippage: Color-coded indicator (Green `< 1.0%`, Amber `1.0%–3.0%`, Crimson `> 3.0%`).
    - Potential Return: `{typography.mono-md}` in `{colors.outcome-yes-text}` (e.g. `+36.9%`).
- Execution Trigger: Full-width `{component.button-primary}` displaying dynamic label: `"Trade $100.00 on YES"`.

---

### 7.5 Financial Confirmation Modal (WCAG 2.2 SC 3.3.6 Level AAA)

**`order-confirm-dialog`** — Mandatory financial verification review dialog.

- Triggered before any trade is executed on the AMM ledger.
- Elements:
    - Market Question Title.
    - Selected Position: `▲ YES` or `▼ NO` with high-contrast icon.
    - Deposit Amount: `$100.00 USDC`.
    - Estimated Shares Received: `138.88 YES Shares`.
    - Average Execution Price: `$0.72 USDC / Share`.
    - Maximum Slippage Tolerance: `1.50%`.
    - Cash Balance After Execution: `$900.00 USDC`.
- Actions:
    - `"Confirm & Place Trade"` (`{component.button-primary}`, 48px height).
    - `"Edit Order"` (Secondary button, 44px height, returns focus to amount input).

---

### 7.6 Jargon Glossary & Plain English Tooltips (SC 3.1.3 & SC 3.1.4 Level AAA)

**`glossary-popover`** — Inline definitions for prediction market terminology.

- Trigger: Semantic `<button>` with `aria-haspopup="dialog"` and `aria-expanded="false"`, sized 44×44px.
- Terms Defined: "AMM" (Automated Market Maker), "CPMM" (Constant Product Market Maker), "Slippage", "Implied Probability", "Resolution Oracle".
- Plain English Resolution Rule Summary: Accessible callout box rendering legal resolution criteria at lower secondary reading level (Flesch-Kincaid Grade 7-8).

---

## 8. Do's and Don'ts

### Do

- **Do use Indigo (`#4338ca`) as the primary brand anchor.** Pair it with `#ffffff` text, which gives 7.90:1 contrast (above the WCAG 2.2 AAA 7.0:1 threshold).
- **Do pair every probability metric with dual-coded text and visual percentage bars.** Always include geometric direction markers (`▲ YES` / `▼ NO`) so colorblind users never depend on color alone.
- **Do enforce a strict 44×44px minimum touch target on all clickable elements** to fulfill WCAG 2.2 SC 2.5.5 Level AAA.
- **Do enforce `scroll-padding-top: 76px; scroll-padding-bottom: 96px;`** so focused inputs are never obscured by sticky headers or drawers (SC 2.4.12 Level AAA).
- **Do present a two-step confirmation review dialog before trade execution** to fulfill WCAG 2.2 SC 3.3.6 Error Prevention (All) Level AAA.
- **Do use JetBrains Mono (`{typography.mono-md}`, `{typography.kpi-metric}`) for all monetary values, odds, shares, and timestamps.** Tabular figures prevent layout jitter during real-time streaming.

### Don't

- **Don't use any text color with less than 7.0:1 contrast against dark backgrounds.** Low-contrast grays ($< 7:1$) are completely banned under WCAG 2.2 Level AAA.
- **Don't create touch targets under 44×44px.** Sub-44px buttons violate SC 2.5.5 Level AAA.
- **Don't justify text.** Justified text impairs readability for users with cognitive disabilities. Always left-align.
- **Don't execute financial transactions in one click without a confirmation review dialog** (violates SC 3.3.6 Level AAA).
- **Don't introduce cognitive tests or puzzles.** 1-click ephemeral Guest authentication satisfies SC 3.3.9 Level AAA.
- **Don't allow streaming tickers to steal screen reader focus.** Use `aria-live="polite"` with user toggle controls to suppress updates (SC 2.2.4 Level AAA).

---

## 9. Responsive Architecture & Multi-Device Parity

BayesMarket is engineered to deliver institutional-grade trading ergonomics from smartphones to ultra-wide desktop monitors:

### 9.1 Breakpoint Matrix

| Breakpoint Name     | Viewport Width          | Navigation Mode                                | Trading Terminal Layout                                                                          | Chart Integration                                                   |
| :------------------ | :---------------------- | :--------------------------------------------- | :----------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ |
| **Mobile**          | `< 768px` (375–430px)   | Sticky Top Brand Bar + Bottom Execution Drawer | Single-column market view with slide-up order terminal                                           | Interactive canvas with touch crosshair and zoom gesture            |
| **Tablet / iPad**   | `768px – 1024px`        | Top Glass Bar + Category Slider                | 2-Column Split: Left Market Chart, Right Order Terminal                                          | 60fps TradingView canvas (400px height)                             |
| **Desktop Cockpit** | `1024px – 1440px`       | Full Top Nav with live metrics                 | 3-Column Pro Layout: Chart (Left 55%), Order Terminal (Right 25%), Live Trade Stream (Right 20%) | Full-featured chart with time-frame pills (`1H`, `1D`, `1W`, `ALL`) |
| **Ultrawide Pro**   | `> 1440px` (1440p / 4K) | Fixed Header + Breadcrumb Bar                  | Max-width `1600px` centered 4-pane layout: Market Depth + Chart + Order Cockpit + Portfolio      | High-DPI canvas with full order-book visualization                  |

---

### 9.2 Layout Form Factors (ASCII Schematics)

```
1. MOBILE VIEW (375px–430px)          2. DESKTOP COCKPIT (1280px–1600px)
┌─────────────────────────┐           ┌────────────────────────────────────────────────────────┐
│ [Logo] [$1000]  [+Claim]│           │ [BayesMarket Logo]  Markets  Portfolio    [$1000]  [Claim]│
├─────────────────────────┤           ├──────────────────────────────────────────┬─────────────┤
│ Category Tabs (Scroll)  │           │ LEFT: MARKET CHART & PROBABILITY         │ RIGHT:      │
├─────────────────────────┤           │ • Market Question Header in Scoutie Sans │ TERMINAL    │
│ Market Hero & % Odds    │           │ • Hero Probability: [72% YES]            │ • Outcome   │
│ [▲ 72% YES] [▼ 28% NO]  │           │ • TradingView Canvas Area (60fps)        │   [YES][NO] │
├─────────────────────────┤           │   ────────────────────────────────────   │ • Amount    │
│ TradingView Canvas (40%)│           │ • Resolution Rules & Source Verification │   [$100.00] │
├─────────────────────────┤           ├──────────────────────────────────────────┤ • Slippage  │
│ DOCKED ORDER TERMINAL   │           │ RECENT TRADES FEED                       │   [1.25%]   │
│ • [▲ BUY YES] [▼ BUY NO]│           │ • 150 YES @ 0.72  • 40 NO @ 0.28         │ • [TRADE]   │
│ • [$100] [Max]          │           │ • 500 YES @ 0.71  • 100 YES @ 0.72       │   (#4338ca) │
│ • [EXECUTE (48px H)]    │           └──────────────────────────────────────────┴─────────────┘
└─────────────────────────┘
```

---

## 10. Master WCAG 2.2 Level AAA Compliance & Verification Matrix

### 10.1 Principle 1: Perceivable

#### SC 1.3.6 Identify Purpose (Level AAA)

- All main structural regions use HTML5 and ARIA landmark roles: `<header role="banner">`, `<main role="main">`, `<nav role="navigation" aria-label="Market Categories">`, `<section role="region" aria-label="Order Execution Terminal">`.
- Currency and transaction inputs implement standardized `autocomplete` tokens (`autocomplete="transaction-amount"`, `autocomplete="off"` where appropriate).
- Visual icons pair with semantic text or `aria-label` attributes describing purpose.

#### SC 1.4.6 Contrast (Enhanced — Level AAA)

Calculated via the WCAG relative luminance formula:
$$L = 0.2126 R + 0.7152 G + 0.0722 B, \quad \text{Contrast} = \frac{L_{\text{lighter}} + 0.05}{L_{\text{darker}} + 0.05}$$

Under **WCAG 2.2 Level AAA**, all normal text requires **7.0:1 minimum**. Large text ($\ge 24\text{px}$ regular or $\ge 18.5\text{px}$ bold) requires **4.5:1 minimum**. Graphical components require **3.0:1 minimum** (SC 1.4.11).

| UI Element Pair                  | Foreground Color                        | Background Surface                              | Contrast Ratio | WCAG 2.2 Level AAA Status             |
| :------------------------------- | :-------------------------------------- | :---------------------------------------------- | :------------- | :------------------------------------ |
| **Primary Ink on Canvas**        | `{colors.ink}` (`#0f172a`)              | `{colors.canvas}` (`#f8f9fc`)                   | **16.96 : 1**  | **PASS AAA**                          |
| **Primary Ink on Card**          | `{colors.ink}` (`#0f172a`)              | `{colors.surface-card}` (`#ffffff`)             | **17.85 : 1**  | **PASS AAA**                          |
| **Secondary Ink on Canvas**      | `{colors.ink-secondary}` (`#1e293b`)    | `{colors.canvas}` (`#f8f9fc`)                   | **13.90 : 1**  | **PASS AAA**                          |
| **Secondary Ink on Card**        | `{colors.ink-secondary}` (`#1e293b`)    | `{colors.surface-card}` (`#ffffff`)             | **14.63 : 1**  | **PASS AAA**                          |
| **Body & Muted on Canvas**       | `{colors.body}` (`#334155`)             | `{colors.canvas}` (`#f8f9fc`)                   | **9.84 : 1**   | **PASS AAA**                          |
| **Body & Muted on Card**         | `{colors.body}` (`#334155`)             | `{colors.surface-card}` (`#ffffff`)             | **10.35 : 1**  | **PASS AAA**                          |
| **Muted on Card**                | `{colors.muted}` (`#3b4861`)            | `{colors.surface-card}` (`#ffffff`)             | **9.19 : 1**   | **PASS AAA**                          |
| **Primary Button Text**          | `{colors.on-primary}` (`#ffffff`)       | `{colors.primary}` (`#4338ca`)                  | **7.90 : 1**   | **PASS AAA**                          |
| **Primary Button Hover Text**    | `{colors.on-primary}` (`#ffffff`)       | `{colors.primary-hover}` (`#3730a3`)            | **9.93 : 1**   | **PASS AAA**                          |
| **Primary Button Active Text**   | `{colors.on-primary}` (`#ffffff`)       | `{colors.primary-active}` (`#312e81`)           | **11.42 : 1**  | **PASS AAA**                          |
| **YES Label in Capsule**         | `{colors.outcome-yes-text}` (`#065f46`) | `{colors.outcome-yes-subtle}` (about `#e9f1ee`) | **6.69 : 1**   | **PASS AA (below AAA 7.0:1)**         |
| **YES Label on Canvas**          | `{colors.outcome-yes-text}` (`#065f46`) | `{colors.canvas}` (`#f8f9fc`)                   | **7.30 : 1**   | **PASS AAA**                          |
| **YES Active Solid Button Text** | `{colors.on-outcome}` (`#ffffff`)       | `{colors.outcome-yes}` (`#065f46`)              | **7.68 : 1**   | **PASS AAA**                          |
| **NO Label in Capsule**          | `{colors.outcome-no-text}` (`#9f1239`)  | `{colors.outcome-no-subtle}` (about `#f6eaed`)  | **6.84 : 1**   | **PASS AA (below AAA 7.0:1)**         |
| **NO Label on Canvas**           | `{colors.outcome-no-text}` (`#9f1239`)  | `{colors.canvas}` (`#f8f9fc`)                   | **7.61 : 1**   | **PASS AAA**                          |
| **NO Active Solid Button Text**  | `{colors.on-outcome}` (`#ffffff`)       | `{colors.outcome-no}` (`#9f1239`)               | **8.02 : 1**   | **PASS AAA**                          |
| **Claim Button Text**            | `{colors.primary}` (`#4338ca`)          | `{colors.primary-subtle}` (about `#f0effb`)     | **6.94 : 1**   | **PASS AA (below AAA 7.0:1)**         |
| **Warning Callout Text**         | `{colors.status-warning}` (`#78350f`)   | `{colors.status-warning-bg}` (`#fef3c7`)        | **8.15 : 1**   | **PASS AAA**                          |
| **Resolved Market Text**         | `{colors.status-resolved}` (`#581c87`)  | `{colors.status-resolved-bg}` (`#f5f3ff`)       | **9.92 : 1**   | **PASS AAA**                          |
| **Info / Category Text**         | `{colors.status-info}` (`#075985`)      | `{colors.status-info-bg}` (`#f0f9ff`)           | **7.09 : 1**   | **PASS AAA**                          |
| **Interactive Border Boundary**  | `{colors.border-strong}` (`#64748b`)    | `{colors.canvas}` (`#f8f9fc`)                   | **4.52 : 1**   | **PASS AAA Non-Text (Exceeds 3.0:1)** |
| **Interactive Border on Card**   | `{colors.border-strong}` (`#64748b`)    | `{colors.surface-card}` (`#ffffff`)             | **4.76 : 1**   | **PASS AAA Non-Text (Exceeds 3.0:1)** |
| **Focus Perimeter Outline**      | `{colors.focus-outline}` (`#3730a3`)    | `{colors.canvas}` (`#f8f9fc`)                   | **9.44 : 1**   | **PASS AAA Focus (Exceeds 3.0:1)**    |

#### SC 1.4.8 Visual Presentation (Level AAA)

1. **Line Length**: Paragraphs set to `max-width: 68ch` (under the 80-character maximum mandate).
2. **Line Height & Spacing**: `line-height: 1.55` on body copy; paragraph separation margin-bottom set to `2.25em` ($1.5 \times$ line spacing).
3. **No Justification**: Left-aligned only (`text-align: left; text-justify: none`).
4. **200% Zoom Reflow**: Full responsiveness at 200% zoom with zero horizontal scrolling.
5. **System High Contrast**: Support for `@media (forced-colors: active)`.

#### SC 1.4.9 Images of Text (No Exception — Level AAA)

- All copy, odds, percentages, and market titles are rendered with DOM text or vector SVG text elements. Zero raster images of text.

---

### 10.2 Principle 2: Operable

#### SC 2.1.3 Keyboard (No Exception — Level AAA)

Every single trading, navigation, and inspection workflow is 100% operable via keyboard alone:

| Keybinding                       | Scope            | Action                                                                   |
| :------------------------------- | :--------------- | :----------------------------------------------------------------------- |
| `[Tab]` / `[Shift+Tab]`          | Global           | Move sequential focus between interactive elements                       |
| `[Arrow Left]` / `[Arrow Right]` | Order Terminal   | Toggle between `[BUY YES]` and `[BUY NO]` segmented buttons              |
| `[Arrow Up]` / `[Arrow Down]`    | Slippage Drawer  | Adjust slippage tolerance percentage slider                              |
| `[Enter]` / `[Space]`            | Focused Control  | Activate button, open dropdown, or commit trade slip                     |
| `[Escape]`                       | Modals / Drawers | Dismiss order confirmation dialog, close mobile drawer, dismiss tooltips |
| `[Y]`                            | Quick Shortcut   | Focus order terminal and select `BUY YES`                                |
| `[N]`                            | Quick Shortcut   | Focus order terminal and select `BUY NO`                                 |
| `[F]`                            | Quick Shortcut   | Claim virtual testnet allocation                                         |

#### SC 2.2.3 & SC 2.2.6 No Timing & Timeouts (Level AAA)

- Market prices update continuously in real time, but user drafting inputs never timeout or expire arbitrarily.
- Guest sessions persist for 30 days in local browser storage (> 20 hours exception).

#### SC 2.2.4 Interruptions (Level AAA)

- Traders can toggle "Pause live stream" or "Mute ticker updates" via an accessible switch in the top header.
- Background price ticks use `aria-live="polite"` and never steal keyboard focus or interrupt screen reader reading flow.

#### SC 2.2.5 Re-authenticating (Level AAA)

- If an ephemeral guest session token is refreshed, the user's active trade parameters (amount entered, outcome selected, slippage tolerance) and open tab selections are preserved in `localStorage` and automatically restored without data loss.

#### SC 2.3.2 & SC 2.3.3 Flashes & Reduced Motion (Level AAA)

- Zero UI elements flash more than 3 times in any 1-second period ($\le 0.5\text{Hz}$ smooth pulse max).
- Full reduced-motion implementation disables all non-essential transitions:

```css
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
    }

    .pulse-glow,
    .order-glow {
        box-shadow: none !important;
        animation: none !important;
    }
}
```

#### SC 2.4.8 Location (Level AAA)

- Breadcrumb navigation displayed on all market detail pages: `Markets / Tech / US AI Regulation 2026`.
- Active navigation tab features `aria-current="page"`.
- Document `<title>` dynamically updates: `[72% YES] US AI Regulation 2026 | BayesMarket`.

#### SC 2.4.9 Link Purpose (Link Only — Level AAA)

- Every hyperlink explicitly identifies destination from link text alone (e.g. `"View US AI Executive Order full resolution criteria"`, `"Explore Technology Category Markets"`). Ambiguous link copy (`"here"`, `"read more"`) is strictly prohibited.

#### SC 2.4.10 Section Headings (Level AAA)

- Every page organizes content using a strict semantic heading hierarchy (`h1` $\to$ `h2` $\to$ `h3` $\to$ `h4`) without skipped heading levels.

#### SC 2.4.12 Focus Not Obscured (Enhanced — Level AAA - New in WCAG 2.2)

- When any element receives keyboard focus, **no part** of the element or its focus indicator is hidden behind sticky headers, floating drawers, or bottom docks:

```css
html {
    scroll-padding-top: 76px;
    scroll-padding-bottom: 96px;
}
```

- Dialogs and modals implement an inert background trap (`inert` attribute on non-modal content) so obscured background elements cannot receive focus.

#### SC 2.4.13 Focus Appearance (Level AAA - New in WCAG 2.2)

- Focus indicators enclose the entire component perimeter with a minimum 2px solid outline in `#3730a3`:

```css
:focus-visible {
    outline: 2px solid var(--focus-outline, #3730a3);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(55, 48, 163, 0.35);
}
```

- Contrast of `#3730a3` against canvas `#f8f9fc` is **9.44:1**, and against card `#ffffff` is **9.93:1** (both exceeding 3.0:1).

#### SC 2.5.5 Target Size (Enhanced — Level AAA)

- Every interactive element (buttons, tabs, inputs, icon buttons, preset amount chips, timeframe selectors, table cash out buttons) enforces `min-height: 44px; min-width: 44px;`.
- Adjacent targets maintain a minimum `8px` (`{spacing.xs}`) gap to prevent accidental overlap.

#### SC 2.5.6 Concurrent Input Mechanisms (Level AAA)

- The interface accepts touch, mouse, physical keyboard, and stylus input concurrently without requiring configuration changes or page reload.

---

### 10.3 Principle 3: Understandable

#### SC 3.1.3 & SC 3.1.4 Unusual Words & Abbreviations (Level AAA)

- Prediction market terminology ("AMM", "CPMM", "Slippage", "USDC", "Oracle") includes accessible `<dfn>` definition popovers triggered by a 44×44px help button.
- All domain abbreviations expand using semantic `<abbr title="...">` markup.

#### SC 3.1.5 Reading Level (Level AAA)

- Market resolution rules include an accessible plain-language summary written at lower secondary education reading level (Flesch-Kincaid Grade 7-8).

#### SC 3.1.6 Pronunciation (Level AAA)

- Specialized words provide pronunciation context via phonetic text and `aria-label` (e.g. `Bayes` `/beɪz/`, `USDC` `/juː ɛs diː siː/`).

#### SC 3.2.5 Change on Request (Level AAA)

- Page navigation, modal display, trade submissions, and input clears occur strictly on explicit user action. Real-time ticker updates never cause automatic context jumps.

#### SC 3.3.5 Help (Level AAA)

- Context-sensitive help icons with popover explanations are placed adjacent to complex inputs (Slippage Tolerance, Expected Shares, Liquidity Reserves).

#### SC 3.3.6 Error Prevention (All — Level AAA - Critical Financial Requirement)

Because BayesMarket processes financial transactions:

1. **Checked**: Real-time client and server validation checks for insufficient balance, excessive price impact ($> 5\%$), and invalid input values before enabling submission.
2. **Confirmed**: Clicking `"Trade $100.00 on YES"` opens the **Order Confirmation Review Dialog**, summarizing:
    - Market Question & Outcome (`▲ YES`)
    - Exact Amount & Expected Shares Filled
    - Average Price & Maximum Slippage Tolerance
    - Wallet Cash Balance After Execution
3. **Actionable Review**: The user must explicitly press `"Confirm & Place Trade"` to submit or `"Edit Order"` to modify parameters without committing the transaction.

#### SC 3.3.9 Accessible Authentication (Enhanced — Level AAA - New in WCAG 2.2)

- Zero cognitive function tests (no CAPTCHAs, no memorized passwords, no puzzle sliders).
- 1-click ephemeral Guest Session automatically provisions virtual sandbox trading.
- Full support for WebAuthn passkeys and copy-paste password managers.

---

### 10.4 Principle 4: Robust

#### SC 4.1.3 Status Messages (Level AAA Baseline)

- Live price updates announce quietly via `aria-live="polite"` with `aria-atomic="true"`:
    ```html
    <div aria-live="polite" aria-atomic="true" class="sr-only">Market probability updated: 72 percent YES, 28 percent NO.</div>
    ```
- Trade execution confirmations and error alerts announce immediately using `role="alert"` with `aria-live="assertive"`.

---

## 11. Iteration Guide & Engineering Rules

1. **Strict Token Referencing**: The front-matter aliases are design-spec names. Implement them as canonical CSS custom properties (for example, `var(--primary)`, `var(--kpi-metric-size)`, and `var(--radius-lg)`); hardcoded ad-hoc hex values or arbitrary pixel paddings are prohibited.
2. **Type Segregation**: Keep Scoutie Sans strictly assigned to linguistic and interface elements; assign JetBrains Mono to all numerical, financial, and probability entities.
3. **Financial Confirmation Modal Mandatory**: Never bypass the two-step order confirmation review dialog during trade execution (SC 3.3.6 Level AAA).
4. **44×44px Universal Hitbox Rule**: No button, tab, chip, or input may have `height < 44px` or `width < 44px` under any circumstances (SC 2.5.5 Level AAA).
5. **Zero Layout Jitter**: All price and volume counters must include `font-variant-numeric: tabular-nums` to prevent sibling element displacement on price ticks.
6. **Automated CI Accessibility Gate**: Incorporate automated `axe-core` and contrast checks in the CI/CD pipeline enforcing zero violations at WCAG 2.2 Level AAA.

---

## 12. Known Gaps & Future Roadmap

- **Multi-Outcome Categorical Markets**: Design system currently specifies binary (`YES`/`NO`) outcomes. 3+ categorical markets (e.g., Presidential Primaries with 5 candidates) will utilize a multi-color spectrum palette calibrated for AAA contrast in MVP 1.
- **Scalar / Range Markets**: Numerical range sliders (e.g. "Bitcoin price on Nov 1") are reserved for MVP 2.
- **Order-Book Depth Visualizer**: A full dual-sided bid/ask depth canvas chart with high-contrast boundary fills will accompany limit-order implementation in Phase 2.
