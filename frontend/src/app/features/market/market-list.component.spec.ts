import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MarketListComponent } from './market-list.component';
import { ApiService } from '../../core/services/api.service';
import { Market } from '../../core/models/market.model';

describe('MarketListComponent', () => {
    let fixture: ComponentFixture<MarketListComponent>;
    let component: MarketListComponent;
    let apiServiceSpy: { getMarkets: any; refreshSession: any; endSession: any; getMarketCategories: any; getMarketTrades: any; getMarketHistory: any; };

    const mockMarkets: Market[] = [
        {
            id: 'm1',
            slug: 'fed-cut-rates',
            title: 'Will Fed cut rates in September?',
            description: 'Macro rate decision',
            category: 'macro',
            resolution_source: 'Federal Reserve',
            resolution_date: '2026-09-18T18:00:00Z',
            status: 'active',
            probability_yes: '0.7000',
            probability_no: '0.3000',
            probability_yes_pct: '70.0',
            probability_no_pct: '30.0',
            reserves: {
                reserve_yes: '30000.00',
                reserve_no: '70000.00',
                collateral_reserve: '100000.00',
                total_volume_usdc: '50000.00'
            },
            created_at: '2026-01-01T00:00:00Z'
        },
        {
            id: 'm2',
            slug: 'btc-ath',
            title: 'Will Bitcoin surpass ATH this month?',
            description: 'Crypto ATH prediction',
            category: 'crypto',
            resolution_source: 'Coinbase',
            resolution_date: '2026-09-30T23:59:59Z',
            status: 'active',
            probability_yes: '0.4500',
            probability_no: '0.5500',
            probability_yes_pct: '45.0',
            probability_no_pct: '55.0',
            reserves: {
                reserve_yes: '55000.00',
                reserve_no: '45000.00',
                collateral_reserve: '100000.00',
                total_volume_usdc: '80000.00'
            },
            created_at: '2026-01-01T00:00:00Z'
        }
    ];

    beforeEach(async () => {
        apiServiceSpy = {
            refreshSession: vi.fn().mockReturnValue(throwError(() => ({ status: 401 }))),
            endSession: vi.fn().mockReturnValue(of(undefined)),
            getMarketCategories: vi.fn().mockReturnValue(of([])),
            getMarketTrades: vi.fn().mockReturnValue(of([])),
            getMarketHistory: vi.fn().mockReturnValue(of({ market_id: '', range: '24h', points: [] })),
            getMarkets: vi.fn().mockReturnValue(of(mockMarkets))
        };

        await TestBed.configureTestingModule({
            imports: [MarketListComponent],
            providers: [provideRouter([]), { provide: ApiService, useValue: apiServiceSpy }]
        }).compileComponents();

        fixture = TestBed.createComponent(MarketListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should load markets and compute exchange summary totals', () => {
        expect(component.markets().length).toBe(2);
        expect(component['totalVolume']()).toBe('130,000.00');
        expect(component['totalCollateral']()).toBe('200,000.00');
    });

    it('should filter markets by category chip', () => {
        component.setCategory('macro');
        fixture.detectChanges();
        expect(component['filteredMarkets']().length).toBe(1);
        expect(component['filteredMarkets']()[0].category).toBe('macro');

        component.setCategory('crypto');
        fixture.detectChanges();
        expect(component['filteredMarkets']().length).toBe(1);
        expect(component['filteredMarkets']()[0].category).toBe('crypto');

        component.setCategory('all');
        fixture.detectChanges();
        expect(component['filteredMarkets']().length).toBe(2);
    });

    it('should filter markets by search query', () => {
        component.searchQuery.set('Bitcoin');
        fixture.detectChanges();
        expect(component['filteredMarkets']().length).toBe(1);
        expect(component['filteredMarkets']()[0].id).toBe('m2');
    });

    it('should display empty state when no markets match and reset filters', () => {
        component.searchQuery.set('NonExistentTopicXYZ');
        fixture.detectChanges();
        expect(component['filteredMarkets']().length).toBe(0);

        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.empty-state h3')?.textContent).toContain('No Markets Found');

        component.resetFilters();
        fixture.detectChanges();
        expect(component['filteredMarkets']().length).toBe(2);
    });
});
