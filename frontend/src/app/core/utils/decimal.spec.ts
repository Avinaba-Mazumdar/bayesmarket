import { applyTolerance, truncateDecimal } from './decimal';

describe('decimal utils', () => {
    describe('applyTolerance', () => {
        it('reduces a quote by the tolerance exactly', () => {
            expect(applyTolerance('147.05', '2.0')).toBe('144.10900000');
            expect(applyTolerance('100', '1.00')).toBe('99.00000000');
        });

        it('rounds down at 8 decimal places so the floor is never above the exact value', () => {
            // 0.00000003 * 0.99 = 0.0000000297 -> 0.00000002
            expect(applyTolerance('0.00000003', '1')).toBe('0.00000002');
            expect(applyTolerance('1.23456789', '0.5')).toBe('1.22839505');
        });

        it('avoids float drift on values that are inexact in binary', () => {
            // 0.1 * 0.7 in float math is 0.06999999999999999
            expect(applyTolerance('0.1', '30')).toBe('0.07000000');
        });

        it('handles zero and full tolerance', () => {
            expect(applyTolerance('65.5', '0')).toBe('65.50000000');
            expect(applyTolerance('65.5', '100')).toBe('0.00000000');
        });

        it('rejects invalid input', () => {
            expect(applyTolerance('abc', '1')).toBeNull();
            expect(applyTolerance('-5', '1')).toBeNull();
            expect(applyTolerance('5', '101')).toBeNull();
            expect(applyTolerance('5', '')).toBeNull();
            expect(applyTolerance('1e3', '1')).toBeNull();
        });
    });

    describe('truncateDecimal', () => {
        it('truncates without rounding', () => {
            expect(truncateDecimal('144.10900000', 2)).toBe('144.10');
            expect(truncateDecimal('0.99999999', 4)).toBe('0.9999');
            expect(truncateDecimal('12', 2)).toBe('12.00');
            expect(truncateDecimal('12.5', 0)).toBe('12');
        });

        it('returns non-decimal input unchanged', () => {
            expect(truncateDecimal('n/a', 2)).toBe('n/a');
        });
    });
});
