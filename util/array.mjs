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