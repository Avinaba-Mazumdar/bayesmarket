import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyPolicyComponent } from './privacy-policy.component';

describe('PrivacyPolicyComponent', () => {
    let fixture: ComponentFixture<PrivacyPolicyComponent>;
    let component: PrivacyPolicyComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PrivacyPolicyComponent],
            providers: [provideRouter([])]
        }).compileComponents();

        fixture = TestBed.createComponent(PrivacyPolicyComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the privacy policy component', () => {
        expect(component).toBeTruthy();
    });

    it('should render the privacy policy title and simulation disclaimer callout', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const heading = compiled.querySelector('.legal-title');
        expect(heading?.textContent).toContain('Privacy Policy');

        const callout = compiled.querySelector('.simulation-callout');
        expect(callout?.textContent).toContain('Educational Paper-Trading Simulation Notice');
        expect(callout?.textContent).toContain('BayesMarket Mock USDC');
    });

    it('should render back link to markets', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const backLink = compiled.querySelector('.back-link');
        expect(backLink?.getAttribute('href')).toBe('/');
    });
});
