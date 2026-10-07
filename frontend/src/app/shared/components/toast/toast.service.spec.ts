import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ToastService } from './toast.service';
import { ToastContainerComponent } from './toast-container.component';

describe('ToastService & ToastContainerComponent', () => {
    let service: ToastService;
    let fixture: ComponentFixture<ToastContainerComponent>;
    let component: ToastContainerComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ToastContainerComponent],
            providers: [ToastService]
        }).compileComponents();

        service = TestBed.inject(ToastService);
        fixture = TestBed.createComponent(ToastContainerComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should add toast to signal list on show() and render inside viewport', () => {
        service.show({
            title: 'Order Executed',
            description: 'Bought 50 YES contracts at 52¢',
            variant: 'success'
        });
        fixture.detectChanges();

        expect(service.toasts().length).toBe(1);
        const toastItem = fixture.nativeElement.querySelector('.toast-item');
        expect(toastItem).toBeTruthy();
        expect(toastItem.classList.contains('toast-success')).toBe(true);
        expect(fixture.nativeElement.querySelector('.toast-title')?.textContent).toContain('Order Executed');
        expect(fixture.nativeElement.querySelector('.toast-description')?.textContent).toContain('Bought 50 YES contracts at 52¢');
    });

    it('should assign role="alert" for destructive toasts and role="status" for others', () => {
        service.error('Trade Failed', 'Insufficient USDC balance');
        fixture.detectChanges();

        const toastItem = fixture.nativeElement.querySelector('.toast-item');
        expect(toastItem.getAttribute('role')).toBe('alert');

        service.clear();
        service.info('Market Stream Active', 'Receiving real-time updates');
        fixture.detectChanges();

        const infoToast = fixture.nativeElement.querySelector('.toast-item');
        expect(infoToast.getAttribute('role')).toBe('status');
    });

    it('should trigger action callback when action button is clicked and dismiss toast', () => {
        let actionCalled = false;
        service.show({
            title: 'Order Cancelled',
            variant: 'warning',
            action: {
                label: 'Undo',
                onClick: () => {
                    actionCalled = true;
                }
            }
        });
        fixture.detectChanges();

        const actionBtnWrapper = fixture.nativeElement.querySelector('.toast-action-btn') as HTMLElement;
        expect(actionBtnWrapper).toBeTruthy();
        const actionBtn = (actionBtnWrapper.querySelector('button') ?? actionBtnWrapper) as HTMLButtonElement;
        expect(actionBtn.textContent?.trim()).toBe('Undo');

        actionBtn.click();
        fixture.detectChanges();

        expect(actionCalled).toBe(true);
        expect(service.toasts().length).toBe(0);
    });

    it('should dismiss toast when close button is clicked', () => {
        service.info('Test Info');
        fixture.detectChanges();

        expect(service.toasts().length).toBe(1);
        const closeBtnWrapper = fixture.nativeElement.querySelector('.toast-close-btn') as HTMLElement;
        const closeBtn = (closeBtnWrapper.querySelector('button') ?? closeBtnWrapper) as HTMLButtonElement;
        closeBtn.click();
        fixture.detectChanges();

        expect(service.toasts().length).toBe(0);
    });

    it('should auto-dismiss toast after duration expires', () => {
        vi.useFakeTimers();
        service.show({
            title: 'Auto Dismiss Toast',
            duration: 1000
        });
        expect(service.toasts().length).toBe(1);

        vi.advanceTimersByTime(1100);
        expect(service.toasts().length).toBe(0);
        vi.useRealTimers();
    });

    it('should clear all toasts when clear() is called', () => {
        service.success('T1');
        service.error('T2');
        service.warning('T3');
        expect(service.toasts().length).toBe(3);

        service.clear();
        expect(service.toasts().length).toBe(0);
    });
});
