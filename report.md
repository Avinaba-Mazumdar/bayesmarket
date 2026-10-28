# BayesMarket Audit Report

Date: 2026-10-28. Scope: the full repository at commit `3f2e7a6` on `master`: backend (Go), frontend (Angular), schema, infrastructure, CI, and the `target/` documents.

Method: I read every production source file in full. I skimmed test files for coverage and for test-only hooks that leak into production code. I did not change any code or file other than this report. I did not run the app, the tests, or a browser. Findings marked **(verify)** depend on deployment details I could not see.

Severity scale:

- **High**: money, security, or a core flow is broken or exploitable in a realistic setup.
- **Medium**: a wrong result, a degraded flow, or a defense that is weaker than documented.
- **Low**: a minor defect, inconsistency, or polish item.

---

## 1. Summary

The financial core is sound. The AMM math uses fixed-point decimals with a consistent rounding policy. Every mutation runs in one transaction with row locks and a double-entry ledger that is checked for balance before commit. Idempotency is bound to a request fingerprint. Admin authority is read from the database, not from the token. Refresh tokens are hashed, rotated, and revoke all sessions when a used token comes back. None of these need rework.

The problems sit around that core:

1. **Deployment networking.** Client IP detection, WebSocket proxying, and every per-IP limit depend on proxy configuration that the Vercel and Render deploy probably does not have. If so, all users share one IP bucket (S-1, S-2).
2. **Frontend state flow.** The market page tears itself down after every trade. Slug URLs silently lose live updates. Several screens show "empty" when they mean "still loading" or "failed". The access token is never renewed during use (L-1 to L-6).
3. **Accumulated dead code and duplication.** There is a broken "Delete market" feature with no backend route, unused models and helpers, legacy-migration code for a schema that was just reset, and five copies of the same idempotent-mutation boilerplate (section 5).
4. **Documentation drift.** `ARCHITECTURE.md` and `AGENTs.md` describe endpoints, amounts, and colours that the code no longer has (section 7).

### Fix first

| # | ID | Item |
|---|----|------|
| 1 | S-1 | Make client-IP detection correct behind Vercel and Render, or every IP limit becomes a global limit |
| 2 | S-2 | Verify WebSockets work in production; Vercel rewrites do not proxy them |
| 3 | L-1 | Stop replacing the whole market page with a spinner after each order or cash-out |
| 4 | L-2 | Compare live events against `market().id`, not the route param (slug links lose live data) |
| 5 | L-3 / L-4 | Add an HTTP interceptor that renews the access token on 401, and serialize refresh across tabs |
| 6 | L-5 | Persist the oracle proof on the market row; it is currently deleted after 7 days |
| 7 | L-7 | Remove the admin Delete button, or add the endpoint it calls |
| 8 | S-3 | Make the ledger append-only at the database level |

---

## 2. Security

### S-1 · High · Client IP is probably the proxy's IP in production (verify)

[config.go](backend/internal/config/config.go), [router.go:125-131](backend/internal/transport/rest/router.go#L125-L131)

With `TRUSTED_PROXIES` empty, `c.ClientIP()` returns the TCP peer. Behind Render's load balancer, and again behind Vercel's `/api` rewrite in [vercel.json](frontend/vercel.json), that peer is a proxy, not the user. Every per-IP control then applies to all users together:

| Control | Location | Effect when all users share one IP |
|---|---|---|
| Guest creation, 5 per IP per day | [auth_handler.go:168](backend/internal/transport/rest/auth_handler.go#L168) | The 6th visitor of the day cannot start a guest session |
| Claims, 10 per IP per day and 30 s apart | [claim_handler.go:337](backend/internal/transport/rest/claim_handler.go#L337) | Claims stop for everyone after 10 |
| WebSocket connections, 20 per IP | [ws_handler.go:13](backend/internal/transport/ws/ws_handler.go#L13) | The 21st open tab anywhere is refused |
| Public read limiter, 10 burst then 1/s | [rate_limiter.go](backend/internal/middleware/rate_limiter.go) | The whole site shares one bucket |
| Admin failure limiter, 5 failures | [auth.go:183](backend/internal/middleware/auth.go#L183) | Any five failed admin calls by anyone lock every admin out |

A related gap existed in the former Docker setup: its nginx proxy set `X-Forwarded-For` on `/api/` but not on `/ws/`, so every WebSocket client looked like the proxy. Docker is removed; the same check applies to any reverse proxy in front of the API.

**Fix:** Set `TRUSTED_PROXIES` to the platform's proxy ranges, or read the platform's verified client-IP header (for example `CF-Connecting-IP` or `True-Client-IP`) through `gin.Engine.TrustedPlatform`. Forward `X-Forwarded-For` and `X-Real-IP` on the WebSocket route of any reverse proxy. Log `ClientIP()` once at startup on a real request so the result can be checked.

### S-2 · High · WebSockets through the Vercel rewrite (verify)

[vercel.json](frontend/vercel.json) rewrites `/ws/:path*` to Render. Vercel rewrites do not upgrade WebSocket connections. In production the live price, trade tape, and resolution banner would then never connect: the client retries forever with a 10-second backoff and gives no visible error.

**Fix:** Connect the browser directly to the Render WebSocket origin (`wss://…onrender.com/ws/…`) and add that origin to `CORS_ORIGIN` and the CSP `connect-src`. Show the `connectionStatus` signal in the UI so a dead stream is visible.

### S-3 · Medium · The ledger is append-only by convention, not by the database

[000001_core_schema.up.sql:109](backend/internal/database/migrations/000001_core_schema.up.sql#L109), [setup_least_privilege_user.sql:42](backend/scripts/setup_least_privilege_user.sql#L42)

The runtime role is granted `UPDATE` on every table, including `ledger_entries`, `trades`, and `users.is_admin`. Any future SQL bug in the API could rewrite history or grant admin.

**Fix:** In the role script, run `REVOKE UPDATE ON ledger_entries, trades FROM bayes_app` and grant `UPDATE` on `users` by column, excluding `is_admin`. Optionally add a trigger that rejects `UPDATE` and `DELETE` on `ledger_entries`.

### S-4 · Medium · Access tokens cannot be revoked

[auth.go](backend/internal/middleware/auth.go)

Access tokens live for one hour and are checked by signature only. After logout, account deletion, or detected refresh-token theft (which revokes all refresh sessions), a stolen access token keeps working for up to an hour.

**Fix:** Shorten the TTL to 10–15 minutes; the refresh flow already exists. Or add a `token_version` column on `users`, put it in the token, and check it in `RequireAuth`. One indexed lookup per request is cheap.

### S-5 · Medium · Dev authentication bypass depends only on `APP_ENV`

[auth_handler.go:244-275](backend/internal/transport/rest/auth_handler.go#L244-L275), [auth_handler.go:473-509](backend/internal/transport/rest/auth_handler.go#L473-L509)

With `APP_ENV=dev` or `local`, any `mock-*` or `dev-*` token signs in, even when a real Google client ID is configured. With no client ID, the caller also chooses the email. The local-database guard in config reduces the risk, but the Compose service name `postgres` counts as local, so a Compose deploy run with `APP_ENV=dev` exposes the bypass on a public host.

**Fix:** Accept mock tokens only when `GOOGLE_CLIENT_ID` is empty and the request comes from a loopback address. Log a startup warning whenever mock authentication is reachable.

### S-6 · Low · The market cache can grow without bound

[market_cache.go](backend/internal/transport/rest/market_cache.go)

Entries are keyed by the raw `:id` string, and expired entries are never removed. `uuid.Parse` accepts upper-case, braced, and `urn:uuid:` forms, so one market can be cached under many keys through `POST /markets/:id/quote` (20 requests per second per IP).

**Fix:** Key by the canonical `uuid.String()` or by the slug, and sweep expired entries on write.

### S-7 · Low · `/healthz` is unlimited and pings the database on every call

[router.go:201-227](backend/internal/transport/rest/router.go#L201-L227)

An anonymous flood becomes database load.

**Fix:** Cache the ping result for one or two seconds, or put the endpoint behind the public read limiter with a high burst.

### S-8 · Low · Smaller items

- **Account enumeration.** `account_conflict` tells the caller that an email is already registered ([auth_handler.go:35](backend/internal/transport/rest/auth_handler.go#L35)). Acceptable for this product; note it.
- **Inconsistent security headers.** Resolved by removing the nginx config. The frontend CSP now lives only in `vercel.json`, and the API sets its own headers. `img-src https:` in that CSP still allows any host; tighten it once the image sources are known.
- **Session tokens in `sessionStorage`.** They are readable by any injected script. No `innerHTML` or `bypassSecurityTrust*` exists in the codebase, so the risk is low, but the CSP is the main protection. Keep `script-src` tight.
- **Unlimited free money.** Each guest gets 1,000 USDC and claims add more. Within the IP cap anyone can mint balances and move prices. That is acceptable for paper trading, but any leaderboard or reputation feature added later must not trust balances.

---

## 3. Logic and financial flaws

### L-1 · High · The market page tears itself down after every trade

[market-detail.component.ts:449-470](frontend/src/app/features/market/market-detail.component.ts#L449-L470)

`fetchMarket(false)` sets `isLoading(true)`. The template then replaces the whole page with a spinner, which destroys the order terminal (the typed amount and slippage reset), both dialogs, the chart (history reloads), and the activity feed. Focus is lost, which breaks keyboard and screen-reader use. This runs after every order, every cash-out, and every `MARKET_UPDATED` frame.

**Fix:** Use the spinner only on the first load. Later refreshes should update the `market` signal in place.

### L-2 · Medium · Slug URLs lose all live updates

[market-detail.component.ts:337-383](frontend/src/app/features/market/market-detail.component.ts#L337-L383)

The effects compare `tick.market_id === this.id()`. `id()` is the route parameter, but WebSocket frames carry the UUID. Admin links open `/markets/<slug>` ([admin-dashboard.component.ts:159](frontend/src/app/features/admin/admin-dashboard.component.ts#L159), [admin-create-market.component.ts:194](frontend/src/app/features/admin/admin-create-market.component.ts#L194)). On those pages, live prices, the resolution banner, and update frames never apply.

**Fix:** Compare against `this.market()?.id`.

### L-3 · Medium · Two tabs refreshing at once log the user out everywhere

[auth.store.ts:347-366](frontend/src/app/state/auth.store.ts#L347-L366), [refresh_session.go:131-145](backend/internal/transport/rest/refresh_session.go#L131-L145)

The access token is stored per tab in `sessionStorage`, so every new tab calls `/auth/refresh`. The `refreshInFlight` flag only works within one tab. When two tabs refresh with the same cookie (for example after a browser restore), the second request presents a token that was just rotated. The server treats that as theft and revokes every session.

**Fix:** Serialize refresh across tabs with `navigator.locks.request('bm-refresh', …)`, or accept the previous token for a short grace period (about 30 seconds) and return the same successor.

### L-4 · Medium · The access token is never renewed during use

[api.service.ts](frontend/src/app/core/services/api.service.ts)

There is no HTTP interceptor. After one hour, orders, cash-outs, and claims fail with a generic "Trade Rejected" toast. The claim handler then clears the session ([auth.store.ts:431](frontend/src/app/state/auth.store.ts#L431)) even though a valid refresh cookie exists.

**Fix:** Add one `HttpInterceptorFn` that attaches the bearer token and, on a 401, runs a single shared refresh and retries once. The idempotency key makes that retry safe. This also removes the `token` parameter from every `ApiService` method (see A-7).

### L-5 · Medium · Oracle proof is not stored and is deleted after 7 days

[admin_handler.go:1161-1178](backend/internal/transport/rest/admin_handler.go#L1161-L1178), [retention.go:587](backend/internal/database/retention.go#L587)

The comment says "the proof is stored with the settlement". In fact it exists only inside the idempotency receipt JSON and the server log. Retention deletes idempotency rows after 7 days, so the audit evidence for a resolution disappears. Markets have no `oracle_proof`, `resolved_at`, or `resolved_by` columns.

**Fix:** Add `oracle_proof`, `proof_hash`, `settlement_digest`, `resolved_at`, and `resolved_by` to `markets`, write them in the resolution transaction, and return them from `GET /markets/:id`. The detail page can then show the evidence link.

### L-6 · Medium · The cash-out slippage floor can come from a quote for a different share count

[cash-out-dialog.component.ts:258-295](frontend/src/app/features/portfolio/cash-out-dialog.component.ts#L258-L295)

When the share input changes, the old quote stays visible and the Confirm button stays enabled for the 300 ms debounce. Quote responses are also not sequenced, so a slow response can overwrite a newer one. If the user raises the amount from 5 to 100 and confirms quickly, `min_payout_usdc` comes from the 5-share quote, and the slippage protection is effectively off for that sale.

**Fix:** Clear `sellQuote` on input change, store the share count with each quote and ignore responses that no longer match, and enable Confirm only when `quote.shares_to_sell === sharesToSell()`.

### L-7 · Medium · The admin "Delete" button calls an endpoint that does not exist

[admin-dashboard.component.ts:554-572](frontend/src/app/features/admin/admin-dashboard.component.ts#L554-L572), [api.service.ts:265](frontend/src/app/core/services/api.service.ts#L265)

`DELETE /api/v1/admin/markets/:id` is not registered in [router.go](backend/internal/transport/rest/router.go), so the button always fails. The dialog text also says "purge double-entry records", which no code does or should do. `ARCHITECTURE.md:1137` still documents the endpoint.

**Fix:** Delete the button, `deleteMarket`, `DeleteMarketResponse`, the `MARKET_DELETED` frame handling, and the documentation. Void covers the real need. If deleting untraded markets matters, implement it with the documented `409 market_has_activity` rule.

### L-8 · Medium · Portfolio shows "No open positions" while loading or after an error

[portfolio-view.component.ts:270-295](frontend/src/app/features/portfolio/portfolio-view.component.ts#L270-L295)

`fetchPortfolio()` runs once in `ngOnInit`. On a page reload the token is still being restored, so the component stops loading with no data. When the session arrives, the page shows $0 metrics and "No Open Positions". A failed request is shown the same way.

**Fix:** Drive the fetch from an `effect` on `authStore.token()`, and add an error state with a retry button.

### L-9 · Medium · Market creation silently replaces invalid input

[admin-create-market.component.ts:23-37](frontend/src/app/features/admin/admin-create-market.component.ts#L23-L37)

A collateral the parser rejects (for example `5,000`) becomes `10000`. A probability outside the range is clamped to 1% or 99%. The admin gets no warning, and the market is created with numbers they did not type.

**Fix:** Show validation errors and disable Submit. Never substitute a default for invalid input.

### L-10 · Low · Editing an expired market's metadata is impossible

[admin-dashboard.component.ts:519-526](frontend/src/app/features/admin/admin-dashboard.component.ts#L519-L526)

The edit form always sends `resolution_date`, and the backend requires that date to be in the future ([admin_handler.go:840](backend/internal/transport/rest/admin_handler.go#L840)). Fixing a typo in the title of a market that is awaiting resolution is rejected.

**Fix:** Send only the fields that changed (the backend already treats them as optional), or let the backend accept an unchanged date.

### L-11 · Low · "Pause live updates" drops resolution events and never resyncs

[websocket.service.ts:134-138](frontend/src/app/core/services/websocket.service.ts#L134-L138)

While paused, every frame is discarded, including `MARKET_RESOLVED`. On resume the page keeps showing stale prices and can show a resolved market as active.

**Fix:** Always apply status frames. Refetch the market when the user resumes.

### L-12 · Low · Voiding a market is not broadcast

[admin_handler.go:1000-1005](backend/internal/transport/rest/admin_handler.go#L1000-L1005)

Resolution and edit send WebSocket frames; void does not. Open market pages keep offering trades until the server rejects one.

**Fix:** Broadcast `MARKET_UPDATED` with `status: "voided"`.

### L-13 · Low · Backend edge cases

- **Wrong status code on key reuse across markets.** Reusing one idempotency key on a different market hits the `trades` unique constraint. The replay lookup then finds a fingerprint mismatch, the error is discarded, and the caller gets `500 execution_failed` instead of `422 idempotency_key_reused` ([trade_handler.go:212-218](backend/internal/transport/rest/trade_handler.go#L212-L218)).
- **Cost-basis rounding.** On a partial sell, the ratio is rounded to 8 places before multiplying ([trade_handler.go:556](backend/internal/transport/rest/trade_handler.go#L556)). Use `totalInvested * remaining / owned` and round once.
- **History drops the newest points.** `ORDER BY bucket ASC LIMIT 1000` keeps the oldest buckets, so a long "all" range loses its most recent days ([market_history_handler.go:806-820](backend/internal/transport/rest/market_history_handler.go#L806-L820)). Order descending, then reverse.
- **Residual collateral is never closed out.** After resolution or void, the leftover seed collateral and losers' deposits stay in `pool_collateral` forever. Void refunds at cost basis can also draw on seed collateral. Both are design choices; document them, or post a closing entry back to `system_treasury`.
- **Market creation has no idempotency key.** A double submit creates two markets with suffixed slugs.
- **Resolution keys are not reused.** The resolve key is `resolve-<id>-<Date.now()>` ([admin-resolve-market.component.ts:69](frontend/src/app/features/admin/admin-resolve-market.component.ts#L69)), so a retry after a timeout uses a new key. The backend's "already resolved" check keeps this safe, but it defeats the idempotency design.
- **`winners_credited` counts positions, not traders.** The toast says "Credited N traders".

### L-14 · Low · Frontend state edge cases

- `clearSession()` resets the display balance but not `cashBalanceRaw` ([auth.store.ts:483-501](frontend/src/app/state/auth.store.ts#L483-L501)). The stale raw value still drives balance checks.
- `getInitialBalance()` invents `"$1,000.00"` when a token exists but no balance is stored ([auth.store.ts:129-131](frontend/src/app/state/auth.store.ts#L129-L131)).
- The chart's "change" is in percentage points but is labelled `%` ([price-chart.component.ts:168-175](frontend/src/app/features/charts/price-chart.component.ts#L168-L175)).
- The confirm dialog says "Orders fill at the quoted price, or the order is rejected." In fact an order fills at the current price whenever the fill stays above the slippage floor.
- The order terminal's quote cache (`quoteCache`) grows by one entry per keystroke and is never pruned.

---

## 4. UI/UX and accessibility

### U-1 · Medium · Losses are shown by colour alone

[portfolio-view.component.ts:96](frontend/src/app/features/portfolio/portfolio-view.component.ts#L96)

The total P&L prints `'$' + abs(value)` for a loss, so a loss of 12 shows as "$12.00" in red. The trend icon is `aria-hidden`, so a screen reader announces a gain. This fails WCAG 1.4.1 (Use of Color).

**Fix:** Print a sign: "−$12.00".

### U-2 · Medium · Quote failures are silent in the order terminal

[order-terminal.component.ts:758-762](frontend/src/app/features/terminal/order-terminal.component.ts#L758-L762)

A failed quote (amount over the 1M cap, market closed, or a network error) only logs to the console. The drawer shows "Awaiting quote" and the trade button stays disabled with no explanation.

**Fix:** Put the server's message in `validationError`.

### U-3 · Medium · Toasts never dismiss and stack without limit

[toast.service.ts:23-38](frontend/src/app/shared/components/toast/toast.service.ts#L23-L38)

Every helper passes `duration: 0`, so each trade adds a permanent toast. The container is `aria-live="polite"` and each toast also has `role="status"` or `role="alert"`, so screen readers may announce each one twice.

**Fix:** Cap the stack at about three. Auto-dismiss success and info toasts (pause on hover and focus is already built). Keep a single live region.

### U-4 · Medium · NO is styled as an error

The confirm dialog, the cash-out dialog, and the portfolio table use the `destructive` badge for NO and `outline` for YES. The activity feed uses `profit` and `loss`. NO is not an error. Use one dedicated outcome style everywhere, matching the YES/NO tokens.

### U-5 · Medium · The AAA claim is not verified

[e2e/accessibility.spec.ts](frontend/e2e/accessibility.spec.ts)

The only automated check runs axe at level AA, on three public pages, and is not part of CI. The trading page, dialogs, portfolio, and admin are not tested. There are 41 declarations of 10–11.5 px text and 70 hardcoded `rgba`/hex colours in component styles. Several are dark shadows such as `rgba(0,0,0,0.4)` that ignore the light theme, and several are purple accents outside the token palette.

**Fix:** Run axe in CI on `/markets/:id`, `/portfolio`, and an open dialog. Move colours to tokens. Raise the minimum text size to 12 px.

### U-6 · Low · Smaller UX items

- **Misleading "live" labels.** The catalog has a pulsing "LIVE PREDICTION EXCHANGE" badge but is a static snapshot. The portfolio subtitle says "Real-time mark-to-market" but never updates.
- **Every load error reads "Market Not Found".** A network error on the market page shows that message with no retry ([market-detail.component.ts:60-65](frontend/src/app/features/market/market-detail.component.ts#L60-L65)).
- **Raw share counts.** "Your position" prints `12.34567890 YES shares` without formatting ([market-detail.component.ts:215](frontend/src/app/features/market/market-detail.component.ts#L215)).
- **Unformatted P&L in the cash-out dialog.** "Unrealized P&L Impact" shows a raw 8-decimal value with no `$` and describes the whole position, not the part being sold.
- **Cash Out on closed markets.** The portfolio table offers Cash Out on markets that cannot trade, because `canSell` is not passed. The user only finds out from a quote error.
- **Inconsistent slippage controls.** Buy tolerance is adjustable up to 50% with no warning. Sell tolerance is fixed at 2%. Use one control with a sensible cap.
- **Wrong empty state.** With zero markets, the catalog says "No markets match your filter" and offers Reset Filters.
- **Wrong ARIA role on category filters.** The chips use `role="tab"` with no tab panels. Use a radio group or `aria-pressed` toggle buttons.
- **Incomplete label.** The outcome buttons' label says "at implied probability" but leaves out the number.
- **Claim cooldown is hidden.** It is only learned after a failed click, and the header never shows the balance.
- **Account deletion is hard to find.** It sits inside the Privacy Policy page. Put it in the account dialog.
- **Dev login shows on any localhost.** The dev quick-login button appears whenever the hostname is localhost, including a production-mode local run. It is also used silently as a fallback when Google OAuth fails, which hides real errors.
- **OAuth sign-in loses the user's place.** The callback always navigates to `/`. Store the return URL before redirecting.
- **Ambiguous dates.** Resolution dates show no time or timezone, and the locale is hardcoded to `en-US`. A 23:59 UTC deadline can show as the wrong day.
- **Voided markets are not explained.** They get a red "VOIDED" badge but no banner about refunds, unlike the resolved banner.
- **Font family to verify.** `index.html` loads `family=Scoutie+Sans` from Google Fonts. If that family is not hosted there, the whole `css2` request fails and JetBrains Mono is lost as well. Self-host the fonts or split the request. **(verify)**

---

## 5. Engineering principles (YAGNI, KISS, DRY, SOLID)

### A-1 · KISS · Three concurrency mechanisms where one is enough

Trades use a per-process mutex, `SERIALIZABLE` isolation, `SELECT … FOR UPDATE` row locks, and a retry loop of up to 25 attempts while holding the mutex. Row locks in a fixed order already serialize the writers, and `READ COMMITTED` with `FOR UPDATE` is the standard pattern for this. Serializable mainly adds false conflicts, for example the same user trading two markets at once, which the mutex was then added to suppress.

The mutex registries are also separate per handler: `TradeHandler` and `AdminHandler` each create their own ([trade_handler.go:50](backend/internal/transport/rest/trade_handler.go#L50), [admin_handler.go:86](backend/internal/transport/rest/admin_handler.go#L86)), so they never exclude each other.

**Recommendation:** Use `READ COMMITTED` with ordered `FOR UPDATE`, keep a small retry for deadlocks only, and remove `marketLockRegistry`. Load-test before and after.

### A-2 · DRY · The idempotent-mutation flow is written five times

Place order, cash out, claim, resolve, and void each repeat the same sequence: validate the key, look up the receipt, take the lock, retry, handle replay, map errors, write the receipt. The copies have already drifted:

- Void does not handle `ErrIdempotencyReplay`.
- Resolve validates the key after taking the lock.
- The claim key is optional.
- The receipt `INSERT` exists in four places: `QueueIdempotencyRecord`, `writeIdempotencyReceipt` (unused), and inline in claim, resolve, and void.

**Recommendation:** Write one `runIdempotent[T](c, op, fingerprint, fn)` helper and one receipt writer.

### A-3 · DRY · Duplication inside handlers

- The buy and sell paths in [trade_handler.go](backend/internal/transport/rest/trade_handler.go) are parallel copies: two handlers, two telemetry broadcasters, and two near-identical position `SELECT … FOR UPDATE` helpers.
- The mock Google user block is pasted three times in [auth_handler.go](backend/internal/transport/rest/auth_handler.go), and the audience check runs twice in the verify path.
- `LimitByIP` and `LimitByClientOrUser` differ only in key selection ([rate_limiter.go](backend/internal/middleware/rate_limiter.go)).
- Slug collision is detected by string-matching the error text ([admin_handler.go:660](backend/internal/transport/rest/admin_handler.go#L660)) even though `IsUniqueViolation` exists.
- WebSocket origin checking duplicates the CORS check in the router.

### A-4 · KISS / SOLID · Test and fallback paths inside production code

- `SetupRouter(nil, …)` and `NewAuthHandler(pool, nil)` fall back to ephemeral secrets and `CORS *`. That path exists only for tests.
- `HandlePlaceOrder` switches to a 180-second timeout under `gin.TestMode`.
- `AuthStore` checks `typeof this.apiService.getCurrentUser !== 'function'`, which is a test stub workaround.
- `NewMarketHandler(pool, cacheOpt ...*MarketCache)` uses a variadic argument only to make the cache optional.
- `RequireAdminAuth` reaches into the private fields of `adminFailureLimiter` (`mu`, `disabled`, `getLimiter`).
- The rate limiter runs a global weak-pointer registry and cleaner goroutine for three long-lived limiters.

**Recommendation:** Require configuration, inject dependencies explicitly, and build tests on the same constructors.

### A-5 · SOLID (SRP) · Very large frontend components

`admin-dashboard` (1,202 lines), `order-terminal` (923), `market-detail` (897), `auth-dialog` (779), and `portfolio-view` (702) each mix template, roughly 300–500 lines of inline CSS, and logic. Moving styles to `.css` files and separating presentation from logic would make each one reviewable. The edit and void dialogs in the admin dashboard are natural candidates for their own components.

### A-6 · DRY · Two decimal systems with different rounding

[decimal.ts](frontend/src/app/core/utils/decimal.ts) has an 8-place truncating set (`formatUsd`, `normalizeDecimal`) and an 18-place half-up set (`formatDecimal`, `formatUSDC`). The same balance can display differently in two places: `formatUsd('1.005')` gives `$1.00` and `formatUSDC('1.005')` gives `$1.01`.

**Recommendation:** Keep one parser and one rounding mode for display (truncate for balances), and delete the other functions.

### A-7 · DRY · Auth plumbing on the frontend

- Every `ApiService` method takes a `token` argument.
- Three admin components define the same `getEffectiveToken()` one-line wrapper.
- `isDev` is computed in two places, and is unused in the admin dashboard.
- `crypto.randomUUID()` is used for void keys ([admin-dashboard.component.ts:546](frontend/src/app/features/admin/admin-dashboard.component.ts#L546)) instead of `newIdempotencyKey()`. `randomUUID` throws in insecure contexts (plain HTTP on a LAN IP), which is exactly the case `newIdempotencyKey` was written for.

An interceptor (L-4) removes most of this.

### A-8 · YAGNI · Legacy compatibility for a schema that was just reset

The schema was consolidated into one fresh migration with no production data ([000001_core_schema.up.sql:3](backend/internal/database/migrations/000001_core_schema.up.sql#L3)), yet compatibility code remains:

- Receipts without a fingerprint are replayed "as before", and `request_hash` is nullable ([idempotency.go:596-598](backend/internal/transport/rest/idempotency.go#L596-L598)).
- `yes_probability_after` is nullable "for rows written before this schema" (there are none).
- `AuthStore` migrates `localStorage` to `sessionStorage` and parses "older sessions" display strings.
- The models carry fallback fields: `cash_balance`, `total_portfolio_value`, `market_value`, `unrealized_pnl`.
- `markets.status` allows `draft` and `settled`, which nothing produces.

**Recommendation:** Make these columns `NOT NULL`, tighten the `CHECK` constraint, and remove the fallbacks.

### A-9 · KISS · Schema defaults that bypass the ledger

- `users.cash_balance DEFAULT 1000` would create money with no ledger entry if anything ever inserted a user without `insertSeededUser`.
- `faucet_claims.amount DEFAULT 500` contradicts the 100 USDC the code grants.

**Recommendation:** Drop both defaults so every insert must state the amount.

### A-10 · KISS · Configuration and startup

- `config.Load` logs "Operating in disconnected sandbox mode" when `DATABASE_URL` is empty, and then `main` exits fatally. Fail in `Load` with one message.
- The port default `8080` is set in both [config.go](backend/internal/config/config.go) and [main.go](backend/cmd/api/main.go).
- `NewPool` hardcodes `MaxConns = 30` and Neon-specific log text. With a separate migration URL there are two pools, so up to 60 connections. Make the size configurable.
- `/metrics` sits behind admin JWT auth, which Prometheus cannot use, and it reports a constant `bayesmarket_up 1`. Either protect it with a scrape token or network policy, or remove it.

---

## 6. Deletion candidates

I have not deleted anything. Each item below was checked with a reference search across production code. "Tests only" means the only remaining caller is a test, which should be removed with it.

### Files

| File | Reason |
|---|---|
| [frontend/test-results/.last-run.json](frontend/test-results/.last-run.json) | Playwright run artifact. Delete it and add `test-results/` and `playwright-report/` to `.gitignore`. |
| [markets-seed.txt](markets-seed.txt) | Text dump of 16 markets that nothing reads, kept at the repository root. Either turn it into a real seed command (for example `api -seed` reading JSON) or move it to `docs/`. The README's "pre-calibrated prediction markets" promise depends on this decision. |
| [frontend/pnpm-workspace.yaml](frontend/pnpm-workspace.yaml) and one of the two `pnpm-lock.yaml` files | Two workspaces and two lockfiles for one package. The former Docker build used the `frontend/` copies; the root copies duplicate `allowBuilds`. Keep one source of truth. **(verify against the Vercel build before deleting)** |

### Backend symbols

| Symbol | Location | Status |
|---|---|---|
| `User`, `Market`, `LiquidityPool`, `UserPosition`, `Trade`, `LedgerEntry` structs; `Outcome`, `TradeType` | [models.go](backend/internal/models/models.go) | Unused. `LedgerEntry` does not even match the table. Keep only `MarketStatus`. |
| `InternalPrecision`; the spot-price sum check and `ErrSpotPriceSumViolation` | [cpmm.go](backend/internal/amm/cpmm.go) | Unused, or a check that cannot fail: two 28-digit quotients of the same sum |
| `CtxUserEmailKey`, `CtxUserNameKey`, `CtxUserAvatarKey`, `CtxAuthProviderKey`, `GetIsGuest`, `GetIsAdmin`, `GetClaims` | [auth.go](backend/internal/middleware/auth.go) | Unused |
| `RateLimiter.Stop` and the weak-pointer registry | [rate_limiter.go](backend/internal/middleware/rate_limiter.go) | Unused in production (see A-4) |
| `GuestAuthResponse` | [auth_handler.go:120](backend/internal/transport/rest/auth_handler.go#L120) | "Backwards compatibility" alias with no users |
| `GoogleTokenInfo.Error` | [auth_handler.go](backend/internal/transport/rest/auth_handler.go) | Unused field |
| `ParseOptionalBoundedPositiveDecimal` | [validation.go](backend/internal/transport/rest/validation.go) | Tests only |
| `writeIdempotencyReceipt` | [idempotency.go](backend/internal/transport/rest/idempotency.go) | Unused |
| `MarketHandler.Cache()` | [market_handler.go](backend/internal/transport/rest/market_handler.go) | Unused |
| Redundant exact-match cases in `isSensitiveParam` | [router.go](backend/internal/transport/rest/router.go) | Already covered by the `Contains` checks below them |
| `MessageTypePing`, `MessageTypePong`, `MarketDeletedMessage`, `BroadcastMarketDeleted` | [messages.go](backend/internal/transport/ws/messages.go), [hub.go](backend/internal/transport/ws/hub.go) | Unused |
| `Hub.ClientCount`, `Hub.MarketClientCount` | [hub.go](backend/internal/transport/ws/hub.go) | Tests only |
| Global stream `/ws/markets` and the `globalClients` index | [router.go:197](backend/internal/transport/rest/router.go#L197), [hub.go](backend/internal/transport/ws/hub.go) | The frontend never connects to it. Remove it, or use it for live catalog prices (U-6). Today `MARKET_UPDATED` is also sent twice to market subscribers through it. |

### Frontend symbols

| Symbol | Location | Status |
|---|---|---|
| `deleteMarket`, `DeleteMarketResponse`, the admin Delete button | api.service.ts, market.model.ts, admin-dashboard | Calls a missing endpoint (L-7) |
| `verifyAdmin` | [api.service.ts:241](frontend/src/app/core/services/api.service.ts#L241) | Unused |
| `MarketDeletedEvent`, `lastMarketDeleted`, and its effect in market-detail | websocket.model.ts, websocket.service.ts | The server never sends this frame |
| `setPaused` | websocket.service.ts | Tests only |
| `provisionNewGuestSession`, `formatBalance`, `refreshBalance` | [auth.store.ts](frontend/src/app/state/auth.store.ts) | Unused |
| `localStorage`-to-`sessionStorage` migration and display-string balance parsing | auth.store.ts | Legacy (A-8) |
| Fallback model fields (`cash_balance`, `total_portfolio_value`, `market_value`, `unrealized_pnl`) | [market.model.ts](frontend/src/app/core/models/market.model.ts) | The API never sends them |
| `isDev` | [admin-dashboard.component.ts:383](frontend/src/app/features/admin/admin-dashboard.component.ts#L383) | Unused |
| `.input-label`, `.input-wrapper`, `.amount-field` styles | [order-terminal.component.ts](frontend/src/app/features/terminal/order-terminal.component.ts) | Dead CSS; the markup now uses `app-input` |
| Empty `{ … }` blocks | [price-chart.component.ts](frontend/src/app/features/charts/price-chart.component.ts) | Left over from removed `runOutsideAngular` wrappers |
| Toast timer and pause/resume machinery | toast.service.ts | Dead while every toast uses `duration: 0`. Keep it if U-3 adds auto-dismiss. |

---

## 7. Documentation drift

`AGENTs.md` says the `target/` documents are the source of truth. They currently contradict the code:

| Document | Says | Code does |
|---|---|---|
| ARCHITECTURE.md:633, 745 | Claims grant 500 USDC | 100 USDC ([claim_handler.go:336](backend/internal/transport/rest/claim_handler.go#L336)) |
| ARCHITECTURE.md:1137 | `DELETE /admin/markets/:id` with `409 market_has_activity` | Not implemented |
| ARCHITECTURE.md:1151 | The first visit issues a guest JWT automatically | Guest sessions are created only on click (`auth.store.ts:141`) |
| AGENTs.md:82 | `Idempotency-Key` is required on claims | Optional |
| AGENTs.md:110-112 | Focus colour `#e84089`, border `#606e85` | DESIGN.md:391 and 411 retire both; tokens use `#3730a3` and `#64748b` |
| README.md:139 | Signal stores for Guest, Market, and Portfolio | Only `auth.store.ts` exists |
| README.md:128 | `database/` holds seed data | No seed code exists |
| .env.example:15 | The privileged pool is used for "market deletes" | No market delete exists |

---

## 8. Infrastructure and CI

- **No end-to-end tests in CI.** CI never runs the Playwright tests, so the accessibility check does not gate merges.
- **No database tests locally.** Locally, 34 database-backed tests skip without Postgres, and `-race` needs CGO ([target/walkthrough.md](target/walkthrough.md)). Add a `make test-db` target that starts the Compose Postgres. The root `test:backend` script also omits `-race`.
- **Production build memory.** The production frontend build needed an 8 GB heap ([target/walkthrough.md](target/walkthrough.md)), but the `build` script sets 4 GB. Investigate what is driving memory (likely the large inline-style components) instead of raising the limit.
- **Hardcoded backend URL.** [vercel.json](frontend/vercel.json) hardcodes the Render URL. Note it in the README so forks know to change it.
- **Frontend API URL on localhost.** `ApiService` and `WebSocketService` always use `:8080` on localhost, which bypasses the Vercel rewrite that production uses, so local development differs from production. Prefer relative `/api` and `/ws` URLs everywhere, with a dev-server proxy config.
- **Hardcoded database name.** [setup_least_privilege_user.sql](backend/scripts/setup_least_privilege_user.sql) hardcodes the database name `bayesmarket` and Neon-specific instructions. Use `:DBNAME` and keep it vendor-neutral.

---

## 9. What is solid (keep as is)

- The AMM rounding policy: the deposit is truncated, reserves round up, and the sell payout is truncated before reserves are derived, so `k` never decreases and no value drifts. A pure `math/big` square root with Newton refinement.
- `buildLedgerInsert` refuses unbalanced or over-precise postings, and set-based settlement is checked with `assertTransactionBalanced`.
- Idempotency receipts are bound to a SHA-256 request fingerprint.
- Admin authority is checked against the database on every request, and the token's admin claim is ignored.
- Refresh tokens are stored hashed, rotated, detect reuse, and use a scoped `HttpOnly` cookie with `SameSite=Lax`.
- OAuth state is HMAC-signed and bound to a cookie. Google ID tokens are verified against JWKS with checks on `iss`, `aud`, and `email_verified`.
- Error responses do not leak details, and query logs redact secrets.
- On the frontend, money uses `BigInt` decimals, outcomes are dual-coded with glyphs, dialogs trap focus, and chart data has a screen-reader table.

---

## 10. Suggested order of work

1. **Deployment correctness.** S-1, S-2. Small change, largest user impact.
2. **Trading page flow.** L-1, L-2, U-2, then L-4 with an interceptor, then L-3.
3. **Data integrity and audit.** L-5, S-3, A-9, L-6.
4. **Cleanup.** Delete the items in section 6, then A-2 and A-1 behind a load test.
5. **Accessibility and UX.** U-1, U-3, U-4, U-5, then the U-6 list.
6. **Documentation.** Reconcile section 7 in the same commits as the code changes, as `AGENTs.md` requires.
