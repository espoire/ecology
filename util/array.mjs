import { isNumber } from "./util.mjs";

/**
 * @param {number[]} array
 * @returns {number} The total of the numeric array, ignoring any non-numbers. Zero if no numbers are present.
 */
export function sum(array) {
  let total = 0;

  for (let i = 0; i < array?.length; i++) {
    if (isNumber(array[i])) total += array[i];
  }

  return total;
}

/**
 * @param {T[]} arr
 * @returns {T} The first element of the input array.
 */
export function first(arr) {
  return arr[0];
}

/**
 * @param {T[]} arr
 * @returns {T} The last element of the input array.
 */
export function last(arr) {
  return arr.slice(-1)[0];
}

/**
 * @template T
 * @param {number?} count A number of elements to return, or if negative the number of elements to exclude from the tail, or if nullish returns a shallow copy of the entire array.
 * @param {T[]} arr The input array
 * @returns {T[]} Positive count: The first `count` elements of the input array, or the entire array if it is shorter. Negative count: The input array with the last `-count` elements excluded, or an empty array if this would exclude everything.
 */
export function head(count, arr) {
  if (count == null) return arr.slice();
  if (count < 0) {
    if (count + arr.length <= 0) return [];
    count += arr.length;
  }
  return arr.slice(0, count ?? 1);
}

/**
 * @template T
 * @param {number?} count A number of elements to return, or if negative the number of elements to exclude from the head, or if nullish returns a shallow copy of the entire array.
 * @param {T[]} arr The input array
 * @returns {T[]} Positive count: The last `count` elements of the input array, or the entire array if it is shorter. Negative count: The input array with the first `-count` elements excluded, or an empty array if this would exclude everything.
 */
export function tail(count, arr) {
  if (count == null) return arr.slice();
  if (count < 0) {
    if (count + arr.length <= 0) return [];
    count += arr.length;
  }
  return arr.slice(-count);
}

/** Returns a new array containing the argument, or a clone of
 * the argument if it was already an array.
 *
 * @template T
 * @param {T | T[]} maybeArray
 * @returns {T[]} A (shallow) clone of input array, or a new array containing the input value.
 */
export function ensureArray(maybeArray) {
  if (maybeArray === null || maybeArray == undefined) return [];
  if (Array.isArray(maybeArray)) return [...maybeArray];
  return [maybeArray];
}