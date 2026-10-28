import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PortfolioViewComponent } from './portfolio-view.component';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { PortfolioResponse } from '../../core/models/market.model';

describe('PortfolioViewComponent', () => {
    let fixture: ComponentFixture<PortfolioViewComponent>;
    let component: PortfolioViewComponent;
    let apiServiceSpy: {
        getPortfolio: any;
        createGuestSession: any;
        cashOut: any;
        getSellQuote: any;
        refreshSession: any;
        endSession: any;
        getMarketCategories: any;
        getMarketTrades: any;
        getMarketHistory: any;
    };
    let authStore: AuthStore;

    const mockPortfolioResponse: PortfolioResponse = {
        cash_balance: '1250.00',
        total_portfolio_value: '1350.00',
        total_portfolio_value_usdc: '1350.00',
        total_unrealized_pnl_usdc: '25.00',
        total_unrealized_pnl_pct: '25.00',
        positions: [
            {
                market_id: 'market-111',
                market_title: 'Will AI pass the Turing test in 2026?',
                outcome: 'YES',
                shares_owned: '150.00',
                avg_buy_price: '0.5000',
                current_price: '0.6667',
                market_value: '100.00',
                unrealized_pnl_usdc: '25.00',
                unrealized_pnl_pct: '33.33'
            }
        ]
    };

    beforeEach(async () => {
        apiServiceSpy = {
            refreshSession: vi.fn().mockReturnValue(throwError(() => ({ status: 401 }))),
            endSession: vi.fn().mockReturnValue(of(undefined)),
            getMarketCategories: vi.fn().mockReturnValue(of([])),
            getMarketTrades: vi.fn().mockReturnValue(of([])),
            getMarketHistory: vi.fn().mockReturnValue(of({ market_id: '', range: '24h', points: [] })),
            getPortfolio: vi.fn().mockReturnValue(of(mockPortfolioResponse)),
            createGuestSession: vi.fn().mockReturnValue(of({ token: 'test-token', user: { id: 'u-1', cash_balance: '1250' } })),
            cashOut: vi.fn(),
            getSellQuote: vi.fn().mockReturnValue(of({ action: 'SELL', payout_usdc: '50.00000000', price_impact_pct: '-1.00000000' }))
        };

        await TestBed.configureTestingModule({
            imports: [PortfolioViewComponent],
            providers: [provideRouter([]), { provide: ApiService, useValue: apiServiceSpy }, AuthStore, ToastService]
        }).compileComponents();

        fixture = TestBed.createComponent(PortfolioViewComponent);
        component = fixture.componentInstance;
        authStore = TestBed.inject(AuthStore);

        authStore.token.set('test-auth-token');
        authStore.userId.set('user-123');
        authStore.user.set({ id: 'user-123', is_guest: true, auth_provider: 'guest', cash_balance: '1250.00', created_at: '2026-01-01T00:00:00Z' } as any);
        authStore.updateBalance('1250.00');

        fixture.detectChanges();
    });

    it('should render 4 summary metrics accurately', () => {
        const el = fixture.nativeElement as HTMLElement;
        const metricValues = el.querySelectorAll('.metric-value');
        expect(metricValues.length).toBe(4);

        // Total Portfolio Value
        expect(metricValues[0].textContent?.trim()).toBe('$1,350.00');
        // Cash Balance
        expect(metricValues[1].textContent?.trim()).toBe('$1,250.00');
        // Active Positions
        expect(metricValues[2].textContent?.trim()).toBe('1');
        // Unrealized PnL
        expect(metricValues[3].textContent?.trim()).toContain('+$25.00');
    });

    it('should render positions table with position details and Cash Out action button', () => {
        const el = fixture.nativeElement as HTMLElement;
        const rows = el.querySelectorAll('.positions-table tbody tr');
        expect(rows.length).toBe(1);

        const row = rows[0];
        expect(row.querySelector('.market-title-text')?.textContent?.trim()).toContain('Will AI pass the Turing test in 2026?');
        expect(row.querySelector('.num-highlight')?.textContent?.trim()).toBe('150.00');
        expect(row.querySelector('.td-action button')?.textContent?.trim()).toBe('Cash Out');
    });

    it('should open Cash Out dialog when Cash Out button is clicked', () => {
        const el = fixture.nativeElement as HTMLElement;
        const cashoutBtn = el.querySelector('.td-action button') as HTMLButtonElement;
        expect(cashoutBtn).toBeTruthy();

        cashoutBtn.click();
        fixture.detectChanges();

        expect(component.selectedPosition()).toEqual(expect.objectContaining(mockPortfolioResponse.positions[0]));
        expect(component.isCashOutModalOpen()).toBe(true);
    });

    it('should show empty state when there are no active positions', () => {
        component.portfolio.set({
            cash_balance: '1000.00',
            total_portfolio_value: '1000.00',
            positions: []
        });
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.empty-positions-box')).toBeTruthy();
        expect(el.querySelector('.empty-positions-box h3')?.textContent?.trim()).toBe('No Open Positions');
    });

    it('should ask for sign-in instead of showing zero metrics when signed out', () => {
        authStore.token.set(null);
        authStore.user.set(null);
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.signin-prompt')).toBeTruthy();
        expect(el.querySelector('.metrics-grid')).toBeNull();
    });
});
