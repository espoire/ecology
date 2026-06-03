import { isNumber } from "./util.mjs";

/**
 * @template K
 * @param {Map<K, number>} map
 * @returns {number} Sum of all numeric values in the map
 */
export function sumMapValues(map) {
  let total = 0;

  if (map) for (const value of map.values()) {
    if (isNumber(value)) total += value;
  }

  return total;
}

/**
 * @template K
 * @param {Map<K, number>} map 
 * @returns {Map<K, number>} New Map with values normalized to sum to 1
 */
export function normalizeMap(map) {
  const total = sumMapValues(map);

  const normalized = new Map();
  for (const [key, value] of map.entries()) {
    normalized.set(key, value / total);
  }

  return normalized;
}

/**
 * @template K, V
 * @param {K[]} arr
 * @param {(key: K, index: number, array: K[]) => V | undefined} mapFn
 * @returns {Map<K, V>} New Map with keys from the array and values from the map function, excluding any pairs where the map function returns undefined
 */
export function mapArrayValuesToMap(arr, mapFn) {
  const map = new Map();

  for (let i = 0; i < arr.length; i++) {
    const key = arr[i];
    const value = mapFn(arr[i], i, arr);
    if (value !== undefined) map.set(key, value);
  }

  return map;
}

/**
 * @template K, V, U
 * @param {Map<K, V>} map
 * @param {(value: V, key: K, map: Map<K, V>) => U | undefined} mapFn
 * @returns {Map<K, U>} New Map with the same keys but values transformed by the map function, excluding any pairs where the map function returns undefined
 */
export function mapMapValues(map, mapFn, { inPlace = false } = {}) {
  const newMap = inPlace ? map : new Map();

  for (const [key, value] of map.entries()) {
    const newValue = mapFn(value, key, map);
    if (newValue !== undefined) newMap.set(key, newValue);
  }

  return newMap;
}