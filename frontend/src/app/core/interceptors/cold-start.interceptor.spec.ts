import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { coldStartInterceptor, QUIET_WAKE, RETRY_WINDOW_MS, SLOW_AFTER_MS } from './cold-start.interceptor';
import { ServerWakeService } from '../services/server-wake.service';

describe('coldStartInterceptor', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let wake: ServerWakeService;

    beforeEach(() => {
        vi.useFakeTimers();
        TestBed.configureTestingModule({
            providers: [provideHttpClient(withInterceptors([coldStartInterceptor])), provideHttpClientTesting()]
        });
        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
        wake = TestBed.inject(ServerWakeService);
    });

    afterEach(() => {
        httpMock.verify();
        vi.useRealTimers();
    });

    const warmingUp = { status: 503, statusText: 'Service Unavailable', headers: { 'Retry-After': '2' } };

    it('retries after the server warming_up 503, waiting for Retry-After', () => {
        let body: unknown;
        http.get('/api/v1/markets').subscribe((b) => (body = b));

        httpMock.expectOne('/api/v1/markets').flush({ error: 'warming_up' }, warmingUp);
        vi.advanceTimersByTime(1999);
        httpMock.expectNone('/api/v1/markets');
        vi.advanceTimersByTime(1);

        httpMock.expectOne('/api/v1/markets').flush([{ id: 'm1' }]);
        expect(body).toEqual([{ id: 'm1' }]);
    });

    it('resends any method after warming_up, because the handler never ran', () => {
        let body: unknown;
        http.post('/api/v1/auth/guest', {}).subscribe((b) => (body = b));

        httpMock.expectOne('/api/v1/auth/guest').flush({ error: 'warming_up' }, warmingUp);
        vi.advanceTimersByTime(2000);
        httpMock.expectOne('/api/v1/auth/guest').flush({ token: 't' });
        expect(body).toEqual({ token: 't' });
    });

    it('does not resend a mutation without an Idempotency-Key after a gateway error', () => {
        let error: { status?: number } | undefined;
        http.post('/api/v1/auth/guest', {}).subscribe({ error: (e) => (error = e) });

        httpMock.expectOne('/api/v1/auth/guest').flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
        vi.advanceTimersByTime(10_000);
        httpMock.expectNone('/api/v1/auth/guest');
        expect(error?.status).toBe(502);
    });

    it('resends a mutation that carries an Idempotency-Key after a gateway error', () => {
        let body: unknown;
        http.post('/api/v1/claim', {}, { headers: { 'Idempotency-Key': 'claim-1' } }).subscribe((b) => (body = b));

        httpMock.expectOne('/api/v1/claim').flush('Gateway Timeout', { status: 504, statusText: 'Gateway Timeout' });
        vi.advanceTimersByTime(1000);
        httpMock.expectOne('/api/v1/claim').flush({ ok: true });
        expect(body).toEqual({ ok: true });
    });

    it('treats any other API error code as final', () => {
        let error: { status?: number } | undefined;
        http.get('/api/v1/auth/google/url').subscribe({ error: (e) => (error = e) });

        httpMock.expectOne('/api/v1/auth/google/url').flush({ error: 'oauth_not_configured' }, { status: 503, statusText: 'Service Unavailable' });
        vi.advanceTimersByTime(10_000);
        httpMock.expectNone('/api/v1/auth/google/url');
        expect(error?.status).toBe(503);
    });

    it('stops retrying once the retry window has passed', () => {
        let error: { status?: number } | undefined;
        http.get('/api/v1/markets').subscribe({ error: (e) => (error = e) });

        httpMock.expectOne('/api/v1/markets').flush('', { status: 504, statusText: 'Gateway Timeout' });
        vi.advanceTimersByTime(RETRY_WINDOW_MS + 1);
        // The pending retry was sent inside the window; it fails after the window, so nothing follows it.
        const pending = httpMock.match('/api/v1/markets');
        pending.forEach((req) => req.flush('', { status: 504, statusText: 'Gateway Timeout' }));
        vi.advanceTimersByTime(10_000);
        httpMock.expectNone('/api/v1/markets');
        expect(error?.status).toBe(504);
    });

    it('reports a slow request as waking and clears it when the request settles', () => {
        http.get('/api/v1/markets').subscribe();
        const req = httpMock.expectOne('/api/v1/markets');

        vi.advanceTimersByTime(SLOW_AFTER_MS - 1);
        expect(wake.waking()).toBe(false);
        vi.advanceTimersByTime(1);
        expect(wake.waking()).toBe(true);

        req.flush([]);
        expect(wake.waking()).toBe(false);
    });

    it('leaves quiet wake requests alone: no retry and no banner', () => {
        let error: { status?: number } | undefined;
        http.get('/api/v1/categories', { context: new HttpContext().set(QUIET_WAKE, true) }).subscribe({ error: (e) => (error = e) });
        const req = httpMock.expectOne('/api/v1/categories');

        vi.advanceTimersByTime(SLOW_AFTER_MS);
        expect(wake.waking()).toBe(false);
        req.flush({ error: 'warming_up' }, warmingUp);
        vi.advanceTimersByTime(10_000);
        httpMock.expectNone('/api/v1/categories');
        expect(error?.status).toBe(503);
    });
});
