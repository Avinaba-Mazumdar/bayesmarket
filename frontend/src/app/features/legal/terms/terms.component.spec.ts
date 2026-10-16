import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TermsComponent } from './terms.component';

describe('TermsComponent', () => {
    let fixture: ComponentFixture<TermsComponent>;
    let component: TermsComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [TermsComponent],
            providers: [provideRouter([])]
        }).compileComponents();

        fixture = TestBed.createComponent(TermsComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the terms component', () => {
        expect(component).toBeTruthy();
    });

    it('should render the terms title and simulation warning', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        const heading = compiled.querySelector('.legal-title');
        expect(heading?.textContent).toContain('Terms and Conditions');

        const warning = compiled.querySelector('.simulation-warning');
        expect(warning?.textContent).toContain('Simulation & Educational Use Disclaimer');
        expect(warning?.textContent).toContain('Zero Real Money');
    });

    it('should display MIT license clause and acceptable use policy', () => {
        const compiled = fixture.nativeElement as HTMLElement;
        expect(compiled.textContent).toContain('THE SOFTWARE IS PROVIDED');
        expect(compiled.textContent).toContain('Acceptable Use Policy');
    });
});
