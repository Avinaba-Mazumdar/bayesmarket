import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authRenewalInterceptor } from './auth-renewal.interceptor';
import { AuthStore } from '../../state/auth.store';

describe('authRenewalInterceptor', () => {
    let http: HttpClient;
    let httpMock: HttpTestingController;
    let renewAccessToken: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        renewAccessToken = vi.fn();
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptors([authRenewalInterceptor])),
                provideHttpClientTesting(),
                { provide: AuthStore, useValue: { renewAccessToken } }
            ]
        });
        http = TestBed.inject(HttpClient);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpMock.verify());

    it('renews an expired token once and retries with the new token', async () => {
        renewAccessToken.mockResolvedValue('fresh-token');
        let body: unknown;

        http.get('/api/v1/portfolio', { headers: { Authorization: 'Bearer old-token' } }).subscribe((b) => (body = b));
        httpMock.expectOne('/api/v1/portfolio').flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

        const retry = await vi.waitUntil(() => httpMock.match('/api/v1/portfolio')[0] ?? null);
        expect(renewAccessToken).toHaveBeenCalledTimes(1);
        expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
        retry.flush({ ok: true });
        expect(body).toEqual({ ok: true });
    });

    it('reports an error from the retried request as it is, not as the original 401', async () => {
        renewAccessToken.mockResolvedValue('fresh-token');
        let error: { status?: number } | undefined;

        http.get('/api/v1/portfolio', { headers: { Authorization: 'Bearer old-token' } }).subscribe({ error: (e) => (error = e) });
        httpMock.expectOne('/api/v1/portfolio').flush({}, { status: 401, statusText: 'Unauthorized' });

        const retry = await vi.waitUntil(() => httpMock.match('/api/v1/portfolio')[0] ?? null);
        retry.flush({ message: 'conflict' }, { status: 409, statusText: 'Conflict' });
        expect(error?.status).toBe(409);
    });

    it('reports the original 401 when the renewal fails', async () => {
        renewAccessToken.mockRejectedValue(new Error('refresh cookie revoked'));
        let error: { status?: number } | undefined;

        http.get('/api/v1/portfolio', { headers: { Authorization: 'Bearer old-token' } }).subscribe({ error: (e) => (error = e) });
        httpMock.expectOne('/api/v1/portfolio').flush({}, { status: 401, statusText: 'Unauthorized' });

        await vi.waitUntil(() => error !== undefined);
        expect(error?.status).toBe(401);
        expect(httpMock.match(() => true)).toHaveLength(0);
    });

    it('never renews on auth endpoints, so a failed renewal cannot start another one', () => {
        let error: { status?: number } | undefined;

        http.post('/api/v1/auth/refresh', {}, { headers: { Authorization: 'Bearer old-token' } }).subscribe({ error: (e) => (error = e) });
        httpMock.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

        expect(renewAccessToken).not.toHaveBeenCalled();
        expect(error?.status).toBe(401);
    });

    it('does not renew requests that carry no session', () => {
        let error: { status?: number } | undefined;

        http.get('/api/v1/markets').subscribe({ error: (e) => (error = e) });
        httpMock.expectOne('/api/v1/markets').flush({}, { status: 401, statusText: 'Unauthorized' });

        expect(renewAccessToken).not.toHaveBeenCalled();
        expect(error?.status).toBe(401);
    });
});
