/**
 * Idempotency keys for mutations. A key is created once per confirmation (or claim attempt) and reused
 * on every retry, so a retry after a network timeout replays the receipt instead of executing again.
 * Uses crypto.getRandomValues, which is available in insecure (non-HTTPS) contexts too.
 */
export function newIdempotencyKey(prefix: string): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}-${hex}`;
}
