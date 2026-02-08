/**
 * Decimal utilities for safe money handling
 * All monetary values are stored as strings to preserve precision
 */

/**
 * Parse a decimal string to a number for display/calculation
 */
export function parseDecimal(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a decimal value as currency string
 */
export function formatCurrency(
  value: string | number | undefined | null,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const num = parseDecimal(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a decimal value as a compact currency (e.g., $1.2K)
 */
export function formatCurrencyCompact(
  value: string | number | undefined | null,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  const num = parseDecimal(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(num);
}

/**
 * Format a number as percentage
 */
export function formatPercentage(
  value: number | undefined | null,
  decimals: number = 0
): string {
  if (value === undefined || value === null) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Convert a number to decimal string for API
 */
export function toDecimalString(value: number): string {
  return value.toFixed(2);
}

/**
 * Add two decimal values
 */
export function addDecimals(a: string | number, b: string | number): string {
  return toDecimalString(parseDecimal(a) + parseDecimal(b));
}

/**
 * Subtract two decimal values
 */
export function subtractDecimals(a: string | number, b: string | number): string {
  return toDecimalString(parseDecimal(a) - parseDecimal(b));
}

/**
 * Calculate percentage of value
 */
export function calculatePercentage(value: string | number, total: string | number): number {
  const numValue = parseDecimal(value);
  const numTotal = parseDecimal(total);
  if (numTotal === 0) return 0;
  return (numValue / numTotal) * 100;
}

/**
 * Validate that a string is a valid decimal
 */
export function isValidDecimal(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const regex = /^-?\d+(\.\d{1,2})?$/;
  return regex.test(value);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
