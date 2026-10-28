import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CashOutDialogComponent } from './cash-out-dialog.component';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { CashOutResponse, SellQuoteResponse, UserPosition } from '../../core/models/market.model';

describe('CashOutDialogComponent', () => {
    let fixture: ComponentFixture<CashOutDialogComponent>;
    let component: CashOutDialogComponent;
    let apiServiceSpy: {
        cashOut: any;
        getSellQuote: any;
        createGuestSession: any;
        getPortfolio: any;
        refreshSession: any;
        endSession: any;
        getMarketCategories: any;
        getMarketTrades: any;
        getMarketHistory: any;
    };
    let authStore: AuthStore;
    let toastService: ToastService;

    const mockPosition: UserPosition = {
        market_id: '11111111-1111-1111-1111-111111111111',
        market_title: 'Will the Federal Reserve cut rates?',
        outcome: 'YES',
        shares_owned: '100.00',
        avg_buy_price: '0.5000',
        current_price: '0.6500',
        market_value: '65.00',
        unrealized_pnl_usdc: '15.00',
        unrealized_pnl_pct: '30.00'
    };

    const mockCashOutResponse: CashOutResponse = {
        trade_id: 'trade-cashout-999',
        market_id: '11111111-1111-1111-1111-111111111111',
        user_id: 'user-123',
        trade_type: 'SELL',
        outcome: 'YES',
        shares_sold: '100.00',
        payout_usdc: '65.00',
        execution_price: '0.6500',
        price_impact_pct: '0.50',
        new_cash_balance: '1065.00',
        remaining_shares: '0.00',
        created_at: '2026-09-07T14:00:00Z'
    };

    // Large position: the SELL quote pays well below spot x shares (65.00) because of price impact
    const mockSellQuote: SellQuoteResponse = {
        market_id: '11111111-1111-1111-1111-111111111111',
        action: 'SELL',
        outcome: 'YES',
        shares_to_sell: '100.00000000',
        payout_usdc: '61.75000000',
        avg_price: '0.61750000',
        initial_price: '0.65000000',
        new_price: '0.58500000',
        price_impact_pct: '-5.00000000',
        new_reserve_yes: '0',
        new_reserve_no: '0',
        new_collateral: '0'
    };

    beforeEach(async () => {
        apiServiceSpy = {
            refreshSession: vi.fn().mockReturnValue(throwError(() => ({ status: 401 }))),
            endSession: vi.fn().mockReturnValue(of(undefined)),
            getMarketCategories: vi.fn().mockReturnValue(of([])),
            getMarketTrades: vi.fn().mockReturnValue(of([])),
            getMarketHistory: vi.fn().mockReturnValue(of({ market_id: '', range: '24h', points: [] })),
            cashOut: vi.fn().mockReturnValue(of(mockCashOutResponse)),
            getSellQuote: vi.fn().mockReturnValue(of(mockSellQuote)),
            createGuestSession: vi.fn().mockReturnValue(of({ token: 'test-token', user: { id: 'u-1', cash_balance: '1000' } })),
            getPortfolio: vi.fn().mockReturnValue(of({ cash_balance: '1000.00', total_portfolio_value: '1065.00', positions: [mockPosition] }))
        };

        await TestBed.configureTestingModule({
            imports: [CashOutDialogComponent],
            providers: [{ provide: ApiService, useValue: apiServiceSpy }, AuthStore, ToastService]
        }).compileComponents();

        fixture = TestBed.createComponent(CashOutDialogComponent);
        component = fixture.componentInstance;
        authStore = TestBed.inject(AuthStore);
        toastService = TestBed.inject(ToastService);

        authStore.token.set('test-auth-token');
        authStore.userId.set('user-123');
        authStore.updateBalance('1000.00');

        fixture.componentRef.setInput('isOpen', true);
        fixture.componentRef.setInput('position', mockPosition);
        fixture.detectChanges();
    });

    it('should display complete position details and liquidation calculation', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.market-question')?.textContent?.trim()).toBe('Will the Federal Reserve cut rates?');
        expect(el.querySelector('.shares-owned')?.textContent?.trim()).toBe('of 100.00 owned');
        expect(el.querySelector('.highlight-val')?.textContent?.trim()).toBe('$61.75 USDC');
        expect(el.querySelector('.min-payout-val')?.textContent?.trim()).toBe('$60.51 USDC');

        const rows = el.querySelectorAll('.financial-table .table-row');
        expect(rows.length).toBe(6);
    });

    it('should request a fresh SELL quote for the whole position when opened', () => {
        expect(apiServiceSpy.getSellQuote).toHaveBeenCalledWith(mockPosition.market_id, 'YES', '100.00000000');
    });

    it('should disable confirm and show retry when the SELL quote fails', () => {
        apiServiceSpy.getSellQuote.mockReturnValue(throwError(() => ({ error: { message: 'Market is not open for trading' } })));
        component.refreshQuote();
        fixture.detectChanges();

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.quote-error')?.textContent).toContain('Market is not open for trading');
        const confirmBtn = el.querySelectorAll('.dialog-actions-row button')[1] as HTMLButtonElement;
        expect(confirmBtn.disabled).toBe(true);
    });

    it('should re-quote after a slippage rejection', () => {
        apiServiceSpy.cashOut.mockReturnValue(throwError(() => ({ error: { error: 'slippage_exceeded', message: 'Price moved since your quote' } })));
        apiServiceSpy.getSellQuote.mockClear();

        const confirmBtn = fixture.nativeElement.querySelectorAll('.dialog-actions-row button')[1] as HTMLButtonElement;
        confirmBtn.click();
        fixture.detectChanges();

        expect(apiServiceSpy.getSellQuote).toHaveBeenCalledTimes(1);
    });

    it('should dismiss dialog when Cancel is clicked', () => {
        let dismissed = false;
        component.dialogDismissed.subscribe(() => (dismissed = true));

        const cancelBtn = fixture.nativeElement.querySelectorAll('.dialog-actions-row button')[0] as HTMLButtonElement;
        expect(cancelBtn.textContent?.trim()).toBe('Cancel');
        cancelBtn.click();
        fixture.detectChanges();

        expect(dismissed).toBe(true);
        expect(component.isOpen()).toBe(false);
    });

    it('should execute cash out API call on confirm and emit cashedOut', () => {
        let responseReceived: CashOutResponse | null = null;
        component.cashedOut.subscribe((r) => (responseReceived = r));

        const confirmBtn = fixture.nativeElement.querySelectorAll('.dialog-actions-row button')[1] as HTMLButtonElement;
        expect(confirmBtn.textContent?.trim()).toContain('Confirm Cash Out');
        confirmBtn.click();
        fixture.detectChanges();

        expect(apiServiceSpy.cashOut).toHaveBeenCalledWith(
            {
                market_id: mockPosition.market_id,
                outcome: 'YES',
                shares: '100.00000000',
                // 61.75 quoted payout with 2.0% tolerance: derived from the SELL quote, not spot x 0.98
                min_payout_usdc: '60.51500000'
            },
            'test-auth-token',
            expect.any(String)
        );

        expect(responseReceived).toEqual(mockCashOutResponse);
        expect(component.isOpen()).toBe(false);
    });

    it('should handle error when cash out API fails', () => {
        const toastSpy = vi.spyOn(toastService, 'error');
        apiServiceSpy.cashOut.mockReturnValue(throwError(() => ({ error: { message: 'AMM reserve depleted' } })));

        const confirmBtn = fixture.nativeElement.querySelectorAll('.dialog-actions-row button')[1] as HTMLButtonElement;
        confirmBtn.click();
        fixture.detectChanges();

        expect(toastSpy).toHaveBeenCalledWith('Liquidation Failed', 'AMM reserve depleted');
        expect(component.isExecuting()).toBe(false);
    });
});
