import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { App } from './app.component';
import { ApiService } from './core/services/api.service';
import { ToastService } from './shared/components/toast/toast.service';

describe('App', () => {
    beforeEach(async () => {
        const apiServiceSpy = {
            refreshSession: vi.fn().mockReturnValue(throwError(() => ({ status: 401 }))),
            endSession: vi.fn().mockReturnValue(of(undefined)),
            getMarketCategories: vi.fn().mockReturnValue(of([])),
            getMarketTrades: vi.fn().mockReturnValue(of([])),
            getMarketHistory: vi.fn().mockReturnValue(of({ market_id: '', range: '24h', points: [] })),
            createGuestSession: vi.fn().mockReturnValue(of({ token: 't', user: { id: '1', cash_balance: '1000' } })),
            getCurrentUser: vi.fn().mockReturnValue(of({ id: '1', cash_balance: '1000' })),
            getGoogleAuthUrl: vi.fn().mockReturnValue(of({ url: '', simulated: true }))
        };

        await TestBed.configureTestingModule({
            imports: [App],
            providers: [provideRouter([]), { provide: ApiService, useValue: apiServiceSpy }, ToastService]
        }).compileComponents();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it('should render main router container', async () => {
        const fixture = TestBed.createComponent(App);
        await fixture.whenStable();
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.querySelector('main#app-main-content')).toBeTruthy();
    });
});
