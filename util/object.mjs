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