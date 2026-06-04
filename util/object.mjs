import { isNumber } from "./util.mjs";

/**
 * @param {Object<string, number>} obj
 * @returns {number} Sum of all numeric values in the object
 */
export function sumObjectValues(obj) {
  let total = 0;

  for (const key in obj) {
    const value = obj[key];
    if (isNumber(value)) total += value;
  }

  return total;
}

/**
 * @param {Object<string, number>} obj 
 * @returns {Object<string, number>} New object with values normalized to sum to 1
 */
export function normalizeObject(obj) {
  const total = sumObjectValues(obj);

  const normalized = {};
  for (const key in obj) {
    normalized[key] = obj[key] / total;
  }

  return normalized;
}

/**
 * @param {Object<string, *>} obj
 * @param {(key: string, value: *) => boolean} predicate
 * @returns {Object<string, *>} New object with only the key-value pairs that pass the predicate
 */
export function filterObject(obj, predicate) {
  const filtered = {};

  for (const key in obj) {
    const value = obj[key];
    if (predicate(key, value)) filtered[key] = value;
  }

  return filtered;
}

/**
 * @template T
 * @param {Object<string, *>} obj
 * @param {(key: string, value: *, obj: Object<string, *>) => T | undefined} mapFn
 * @returns {Object<string, T>} New object with keys from the original object and values from the map function, excluding any pairs where the map function returns undefined
 */
export function mapObjectValues(obj, mapFn, { inPlace = false } = {}) {
  const mapped = inPlace ? obj : {};

  for (const key in obj) {
    const value = mapFn(key, obj[key], obj);
    if (value !== undefined) mapped[key] = value;
  }

  return mapped;
}

/**
 * @template T
 * @param {string[]} arr
 * @param {(key: string, index: number, array: string[]) => T | undefined} mapFn
 * @returns {Object<string, T>} New object with keys from the array and values from the map function, excluding any pairs where the map function returns undefined
 */
export function mapArrayValuesToObject(arr, mapFn) {
  const obj = {};

  for (let i = 0; i < arr.length; i++) {
    const key = arr[i];
    const value = mapFn(arr[i], i, arr);
    if (value !== undefined) obj[key] = value;
  }

  return obj;
}

/** Fetches an element from within a POJO object.
 * Similar to using the syntax obj[key], except if
 * key contains one or more dots (.) then it will
 * be treated as nested keys within a multi-level
 * object. If any intermediate keys are nullish,
 * that nullish value will be returned early.
 *
 * @param {object} obj
 *      The object from which to retrieve a key.
 * @param {!string} key
 *      The key to retrieve from the object.
 * @param {boolean} [tryForNonObject=false]
 *      Optional ovverride to attempt dereference
 *      on non-object types (e.g. a class and its
 *      static members, typeof class === 'function').
 *
 * @return {any}
 */
export function dereference(obj, key, tryForNonObject = false) {
  if (!obj || (typeof obj !== 'object' && !tryForNonObject)) return obj;
  if (!key.includes('.')) return obj[key];

  const tokens = key.split('.');
  for (const token of tokens) {
    obj = obj[token];
    if (obj == null) return obj;
  }

  return obj;
}