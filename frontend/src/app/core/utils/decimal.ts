/**
 * Exact fixed-point helpers for canonical decimal strings (AGENTs §3.1: no native Number math on money).
 * Values are scaled to the backend storage precision of 8 decimal places and handled as BigInt.
 */

const SCALE = 8;
const ONE = 10n ** BigInt(SCALE);
const HUNDRED = 100n * ONE;
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

function toScaled(value: string): bigint | null {
    const trimmed = value.trim();
    if (!DECIMAL_PATTERN.test(trimmed)) return null;
    const [whole, fraction = ''] = trimmed.split('.');
    // Truncate (never round up) anything beyond storage precision
    return BigInt(whole) * ONE + BigInt(fraction.slice(0, SCALE).padEnd(SCALE, '0'));
}

function fromScaled(scaled: bigint): string {
    const whole = scaled / ONE;
    const fraction = (scaled % ONE).toString().padStart(SCALE, '0');
    return `${whole}.${fraction}`;
}

/**
 * Reduces a quoted amount by a slippage tolerance percentage, rounding down to 8 decimal places.
 * Used to derive min_shares_out / min_payout_usdc floors from an authoritative server quote.
 *
 * applyTolerance('147.05', '2.0') === '144.10900000'
 *
 * Returns null when either input is not a non-negative decimal string or the tolerance exceeds 100%.
 */
export function applyTolerance(quoted: string, tolerancePct: string): string | null {
    const amount = toScaled(quoted);
    const tolerance = toScaled(tolerancePct);
    if (amount === null || tolerance === null || tolerance > HUNDRED) return null;
    return fromScaled((amount * (HUNDRED - tolerance)) / HUNDRED);
}

/**
 * Truncates a decimal string to a fixed number of places for display, without float conversion.
 *
 * truncateDecimal('144.10900000', 2) === '144.10'
 */
export function truncateDecimal(value: string, places: number): string {
    const scaled = toScaled(value);
    if (scaled === null) return value;
    const [whole, fraction] = fromScaled(scaled).split('.');
    return places > 0 ? `${whole}.${fraction.slice(0, places)}` : whole;
}
