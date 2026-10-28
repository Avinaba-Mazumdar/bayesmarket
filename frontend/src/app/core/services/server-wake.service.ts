import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks API requests that have waited past the slow threshold. The free backend sleeps when idle and takes
 * up to a minute to wake, so the shell tells the reader the wait is expected instead of looking broken.
 */
@Injectable({
    providedIn: 'root'
})
export class ServerWakeService {
    private readonly slowRequests = signal(0);

    /** True while at least one API request is slow or retrying through a cold start. */
    readonly waking = computed(() => this.slowRequests() > 0);

    markSlow(): void {
        this.slowRequests.update((n) => n + 1);
    }

    clearSlow(): void {
        this.slowRequests.update((n) => Math.max(0, n - 1));
    }
}
