import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MarketCardComponent } from './market-card.component';
import { Market } from '../../core/models/market.model';

describe('MarketCardComponent', () => {
    let fixture: ComponentFixture<MarketCardComponent>;

    const mockMarket: Market = {
        id: '11111111-1111-1111-1111-111111111111',
        slug: 'fed-cut-rates',
        title: 'Will the Federal Reserve cut rates by >= 25 bps at next FOMC?',
        description: 'Settles YES if the Federal Open Market Committee lowers the target federal funds rate.',
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

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MarketCardComponent],
            providers: [provideRouter([])]
        }).compileComponents();

        fixture = TestBed.createComponent(MarketCardComponent);
        fixture.componentRef.setInput('market', mockMarket);
        fixture.detectChanges();
    });

    it('should display market question title and category tag', () => {
        const el = fixture.nativeElement as HTMLElement;
        expect(el.querySelector('.market-title')?.textContent?.trim()).toContain('Will the Federal Reserve cut rates');
        expect(el.querySelector('.card-meta-row')?.textContent?.trim()).toContain('MACRO');
    });

    it('should compute probability percentages and render dual split bar meter', () => {
        const el = fixture.nativeElement as HTMLElement;
        const meter = el.querySelector('.split-bar-container');
        expect(meter).toBeTruthy();
        expect(meter?.getAttribute('aria-valuenow')).toBe('68');

        const yesFill = el.querySelector('.split-fill-yes') as HTMLElement;
        expect(yesFill.style.width).toBe('68%');
        const noFill = el.querySelector('.split-fill-no') as HTMLElement;
        expect(noFill.style.width).toBe('32%');
    });

    it('should display dual-coded YES and NO price pills in cents', () => {
        const el = fixture.nativeElement as HTMLElement;
        const yesPill = el.querySelector('.pill-yes');
        const noPill = el.querySelector('.pill-no');

        expect(yesPill?.textContent).toContain('68¢');
        expect(yesPill?.textContent).toContain('YES');
        expect(noPill?.textContent).toContain('32¢');
        expect(noPill?.textContent).toContain('NO');
    });

    it('should link to market cockpit route', () => {
        const link = fixture.nativeElement.querySelector('.market-card-link') as HTMLAnchorElement;
        expect(link.getAttribute('href')).toBe('/markets/11111111-1111-1111-1111-111111111111');
    });
});
