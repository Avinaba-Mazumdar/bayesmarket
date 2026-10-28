/**
 * Financial and temporal formatting for BayesMarket. Amounts are canonical decimal strings from the API
 * and are formatted exactly (no binary floats): see decimal.ts.
 */

import { formatDecimal } from './decimal';

/** Puts a leading minus sign before the currency symbol: "-$1.00", not "$-1.00". */
function withCurrency(formatted: string): string {
    return formatted.startsWith('-') ? `-$${formatted.slice(1)}` : `$${formatted}`;
}

/**
 * Formats a USDC amount into a currency string (e.g. "$1,000.00").
 */
export function formatUSDC(val: string | number | null | undefined, fractionDigits = 2): string {
    const formatted = formatDecimal(String(val ?? ''), fractionDigits, true);
    return formatted === null ? '$0.00' : withCurrency(formatted);
}

/**
 * Formats an outcome share balance (e.g. "1,250.00").
 */
export function formatShares(val: string | number | null | undefined, fractionDigits = 2): string {
    return formatDecimal(String(val ?? ''), fractionDigits, true) ?? '0.00';
}

/**
 * Formats a unit probability price (e.g. "0.7200") as "$0.7200".
 */
export function formatPrice(val: string | number | null | undefined, fractionDigits = 4): string {
    const formatted = formatDecimal(String(val ?? ''), fractionDigits, false);
    return formatted === null ? '$0.0000' : withCurrency(formatted);
}

/**
 * Formats an ISO-8601 timestamp string into a localized time string (e.g. "10:42:15 AM").
 */
export function formatTimestamp(isoStr?: string | null): string {
    if (!isoStr) {
        return 'just now';
    }
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) {
        return 'just now';
    }
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
