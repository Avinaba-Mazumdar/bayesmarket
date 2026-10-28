import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OrderConfirmDialogComponent } from './order-confirm-dialog.component';
import { OrderIntent } from './order-terminal.component';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../state/auth.store';
import { ToastService } from '../../shared/components/toast/toast.service';
import { OrderResponse } from '../../core/models/market.model';

describe('OrderConfirmDialogComponent', () => {
    let fixture: ComponentFixture<OrderConfirmDialogComponent>;
    let component: OrderConfirmDialogComponent;
    let apiServiceSpy: { createGuestSession: any; getPortfolio: any; placeOrder: any };
    let authStore: AuthStore;
    let toastService: ToastService;

    const mockIntent: OrderIntent = {
        marketId: '11111111-1111-1111-1111-111111111111',
        marketTitle: 'Will the Federal Reserve cut rates?',
        outcome: 'YES',
        amountUSDC: '100',
        quote: {
            market_id: '11111111-1111-1111-1111-111111111111',
            action: 'BUY',
            outcome: 'YES',
            deposit_usdc: '100.00',
            shares_received: '147.05',
            avg_price: '0.6800',
            initial_price: '0.6800',
            new_price: '0.6900',
            price_impact_pct: '1.25',
            new_reserve_yes: '32100.00',
            new_reserve_no: '67900.00',
            new_collateral: '100100.00'
        },
        maxSlippagePct: '2.0',
        currentBalance: '$1,000.00',
        postTradeBalance: '$900.00'
    };

    const mockReceipt: OrderResponse = {
        trade_id: 'order-12345',
        market_id: '11111111-1111-1111-1111-111111111111',
        user_id: 'user-123',
        trade_type: 'BUY',
        outcome: 'YES',
        amount_usdc: '100.00',
        shares_filled: '147.05',
        execution_price: '0.6800',
        price_impact_pct: '1.25',
        new_cash_balance: '900.00',
        new_shares_owned: '147.05',
        avg_buy_price: '0.6800',
        created_at: '2026-09-07T12:00:00Z'
    };

    beforeEach(async () => {
        apiServiceSpy = {
            createGuestSession: vi.fn().mockReturnValue(
                of({
                    token: 'test-auth-token',
                    user: { id: 'user-123', cash_balance: '1000.00', is_guest: true, created_at: '2026-01-01T00:00:00Z' }
                })
            ),
            getPortfolio: vi.fn().mockReturnValue(
                of({
                    cash_balance: '1000.00',
                    total_portfolio_value: '1000.00',
                    positions: []
                })
            ),
            placeOrder: vi.fn().mockReturnValue(of(mockReceipt))
        };

        await TestBed.configureTestingModule({
            imports: [OrderConfirmDialogComponent],
            providers: [{ provide: ApiService, useValue: apiServiceSpy }, AuthStore, ToastService]
        }).compileComponents();

        fixture = TestBed.createComponent(OrderConfirmDialogComponent);
        component = fixture.componentInstance;
        authStore = TestBed.inject(AuthStore);
        toastService = TestBed.inject(ToastService);

        // Set guest session directly in auth store signals
        authStore.token.set('test-auth-token');
        authStore.userId.set('user-123');
        authStore.cashBalance.set('$1,000.00');

        fixture.componentRef.setInput('isOpen', true);
        fixture.componentRef.setInput('intent', mockIntent);
        fixture.detectChanges();
    });

    it('should display complete financial breakdown table', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.market-title')?.textContent?.trim()).toBe('Will the Federal Reserve cut rates?');
        expect(el.querySelector('.total-amount')?.textContent?.trim()).toBe('$100.00 USDC');
        expect(el.querySelector('.shares-val')?.textContent?.trim()).toContain('147.05 Shares');

        const rows = el.querySelectorAll('.financial-table .table-row');
        expect(rows.length).toBe(6);
        // 147.05 quoted shares with 2.0% tolerance
        expect(el.querySelector('.min-shares-val')?.textContent?.trim()).toBe('144.10 Shares');
        expect(el.querySelector('.balance-preview')?.textContent?.trim()).toBe('$900.00');
    });

    it('should emit dialogDismissed and close when Edit Order is clicked', () => {
        let dismissed = false;
        component.dialogDismissed.subscribe(() => (dismissed = true));

        const editBtn = fixture.nativeElement.querySelectorAll('.dialog-actions-row button')[0] as HTMLButtonElement;
        expect(editBtn.textContent?.trim()).toBe('Edit Order');
        editBtn.click();
        fixture.detectChanges();

        expect(dismissed).toBe(true);
        expect(component.isOpen()).toBe(false);
    });

    it('should execute order on Confirm and emit orderPlaced', () => {
        let placedReceipt: OrderResponse | null = null;
        component.orderPlaced.subscribe((r) => (placedReceipt = r));

        const confirmBtn = fixture.nativeElement.querySelectorAll('.dialog-actions-row button')[1] as HTMLButtonElement;
        expect(confirmBtn.textContent?.trim()).toContain('Confirm & Place Trade');
        confirmBtn.click();
        fixture.detectChanges();

        expect(apiServiceSpy.placeOrder).toHaveBeenCalledWith(
            mockIntent.marketId,
            {
                outcome: 'YES',
                amount_usdc: '100',
                min_shares_out: '144.10900000'
            },
            'test-auth-token',
            expect.any(String)
        );

        expect(placedReceipt).toEqual(mockReceipt);
        expect(component.isOpen()).toBe(false);
    });

    it('should handle order error gracefully with toast message', () => {
        apiServiceSpy.placeOrder.mockReturnValue(
            throwError(() => ({
                error: { error: 'slippage_exceeded', message: 'Execution price moved outside slippage tolerance.' }
            }))
        );
        const toastSpy = vi.spyOn(toastService, 'error');

        const confirmBtn = fixture.nativeElement.querySelectorAll('.dialog-actions-row button')[1] as HTMLButtonElement;
        confirmBtn.click();
        fixture.detectChanges();

        expect(toastSpy).toHaveBeenCalledWith('Trade Rejected', 'Execution price moved outside slippage tolerance.');
        expect(component.isExecuting()).toBe(false);
    });
});
