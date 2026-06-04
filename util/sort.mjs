import { valueAndType } from './logging.mjs';
import { dereference } from './object.mjs';

/** Generates a sort function for use with Array.prototype.sort().
 * Sorts an array of objects based on the value in one of their keys.
 *
 * @param {string | (any) => *} keyOrMapFn
 *    Either:
 *      The key to sort on. For example, if `key` is "length", then
 *      the resulting sort function will compare objects based on
 *      their .length property.
 *    Or:
 *      A mapping function that takes an object and returns the value
 *      to sort on. For example, if `key` is `obj => obj.length`, then
 *      the resulting sort function will compare objects based on the
 *      value of their .length property.
 * @param {'ascending' | 'descending'} direction
 *    The desired direction of the sort.
 *    Must be either "ascending" or "descending".
 *
 * @return {SortByCompareFn}
 *    A sort function for use with Array.prototype.sort().
 */
export function sortBy(keyOrMapFn, direction) {
  const type = typeof keyOrMapFn;
  if (!['string', 'function'].includes(type)) {
    throw new Error(
      `sortBy() must specify a string key or mapping function. Provided: ${valueAndType(keyOrMapFn)}`
    );
  }
  if (direction !== 'ascending' && direction !== 'descending') {
    throw new Error(
      `sortBy() must specify a sort direction of "ascending" or "descending" only. Provided: ${valueAndType(direction)}`
    );
  }

  const keysOrMappers = [keyOrMapFn];
  const directions = [direction];

  const sortByInner = function sortBy(a, b) {
    for (let i = 0; i < keysOrMappers.length; i++) {
      const aData =
        typeof keysOrMappers[i] === 'string' ?
          dereference(a, keysOrMappers[i])
        : keysOrMappers[i](a);
      const bData =
        typeof keysOrMappers[i] === 'string' ?
          dereference(b, keysOrMappers[i])
        : keysOrMappers[i](b);

      if (aData < bData) return directions[i] === 'ascending' ? -1 : 1;
      if (aData > bData) return directions[i] === 'ascending' ? 1 : -1;
    }
    return 0;
  };

  /**
   * @param {string | (any) => *} nextKeyOrMapFn
   *    Either:
   *      The key to sort on. For example, if `key` is "length", then
   *      the resulting sort function will compare objects based on
   *      their .length property.
   *    Or:
   *      A mapping function that takes an object and returns the value
   *      to sort on. For example, if `key` is `obj => obj.length`, then
   *      the resulting sort function will compare objects based on the
   *      value of their .length property.
   * @param {'ascending' | 'descending'} nextDirection
   *    The desired direction of the sort.
   *    Must be either "ascending" or "descending".
   */
  sortByInner.thenBy = function thenBy(nextKeyOrMapFn, nextDirection) {
    const type = typeof keyOrMapFn;
    if (!['string', 'function'].includes(type)) {
      throw new Error(
        `thenBy() must specify a string key or mapping function. Provided: ${valueAndType(nextKeyOrMapFn)}`
      );
    }
    if (nextDirection !== 'ascending' && nextDirection !== 'descending') {
      throw new Error(
        `thenBy() must specify a sort direction of "ascending" or "descending" only. Provided: ${valueAndType(nextDirection)}`
      );
    }

    keysOrMappers.push(nextKeyOrMapFn);
    directions.push(nextDirection);

    return sortByInner;
  };

  return sortByInner;
}

export const sort = {
  numeric: {
    ascending(a, b) {
      return a - b;
    },
    descending(a, b) {
      return b - a;
    },
  },
  alphabetic: {
    aToZ(a, b) {
      return a.localeCompare(b);
    },
    zToA(a, b) {
      return b.localeCompare(a);
    },
  },
};