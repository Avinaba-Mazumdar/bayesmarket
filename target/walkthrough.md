# Verification walkthrough

Recorded 2026-10-28 from commands run on this machine. A step is listed only when it was run.

## Backend

From `backend/`:

- `gofmt -l .` printed nothing.
- `go vet ./...` exited 0.
- `go build ./...` exited 0.
- `go test -count=1 ./...` exited 0 after the module path change. Packages: `amm`, `config`, `database`, `middleware`, `models`, `transport/rest`, `transport/ws`.

A verbose run of `go test -count=1 -v ./internal/database/ ./internal/transport/rest/ ./internal/models/` skipped 34 tests because no local database was configured. `TestSeedMarkets_Verification` was one of them. That test required the deleted seeder, so it was removed. The following `go test -count=1 ./...` exited 0.

Not run:

- Database-backed tests. Nothing was listening on `127.0.0.1:5432`. The Docker daemon was not running (`docker version` could not open the pipe).
- `go test -race`. `go env CGO_ENABLED` was `0` and `gcc` was not on `PATH`. CI still runs `-race` against Postgres 18.

The Go module path is `github.com/Avinaba-Mazumdar/bayesmarket`.

## Frontend

From `frontend/`, with `NODE_OPTIONS=--max-old-space-size=4096` for tests:

- `pnpm test:ci` (`ng test --watch=false`): 32 files, 182 tests, all passed (8.59s).
- `eslint src --max-warnings 0` exited 0.
- `node --max-old-space-size=8192 ./node_modules/@angular/cli/bin/ng.js build` (production) exited 0 in 18.7s.
- A production build attempted with a 4096 MB heap ran out of memory. The successful production build used 8192 MB.
- `node --max-old-space-size=8192 ./node_modules/@angular/cli/bin/ng.js build --configuration development` exited 0. The earlier NG8107 warning on `m.reserves?.total_volume_usdc` is gone.

`npx pnpm@11.24.0 install --frozen-lockfile` at the repo root exited 0. A copy of `frontend/package.json`, `frontend/pnpm-lock.yaml`, and `frontend/pnpm-workspace.yaml` also installed with `--frozen-lockfile` (the Docker context).

## Not verified here

- No browser tools were available, so the privacy deletion control, toasts, admin form, chart empty state, and order ticket were not clicked through.
- The owner's `.env` was not edited. `APP_ENV=local` still refuses a hosted `DATABASE_URL`. Point that file at local Postgres, or set `APP_ENV=production`, outside this change.
- `report.md` was left as the historical audit.
