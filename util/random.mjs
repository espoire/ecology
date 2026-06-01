import { sum } from "./array.mjs";

/**
 * Rounds a number to a nearby integer, randomly with probability proportional to the fractional part.
 * Example: 1.2 will become either 1 or 2. 80% will be 1, 20% will be 2.
 * 
 * @param {number} amount - The number to round.
 * @param {() => number} [randomFn] - Optional random function returning a number between 0 and 1.
 * @returns {number} - The rounded integer.
 */
export function roundRandom(amount, randomFn = Math.random) {
  const roll = randomFn();

  if (roll < amount % 1) {
    return Math.ceil(amount);
  } else {
    return Math.floor(amount);
  }
}

export function randFloat(min, max, randomFunc = Math.random) {
  const roll = (randomFunc || Math.random)();
  return roll * (max - min) + min;
}

/** Generates normally-distributed random numbers. Very approximate.
 *
 * | % of Returns | Central X% |
 * | ------------ | ---------- |
 * |        25    |        8.5 |
 * |        50    |       17.9 |
 * |        66    |       25   |
 * |        95    |       50   |
 * |        99.85 |       75   |
 * |       100    |      100   |
 *
 * @param {number} stDev
 * @param {number} mean
 * @param {() => number} randomFunc
 * @returns {number} In the range (5 * stDev * [-1 .. 1] + mean). 95% of returned values fall in the central 50%: the range (2.5 * stDev * [-1 .. 1] + mean).
 */
export function bellRandom(stDev = 1.0, mean = 0.0, randomFunc = Math.random) {
  const rolls = [];

  for (let i = 0; i < 5; i++) {
    const roll = (randomFunc || Math.random)();
    rolls.push(roll * 2 - 1);
  }

  return (sum(rolls) * stDev) + mean;
}

export function randBool(probability = 0.5, randomFunc = Math.random) {
  return randomFunc() < probability;
}