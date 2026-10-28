import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OrderIntent, OrderTerminalComponent } from './order-terminal.component';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { BuyQuoteResponse, Market } from '../../core/models/market.model';

describe('OrderTerminalComponent', () => {
    let fixture: ComponentFixture<OrderTerminalComponent>;
    let component: OrderTerminalComponent;
    let apiServiceSpy: {
        createGuestSession: any;
        getPortfolio: any;
        getQuote: any;
        refreshSession: any;
        endSession: any;
        getMarketCategories: any;
        getMarketTrades: any;
        getMarketHistory: any;
    };
    let authStore: AuthStore;

    const mockMarket: Market = {
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'btc-100k',
        title: 'Will BTC exceed $100k by year-end?',
        description: 'Settles YES if Bitcoin trades above $100,000.',
        category: 'crypto',
        resolution_source: 'Coinbase Pro index',
        resolution_date: '2026-12-31T23:59:59Z',
        status: 'active',
        probability_yes: '0.6500',
        probability_no: '0.3500',
        probability_yes_pct: '65.0',
        probability_no_pct: '35.0',
        reserves: {
            reserve_yes: '35000.00',
            reserve_no: '65000.00',
            collateral_reserve: '100000.00',
            total_volume_usdc: '50000.00'
        },
        created_at: '2026-01-01T00:00:00Z'
    };

    const mockQuote: BuyQuoteResponse = {
        market_id: '11111111-1111-1111-1111-111111111111',
        action: 'BUY',
        outcome: 'YES',
        deposit_usdc: '50.00',
        shares_received: '76.92',
        avg_price: '0.6500',
        initial_price: '0.6500',
        new_price: '0.6540',
        price_impact_pct: '0.45',
        new_reserve_yes: '35050.00',
        new_reserve_no: '64950.00',
        new_collateral: '100050.00'
    };

    beforeEach(async () => {
        vi.useFakeTimers();
        apiServiceSpy = {
            refreshSession: vi.fn().mockReturnValue(throwError(() => ({ status: 401 }))),
            endSession: vi.fn().mockReturnValue(of(undefined)),
            getMarketCategories: vi.fn().mockReturnValue(of([])),
            getMarketTrades: vi.fn().mockReturnValue(of([])),
            getMarketHistory: vi.fn().mockReturnValue(of({ market_id: '', range: '24h', points: [] })),
            createGuestSession: vi.fn().mockReturnValue(
                of({
                    token: 'test-token',
                    user: { id: 'u1', cash_balance: '500.00', is_guest: true, created_at: '2026-01-01T00:00:00Z' }
                })
            ),
            getPortfolio: vi.fn().mockReturnValue(
                of({
                    cash_balance: '500.00',
                    total_portfolio_value: '500.00',
                    positions: []
                })
            ),
            getQuote: vi.fn().mockReturnValue(of(mockQuote))
        };

        await TestBed.configureTestingModule({
            imports: [OrderTerminalComponent],
            providers: [{ provide: ApiService, useValue: apiServiceSpy }, AuthStore]
        }).compileComponents();

        fixture = TestBed.createComponent(OrderTerminalComponent);
        component = fixture.componentInstance;
        authStore = TestBed.inject(AuthStore);

        authStore.token.set('test-token');
        authStore.user.set({ id: 'u1', cash_balance: '500.00', is_guest: true, auth_provider: 'guest', created_at: '2026-01-01T00:00:00Z' });
        authStore.userId.set('u1');
        authStore.updateBalance('500.00');

        fixture.componentRef.setInput('market', mockMarket);
        fixture.detectChanges();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should initialize with default amount and outcome YES', () => {
        expect(component.selectedOutcome()).toBe('YES');
        expect(component.amountInput()).toBe('50');
    });

    it('should toggle outcome to NO when selected', () => {
        component.setOutcome('NO');
        fixture.detectChanges();
        expect(component.selectedOutcome()).toBe('NO');
    });

    it('should update amount using quick-fill chips (+10, +50, +100, Max, Clear)', () => {
        component.addAmount(10);
        expect(component.amountInput()).toBe('60');

        component.addAmount(50);
        expect(component.amountInput()).toBe('110');

        component.clearAmount();
        expect(component.amountInput()).toBe('0');

        component.onSetMax();
        expect(component.amountInput()).toBe('500.00');
    });

    it('should validate against overdrafting user cash balance', () => {
        component.onAmountChange('600');
        fixture.detectChanges();

        expect(component['validationError']()).toContain('Amount exceeds available cash balance');
        expect(component['isTradeDisabled']()).toBe(true);
    });

    it('should validate positive non-zero amounts', () => {
        component.onAmountChange('0');
        fixture.detectChanges();

        expect(component['validationError']()).toBe('Enter a valid positive USDC amount');
        expect(component['isTradeDisabled']()).toBe(true);
    });

    it('should determine correct slippage tier badge variant based on price impact', () => {
        component.latestQuote.set({ ...mockQuote, price_impact_pct: '0.50' });
        expect(component['slippageBadgeVariant']()).toBe('profit');
        expect(component['slippageBadgeLabel']()).toBe('Minimal');

        component.latestQuote.set({ ...mockQuote, price_impact_pct: '2.00' });
        expect(component['slippageBadgeVariant']()).toBe('warning');
        expect(component['slippageBadgeLabel']()).toBe('Moderate');

        component.latestQuote.set({ ...mockQuote, price_impact_pct: '4.50' });
        expect(component['slippageBadgeVariant']()).toBe('destructive');
        expect(component['slippageBadgeLabel']()).toBe('High Impact');
    });

    it('should emit orderReviewRequested with populated OrderIntent', () => {
        component.latestQuote.set(mockQuote);
        component.isLoadingQuote.set(false);
        component.amountInput.set('50');

        let emittedIntent: OrderIntent | undefined;
        component.orderReviewRequested.subscribe((intent) => {
            emittedIntent = intent;
        });

        component.onRequestOrderReview();

        expect(emittedIntent).toBeDefined();
        expect(emittedIntent!.marketId).toBe(mockMarket.id);
        expect(emittedIntent!.outcome).toBe('YES');
        expect(emittedIntent!.amountUSDC).toBe('50.00000000');
        expect(emittedIntent!.postTradeBalance).toBe('$450.00');
    });

    it('should focus the amount input field when focusAmountInput() is called', () => {
        const inputEl = fixture.nativeElement.querySelector('#terminal-amount-input') as HTMLInputElement;
        const focusSpy = vi.spyOn(inputEl, 'focus');

        component.focusAmountInput();
        expect(focusSpy).toHaveBeenCalled();
    });

    it('should open auth modal when unauthenticated trader attempts to trade', () => {
        authStore.user.set(null);
        authStore.token.set(null);
        fixture.detectChanges();

        expect(component['tradeButtonText']()).toBe('Sign in to Trade');
        component.onRequestOrderReview();
        expect(authStore.isAuthModalOpen()).toBe(true);
    });
});
