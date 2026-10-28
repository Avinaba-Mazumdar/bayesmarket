import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthStore } from '../../state/auth.store';

/**
 * Renews an expired access token once and retries the request. The session lives on in the refresh cookie,
 * so a 401 on a signed-in call means the one-hour token expired, not that the reader signed out.
 *
 * Auth endpoints are excluded, so a failed renewal cannot start another renewal. Mutations keep their
 * Idempotency-Key, so the retry replays a receipt rather than placing the order twice.
 */
export const authRenewalInterceptor: HttpInterceptorFn = (req, next) => {
    // AuthStore depends on ApiService, which depends on HttpClient, so it is resolved lazily to avoid a cycle.
    const injector = inject(Injector);

    return next(req).pipe(
        catchError((error: unknown) => {
            const renewable = error instanceof HttpErrorResponse && error.status === 401 && req.headers.has('Authorization') && !req.url.includes('/auth/');
            if (!renewable) {
                return throwError(() => error);
            }

            return from(injector.get(AuthStore).renewAccessToken()).pipe(
                // A failed renewal reports the original 401. Keeping this catch ahead of the retry means an error
                // from the retried request is reported as it is, not swallowed into the 401.
                catchError(() => throwError(() => error)),
                switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })))
            );
        })
    );
};
