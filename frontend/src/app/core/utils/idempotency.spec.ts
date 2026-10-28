import { newIdempotencyKey } from './idempotency';

describe('newIdempotencyKey', () => {
    it('returns a prefixed, printable key that the backend accepts', () => {
        const key = newIdempotencyKey('order');
        expect(key).toMatch(/^order-[0-9a-f]{32}$/);
        expect(key.length).toBeLessThanOrEqual(128);
    });

    it('returns a different key for each call', () => {
        expect(newIdempotencyKey('claim')).not.toBe(newIdempotencyKey('claim'));
    });
});
