import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize, retry, throwError, timer } from 'rxjs';
import { ServerWakeService } from '../services/server-wake.service';

/** Marks a request that wakes the server in the background: no banner and no retries. */
export const QUIET_WAKE = new HttpContextToken<boolean>(() => false);

/** A request still pending after this long shows the waking banner. */
export const SLOW_AFTER_MS = 3000;
/** Retries stop once this much time has passed since the first attempt. Render's free tier wakes within about a minute. */
export const RETRY_WINDOW_MS = 90_000;
const MAX_RETRY_DELAY_MS = 5000;

/**
 * Carries API calls through a backend cold start. While the server wakes, a request either waits (the platform
 * holds it) or fails with a gateway error or the server's own 503 warming_up. This retries the failures that are
 * safe to send again, and reports slow requests so the shell can show the waking banner.
 */
export const coldStartInterceptor: HttpInterceptorFn = (req, next) => {
    if (!req.url.includes('/api/v1/') || req.context.get(QUIET_WAKE)) {
        return next(req);
    }
    const wake = inject(ServerWakeService);

    return defer(() => {
        const startedAt = Date.now();
        let slow = false;
        const slowTimer = setTimeout(() => {
            slow = true;
            wake.markSlow();
        }, SLOW_AFTER_MS);

        return next(req).pipe(
            retry({
                delay: (error: unknown, retryCount: number) => {
                    if (!isColdStartRetryable(req, error) || Date.now() - startedAt > RETRY_WINDOW_MS) {
                        return throwError(() => error);
                    }
                    return timer(coldStartRetryDelayMs(error as HttpErrorResponse, retryCount));
                }
            }),
            finalize(() => {
                clearTimeout(slowTimer);
                if (slow) {
                    wake.clearSlow();
                }
            })
        );
    });
};

/**
 * The server's warming_up 503 is answered before any handler runs, so every method may be sent again.
 * A network failure or gateway error may have reached the handler, so only requests that cannot apply twice
 * are resent: reads, and mutations that carry an Idempotency-Key. Any other error the API itself returns is final.
 */
export function isColdStartRetryable(req: HttpRequest<unknown>, error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
        return false;
    }
    const code = apiErrorCode(error);
    if (code === 'warming_up') {
        return true;
    }
    if (code !== undefined) {
        return false;
    }
    if (error.status !== 0 && error.status !== 502 && error.status !== 503 && error.status !== 504) {
        return false;
    }
    return req.method === 'GET' || req.method === 'HEAD' || req.headers.has('Idempotency-Key');
}

/** Honours Retry-After when the server sends it; otherwise backs off 1s, 2s, 4s, then every 5s. */
export function coldStartRetryDelayMs(error: HttpErrorResponse, retryCount: number): number {
    const retryAfter = Number(error.headers?.get('Retry-After'));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
        return Math.min(retryAfter * 1000, MAX_RETRY_DELAY_MS);
    }
    return Math.min(1000 * 2 ** (retryCount - 1), MAX_RETRY_DELAY_MS);
}

function apiErrorCode(error: HttpErrorResponse): string | undefined {
    const body: unknown = error.error;
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
        return (body as { error: string }).error;
    }
    return undefined;
}
