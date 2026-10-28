import { Injectable, signal } from '@angular/core';
import { Toast } from './toast.model';

export * from './toast.model';

interface PendingDismiss {
    timer: ReturnType<typeof setTimeout> | null;
    /** Milliseconds left before auto-dismiss, measured when the timer was last paused. */
    remaining: number;
    startedAt: number;
}

@Injectable({
    providedIn: 'root'
})
export class ToastService {
    private readonly _toasts = signal<Toast[]>([]);
    readonly toasts = this._toasts.asReadonly();

    private idCounter = 0;
    private readonly pending = new Map<string, PendingDismiss>();

    show(params: Omit<Toast, 'id'>): string {
        const id = `toast-${++this.idCounter}-${Date.now()}`;
        const toast: Toast = {
            id,
            duration: 4500,
            variant: 'default',
            ...params
        };

        this._toasts.update((current) => [...current, toast]);

        if (toast.duration && toast.duration > 0) {
            this.startTimer(id, toast.duration);
        }

        return id;
    }

    success(title: string, description?: string): string {
        return this.show({ title, description, variant: 'success' });
    }

    /** Errors persist until the reader dismisses them, so a failed trade cannot vanish unread. */
    error(title: string, description?: string): string {
        return this.show({ title, description, variant: 'destructive', duration: 0 });
    }

    /** Warnings persist until dismissed, like errors. */
    warning(title: string, description?: string): string {
        return this.show({ title, description, variant: 'warning', duration: 0 });
    }

    info(title: string, description?: string): string {
        return this.show({ title, description, variant: 'info' });
    }

    /** Stops the auto-dismiss timer while the reader hovers or focuses the toast (WCAG 2.2 SC 2.2.1). */
    pause(id: string): void {
        const entry = this.pending.get(id);
        if (!entry || entry.timer === null) return;
        clearTimeout(entry.timer);
        entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt));
        entry.timer = null;
    }

    /** Restarts the auto-dismiss timer with the time that was left when it was paused. */
    resume(id: string): void {
        const entry = this.pending.get(id);
        if (!entry || entry.timer !== null) return;
        this.startTimer(id, entry.remaining);
    }

    dismiss(id: string): void {
        const entry = this.pending.get(id);
        if (entry?.timer) clearTimeout(entry.timer);
        this.pending.delete(id);
        this._toasts.update((current) => current.filter((t) => t.id !== id));
    }

    clear(): void {
        this.pending.forEach((entry) => {
            if (entry.timer) clearTimeout(entry.timer);
        });
        this.pending.clear();
        this._toasts.set([]);
    }

    private startTimer(id: string, duration: number): void {
        const entry: PendingDismiss = this.pending.get(id) ?? { timer: null, remaining: duration, startedAt: 0 };
        entry.remaining = duration;
        entry.startedAt = Date.now();
        entry.timer = setTimeout(() => this.dismiss(id), duration);
        this.pending.set(id, entry);
    }
}
