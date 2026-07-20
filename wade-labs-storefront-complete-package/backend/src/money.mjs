/** Integer-money helpers. All monetary amounts are integer cents. */

export function assertIntegerCents(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer number of cents`);
  }
}

export function assertBps(value, name) {
  if (!Number.isInteger(value) || value < 0 || value >= 10_000) {
    throw new TypeError(`${name} must be an integer from 0 through 9999 basis points`);
  }
}

export function ceilDiv(numerator, denominator) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) {
    throw new TypeError('ceilDiv requires safe integer inputs and a positive denominator');
  }
  return Math.floor((numerator + denominator - 1) / denominator);
}

export function applyBpsCeil(cents, bps) {
  assertIntegerCents(cents, 'cents');
  assertBps(bps, 'bps');
  return ceilDiv(cents * bps, 10_000);
}

export function roundUpToEnding(cents, endingCents = 99) {
  assertIntegerCents(cents, 'cents');
  if (!Number.isInteger(endingCents) || endingCents < 0 || endingCents > 99) {
    throw new TypeError('endingCents must be an integer from 0 through 99');
  }
  const dollars = Math.floor(cents / 100);
  const currentEnding = cents % 100;
  if (currentEnding <= endingCents) return dollars * 100 + endingCents;
  return (dollars + 1) * 100 + endingCents;
}

export function sumCents(values, name = 'values') {
  let total = 0;
  for (const value of values) {
    assertIntegerCents(value, name);
    total += value;
    if (!Number.isSafeInteger(total)) throw new RangeError(`${name} exceeds safe integer range`);
  }
  return total;
}
