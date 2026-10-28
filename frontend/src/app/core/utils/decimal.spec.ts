import {
    absDecimal,
    addDecimal,
    applyTolerance,
    compareDecimal,
    diffDecimal,
    divideDecimal,
    formatDecimal,
    formatUsd,
    multiplyDecimal,
    normalizeDecimal,
    shiftDecimal,
    subtractDecimal,
    trimDecimal,
    truncateDecimal
} from './decimal';

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

    describe('normalizeDecimal', () => {
        it('truncates to the requested places and never rounds up', () => {
            expect(normalizeDecimal(' 12.349 ', 2)).toBe('12.34');
            expect(normalizeDecimal('999.999999', 2)).toBe('999.99');
            expect(normalizeDecimal('50', 8)).toBe('50.00000000');
        });

        it('rejects non-decimal input', () => {
            expect(normalizeDecimal('', 2)).toBeNull();
            expect(normalizeDecimal('1e3', 2)).toBeNull();
            expect(normalizeDecimal('-1', 2)).toBeNull();
            expect(normalizeDecimal('abc', 2)).toBeNull();
        });
    });

    describe('compareDecimal', () => {
        it('compares exactly, beyond float precision', () => {
            expect(compareDecimal('1000.00000001', '1000.00000000')).toBe(1);
            expect(compareDecimal('0.1', '0.10000000')).toBe(0);
            expect(compareDecimal('9', '10')).toBe(-1);
            expect(compareDecimal('x', '10')).toBeNull();
        });
    });

    describe('addDecimal and subtractDecimal', () => {
        it('stays exact where binary floats drift', () => {
            expect(addDecimal('0.1', '0.2')).toBe('0.30000000');
            expect(subtractDecimal('1000.00000000', '0.00000001')).toBe('999.99999999');
        });

        it('clamps subtraction at zero', () => {
            expect(subtractDecimal('5', '7')).toBe('0.00000000');
        });
    });

    describe('formatUsd', () => {
        it('groups thousands and truncates to cents', () => {
            expect(formatUsd('1000')).toBe('$1,000.00');
            expect(formatUsd('1234567.899')).toBe('$1,234,567.89');
            expect(formatUsd('0.5')).toBe('$0.50');
        });

        it('falls back for invalid input', () => {
            expect(formatUsd('n/a')).toBe('$0.00');
        });
    });
});

describe('display helpers', () => {
    it('rounds half-up at the requested places and groups thousands', () => {
        expect(formatDecimal('1234.565', 2, true)).toBe('1,234.57');
        expect(formatDecimal('0.0049', 2)).toBe('0.00');
        expect(formatDecimal('-2.5', 0)).toBe('-3');
        expect(formatDecimal('abc', 2)).toBeNull();
    });

    it('does not show float artefacts', () => {
        expect(formatDecimal('0.1', 2)).toBe('0.10');
        expect(formatDecimal('1.005', 2)).toBe('1.01');
    });

    it('removes a sign and computes differences without clamping', () => {
        expect(absDecimal('-3.20')).toBe('3.2');
        expect(diffDecimal('5', '7', 2)).toBe('-2.00');
    });

    it('multiplies and divides exactly', () => {
        expect(multiplyDecimal('1000.12345678', '0.37', 2)).toBe('370.05');
        expect(divideDecimal('1', '3', 4)).toBe('0.3333');
        expect(divideDecimal('1', '0', 4)).toBeNull();
    });

    it('shifts by powers of ten exactly', () => {
        expect(shiftDecimal('0.6812', 2, 1)).toBe('68.1');
        expect(shiftDecimal('1000', -2, 8)).toBe('10.00000000');
    });

    it('trims trailing zeros for display', () => {
        expect(trimDecimal('60.00000000')).toBe('60');
        expect(trimDecimal('0.00000000')).toBe('0');
        expect(trimDecimal('1.50')).toBe('1.5');
        expect(trimDecimal('100')).toBe('100');
    });
});
