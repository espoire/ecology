export const TAU = 2 * Math.PI;

/** Large number formatter.
 * Converts large integers like 1234567 to user-readable '1.2M' notation.
 *
 * Minor edit of nFormatter (https://stackoverflow.com/a/9462382)
 * by Salman A (https://stackoverflow.com/users/87015/salman-a)
 *
 * @param {number} num
 * @param {number} [decimalPlaces]
 * @returns {string}
 */
export function formatLargeNumber(num, decimalPlaces = 1) {
  const lookup = [
    { value: 1, symbol: '' },
    { value: 1e3, min: 1e4, symbol: 'k' },
    { value: 1e6, symbol: 'M' },
    { value: 1e9, symbol: 'G' },
    { value: 1e12, symbol: 'T' },
    { value: 1e15, symbol: 'P' },
    { value: 1e18, symbol: 'E' },
  ];
  const regexp = /\.0+$|(?<=\.[0-9]*[1-9])0+$/;
  const item = lookup.findLast(item => num >= (item.min ?? item.value));
  return item ?
      (num / item.value).toFixed(decimalPlaces).replace(regexp, '').concat(item.symbol)
    : '0';
}

/**
 * Small number formatter.
 * For numbers for which that would produce sane results, acts like Number.toFixed().
 * Auto-increases the number of decimal places for very small numbers, so that the result is never just '0.0' or similar.
 * 
 * @param {number} num
 * @param {number} [sigfigs]
 * @return {string}
 */
export function formatSmallNumber(num, sigfigs = 2, trimTrailingZeros = true) {
  if (num === 0) return '0';

  const absNum = Math.abs(num);
  const magnitude = Math.floor(Math.log10(absNum));
  const adjustedDecimalPlaces = sigfigs - magnitude - 1;

  const result = num.toFixed(Math.max(0, adjustedDecimalPlaces));
  return trimTrailingZeros && result.includes('.') ? result.replace(/\.0+$|0+$/, '') : result;
}

/**
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number} The closest number in the range [min .. max] to the target value.
 */
export function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}