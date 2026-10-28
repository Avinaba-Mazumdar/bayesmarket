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

/**
 * Normalizes user input to a canonical decimal string truncated to `places` decimals.
 * Returns null for anything that is not a non-negative decimal.
 *
 * normalizeDecimal(' 12.349 ', 2) === '12.34'
 */
export function normalizeDecimal(value: string, places = SCALE): string | null {
    const scaled = toScaled(value);
    if (scaled === null) return null;
    const digits = Math.max(0, Math.min(places, SCALE));
    const unit = 10n ** BigInt(SCALE - digits);
    const text = fromScaled(scaled - (scaled % unit));
    return digits === 0 ? text.slice(0, text.indexOf('.')) : text.slice(0, text.indexOf('.') + 1 + digits);
}

/** Compares two canonical decimal strings: -1, 0 or 1, or null if either is invalid. */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 | null {
    const x = toScaled(a);
    const y = toScaled(b);
    if (x === null || y === null) return null;
    return x === y ? 0 : x < y ? -1 : 1;
}

/** a + b as a canonical decimal string, or null if either input is invalid. */
export function addDecimal(a: string, b: string): string | null {
    const x = toScaled(a);
    const y = toScaled(b);
    if (x === null || y === null) return null;
    return fromScaled(x + y);
}

/** a - b, clamped at zero, as a canonical decimal string, or null if either input is invalid. */
export function subtractDecimal(a: string, b: string): string | null {
    const x = toScaled(a);
    const y = toScaled(b);
    if (x === null || y === null) return null;
    return fromScaled(x > y ? x - y : 0n);
}

/**
 * Formats a USDC amount for display: truncated to cents, with thousands separators. Never rounds up,
 * so a displayed balance is never larger than the real one.
 *
 * formatUsd('1234.569') === '$1,234.56'
 */
export function formatUsd(value: string): string {
    const scaled = toScaled(value);
    if (scaled === null) return '$0.00';
    const cents = scaled / (ONE / 100n);
    const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const fraction = (cents % 100n).toString().padStart(2, '0');
    return `$${whole}.${fraction}`;
}

/*
 * Display helpers. Values are parsed at 18 fractional digits, which is exact for every amount the
 * backend stores (8 digits), then rounded half-up to the requested places. No binary floats are used.
 */

const WORK = 18;
const WORK_ONE = 10n ** BigInt(WORK);
const SIGNED_PATTERN = /^-?\d+(\.\d+)?$/;

function parseSignedWork(value: string): bigint | null {
    const trimmed = value.trim();
    if (!SIGNED_PATTERN.test(trimmed)) return null;
    const negative = trimmed.startsWith('-');
    const body = negative ? trimmed.slice(1) : trimmed;
    const [whole, fraction = ''] = body.split('.');
    const magnitude = BigInt(whole) * WORK_ONE + BigInt(fraction.slice(0, WORK).padEnd(WORK, '0'));
    return negative ? -magnitude : magnitude;
}

function formatWork(scaled: bigint, places: number, grouping: boolean): string {
    const negative = scaled < 0n;
    const magnitude = negative ? -scaled : scaled;
    const unit = 10n ** BigInt(WORK - places);
    let rounded = magnitude / unit;
    if ((magnitude % unit) * 2n >= unit) rounded += 1n;
    const scale = 10n ** BigInt(places);
    const whole = (rounded / scale).toString();
    const groupedWhole = grouping ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
    const body = places > 0 ? `${groupedWhole}.${(rounded % scale).toString().padStart(places, '0')}` : groupedWhole;
    return negative && rounded !== 0n ? `-${body}` : body;
}

/**
 * Formats a signed decimal string to a fixed number of places, rounding half-up.
 * Returns null for input that is not a decimal.
 *
 * formatDecimal('1234.565', 2, true) === '1,234.57'
 */
export function formatDecimal(value: string, places: number, grouping = false): string | null {
    const scaled = parseSignedWork(value);
    if (scaled === null) return null;
    return formatWork(scaled, Math.max(0, Math.min(places, WORK)), grouping);
}

/** Drops trailing zeros after the point for display in an input: '60.00000000' becomes '60'. */
export function trimDecimal(value: string): string {
    return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

/** Removes the sign from a decimal string. */
export function absDecimal(value: string): string | null {
    const scaled = parseSignedWork(value);
    if (scaled === null) return null;
    return formatWork(scaled < 0n ? -scaled : scaled, WORK, false).replace(/\.?0+$/, '');
}

/** Signed a - b with no clamping, as a decimal string rounded to `places`. */
export function diffDecimal(a: string, b: string, places: number): string | null {
    const x = parseSignedWork(a);
    const y = parseSignedWork(b);
    if (x === null || y === null) return null;
    return formatWork(x - y, Math.max(0, Math.min(places, WORK)), false);
}

/** a × b rounded to `places` (half-up). */
export function multiplyDecimal(a: string, b: string, places: number, grouping = false): string | null {
    const x = parseSignedWork(a);
    const y = parseSignedWork(b);
    if (x === null || y === null) return null;
    return formatWork((x * y) / WORK_ONE, Math.max(0, Math.min(places, WORK)), grouping);
}

/** a ÷ b rounded to `places` (half-up). Returns null when b is zero or either input is invalid. */
export function divideDecimal(a: string, b: string, places: number): string | null {
    const x = parseSignedWork(a);
    const y = parseSignedWork(b);
    if (x === null || y === null || y === 0n) return null;
    return formatWork((x * WORK_ONE) / y, Math.max(0, Math.min(places, WORK)), false);
}

/**
 * Multiplies by 10^places exactly (negative places divide). Used for probability ↔ percent and
 * dollars ↔ cents without going through a float.
 *
 * shiftDecimal('0.6812', 2, 1) === '68.1'
 */
export function shiftDecimal(value: string, shift: number, places: number): string | null {
    const scaled = parseSignedWork(value);
    if (scaled === null) return null;
    const factor = 10n ** BigInt(Math.abs(shift));
    const shifted = shift >= 0 ? scaled * factor : scaled / factor;
    return formatWork(shifted, Math.max(0, Math.min(places, WORK)), false);
}

/** Signed comparison helper that accepts only decimal strings. */
export function signedDecimalSign(value: string): -1 | 0 | 1 | null {
    const scaled = parseSignedWork(value);
    if (scaled === null) return null;
    return scaled === 0n ? 0 : scaled < 0n ? -1 : 1;
}

/** Rounds a decimal string half-up to `places` (no grouping). */
export function roundDecimal(value: string, places: number): string | null {
    return formatDecimal(value, places, false);
}
