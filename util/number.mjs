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