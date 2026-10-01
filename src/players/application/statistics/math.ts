/**
 * Generic, side-effect free numeric helpers.
 * Empty inputs yield `null` rather than `NaN`, so callers must handle them explicitly.
 */

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Middle value of the sorted input; average of the two middle values for an even count. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle]!;
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + upper) / 2 : upper;
}

/** Rounds half away from zero, avoiding binary floating point artefacts (1.005 → 1.01). */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.sign(value) * (Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor);
}
