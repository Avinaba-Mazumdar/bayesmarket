import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MarketDetailComponent } from './market-detail.component';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AuthStore } from '../../state/auth.store';
import { Market, OrderResponse } from '../../core/models/market.model';
import { OrderIntent } from '../terminal/order-terminal.component';

describe('MarketDetailComponent', () => {
    let fixture: ComponentFixture<MarketDetailComponent>;
    let component: MarketDetailComponent;
    let apiServiceSpy: { createGuestSession: any; getPortfolio: any; getMarketById: any; getQuote: any; placeOrder: any };
    let wsService: WebSocketService;

    const mockMarket: Market = {
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'fed-cut-rates',
        title: 'Will the Federal Reserve cut rates by >= 25 bps?',
        description: 'Settles YES if FOMC lowers rates.',
        category: 'macro',
        resolution_source: 'Federal Reserve Official Release',
        resolution_date: '2026-09-18T18:00:00Z',
        status: 'active',
        probability_yes: '0.6800',
        probability_no: '0.3200',
        probability_yes_pct: '68.0',
        probability_no_pct: '32.0',
        reserves: {
            reserve_yes: '32000.00',
            reserve_no: '68000.00',
            collateral_reserve: '100000.00',
            total_volume_usdc: '254500.00'
        },
        created_at: '2026-01-01T00:00:00Z'
    };

    beforeAll(() => {
        if (typeof window.ResizeObserver === 'undefined') {
            window.ResizeObserver = class {
                observe() {}
                unobserve() {}
                disconnect() {}
            } as any;
        }

        if (!HTMLCanvasElement.prototype.getContext) {
            HTMLCanvasElement.prototype.getContext = (() => ({
                fillRect: () => {},
                clearRect: () => {},
                getImageData: () => ({ data: [] }),
                putImageData: () => {},
                createImageData: () => [],
                setTransform: () => {},
                drawImage: () => {},
                save: () => {},
                fillText: () => {},
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                translate: () => {},
                scale: () => {},
                rotate: () => {},
                arc: () => {},
                fill: () => {},
                measureText: () => ({ width: 0 }),
                transform: () => {},
                rect: () => {},
                clip: () => {}
            })) as any;
        }
    });

    beforeEach(async () => {
        apiServiceSpy = {
            createGuestSession: vi.fn().mockReturnValue(
                of({
                    token: 'test-token',
                    user: { id: 'u1', cash_balance: '1000.00', is_guest: true, created_at: '2026-01-01T00:00:00Z' }
                })
            ),
            getPortfolio: vi.fn().mockReturnValue(
                of({
                    cash_balance: '1000.00',
                    total_portfolio_value: '1000.00',
                    positions: []
                })
            ),
            getMarketById: vi.fn().mockReturnValue(of(mockMarket)),
            getQuote: vi.fn().mockReturnValue(
                of({
                    market_id: mockMarket.id,
                    action: 'BUY',
                    outcome: 'YES',
                    deposit_usdc: '50.00',
                    shares_received: '73.52',
                    avg_price: '0.6800',
                    initial_price: '0.6800',
                    new_price: '0.6850',
                    price_impact_pct: '0.50',
                    new_reserve_yes: '32050.00',
                    new_reserve_no: '67950.00',
                    new_collateral: '100050.00'
                })
            ),
            placeOrder: vi.fn().mockReturnValue(of({}))
        };

        await TestBed.configureTestingModule({
            imports: [MarketDetailComponent],
            providers: [provideRouter([]), { provide: ApiService, useValue: apiServiceSpy }, WebSocketService, AuthStore]
        }).compileComponents();

        fixture = TestBed.createComponent(MarketDetailComponent);
        component = fixture.componentInstance;
        wsService = TestBed.inject(WebSocketService);

        fixture.componentRef.setInput('id', mockMarket.id);
        fixture.detectChanges();
    });

    it('should fetch market details and initialize trading cockpit', () => {
        expect(apiServiceSpy.getMarketById).toHaveBeenCalledWith(mockMarket.id);
        expect(component.market()).toEqual(mockMarket);
        expect(component['yesPct']()).toBe(68);
        expect(component['noPct']()).toBe(32);
    });

    it('should show the server-reported winner for a market resolved NO', () => {
        component.market.set({ ...mockMarket, status: 'resolved', winning_outcome: 'NO' });
        fixture.detectChanges();

        const title = fixture.nativeElement.querySelector('.banner-title')?.textContent ?? '';
        expect(title).toContain('NO Won');
        expect(title).not.toContain('YES');
    });

    it('should not guess a winner when the resolved market has no winning outcome', () => {
        component.market.set({ ...mockMarket, status: 'resolved', winning_outcome: null });
        fixture.detectChanges();

        const title = (fixture.nativeElement.querySelector('.banner-title')?.textContent ?? '').trim();
        expect(title).toBe('Market Resolved');
    });

    it('should open confirmation dialog when review is requested from terminal', () => {
        const mockIntent: OrderIntent = {
            marketId: mockMarket.id,
            marketTitle: mockMarket.title,
            outcome: 'YES',
            amountUSDC: '100.00',
            quote: {
                market_id: mockMarket.id,
                action: 'BUY',
                outcome: 'YES',
                deposit_usdc: '100.00',
                shares_received: '147.05',
                avg_price: '0.6800',
                initial_price: '0.6800',
                new_price: '0.6900',
                price_impact_pct: '1.20',
                new_reserve_yes: '32100.00',
                new_reserve_no: '67900.00',
                new_collateral: '100100.00'
            },
            maxSlippagePct: '1.00',
            currentBalance: '$1,000.00',
            postTradeBalance: '$900.00'
        };

        component.onOrderReviewRequested(mockIntent);
        expect(component.isConfirmDialogOpen()).toBe(true);
        expect(component.pendingOrderIntent()).toEqual(mockIntent);
    });

    it('should dismiss confirmation dialog and focus amount input upon dismiss', () => {
        component.isConfirmDialogOpen.set(true);
        component.onOrderDialogDismissed();

        expect(component.isConfirmDialogOpen()).toBe(false);
        expect(component.pendingOrderIntent()).toBeNull();
    });

    it('should update price tick and re-fetch market when order is placed successfully', () => {
        const receipt: OrderResponse = {
            trade_id: 'ord-123',
            market_id: mockMarket.id,
            user_id: 'u1',
            trade_type: 'BUY',
            outcome: 'YES',
            amount_usdc: '100.00',
            shares_filled: '147.05',
            execution_price: '0.7000',
            price_impact_pct: '1.20',
            new_cash_balance: '900.00',
            new_shares_owned: '147.05',
            avg_buy_price: '0.7000',
            created_at: '2026-09-07T12:00:00Z'
        };

        component.onOrderSuccessfullyPlaced(receipt);

        const lastTick = wsService.lastPriceTick();
        expect(lastTick).toBeTruthy();
        expect(lastTick?.yes_price).toBe('0.7000');
        expect(lastTick?.no_price).toBe('0.3000');
        expect(apiServiceSpy.getMarketById).toHaveBeenCalledTimes(2);
    });
});
