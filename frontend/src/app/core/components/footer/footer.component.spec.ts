import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
    let fixture: ComponentFixture<FooterComponent>;
    let component: FooterComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FooterComponent],
            providers: [provideRouter([])]
        }).compileComponents();

        fixture = TestBed.createComponent(FooterComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the footer component', () => {
        expect(component).toBeTruthy();
    });

    it('should render navigation links to privacy and terms', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const links = Array.from(compiled.querySelectorAll('.footer-link')) as HTMLAnchorElement[];
        const hrefs = links.map((l) => l.getAttribute('href'));

        expect(hrefs).toContain('/privacy');
        expect(hrefs).toContain('/terms');
        expect(hrefs).toContain('/');
        expect(hrefs).toContain('/portfolio');
    });

    it('should display simulation paper-trading disclaimer', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('educational binary prediction market simulator');
        expect(compiled.textContent).toContain('BayesMarket Mock USDC');
    });
});
