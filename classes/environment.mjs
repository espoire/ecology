import Constants from "../constants.mjs";
import { forageDefinitions } from "../definitions/forages.mjs";
import { forage, water } from "../definitions/names.mjs";
import Settings from "../settings.mjs";
import { clamp, formatLargeNumber } from "../util/number.mjs";
import { mapObjectValues } from "../util/object.mjs";
import { bellRandom } from "../util/random.mjs";
import Biome from "./biome.mjs";

function rollSpawnRandomness() {
  return bellRandom(Constants.forage.spawnVariance, 1);
}

export default class Environment {
  /** @type {Biome} */ #biome;
  /** @type {Object<string, number>} foodType:number */ #forageStocks;
  /** @type {Object<string, number>} foodType:number */ #forageSpawnsToday = {};
  /** @type {number} */ #pendingDung = 0;

  /** @param {string} biomeId */
  constructor(biomeId) {
    this.#biome = new Biome(biomeId);
    this.#forageStocks = mapObjectValues(forageDefinitions, () => 0);
  }

  get cover() { return this.#biome.cover; }
  get food() { return structuredClone(this.#forageStocks); }

  /**
   * @param {number} day
   * @param {number} multiplier
   * @returns {Object<string, number>} An object where keys are forage types and values are the amounts of those forages that spawned today
   */
  spawnDailyForage(day, multiplier = 1) {
    const plentifulness = rollSpawnRandomness(); // Random multiplier for resource spawn each day to create good and bad days for the population

    const spawns = this.getModifiedForageSpawn(day);

    // Regenerate resources
    for (const key in spawns) {
      const amount = spawns[key];
      const roll = rollSpawnRandomness();
      const spawnAmount = Math.max(0, amount * multiplier * plentifulness * roll * Settings.tuning.resourceSpawnMultiplier);
      this.#spawnForage(key, spawnAmount);
    }
  }

  /**
   * @param {string} type A forage type key
   * @param {number} amount
   */
  #spawnForage(type, amount) {
    this.#forageStocks[type] += amount;
    this.#forageSpawnsToday[type] = (this.#forageSpawnsToday[type] ?? 0) + amount; // Store today's forage spawns for export/debugging purposes
  }

  /** @param {number} day */
  getModifiedForageSpawn(day) {
    return this.#biome.getModifiedForageSpawn(day);
  }

  /** @param {number} amount */
  spawnCarrion(amount) {
    this.#spawnForage(forage.carrion, amount);
  }

  /**
   * @param {Object<string, number>} demand 
   * @returns {Object<string, number>} A new object with the same keys as `demand` where the value is the portion of that demand that can be satisfied with available resources in the range [0 .. 1]
   */
  getForageSatisfaction(demand = {}) {
    const satisfaction = {};

    for (const food in demand) {
      const demanded = demand[food];
      if (demanded == 0) continue; // Intentionally include nullish
  
      // Satisfaction is the portion of demand that can be met with available resources
      const availableRatio = this.#forageStocks[food] / demanded;
      satisfaction[food] = clamp(availableRatio, 0, 1);
    }

    return satisfaction;
  }

  /**
   * @param {Object<string, number>} consumption
   * @mutates {number} this.#pendingDung - Increments the pending dung based on the amounts of forages consumed, and those forages' dung multipliers
   */
  consumeForages(consumption = {}) {
    for (const food in consumption) {
      this.#forageStocks[food] -= consumption[food];
      const dung = consumption[food] * (forageDefinitions[food].dung ?? 0);
      this.scheduleDungSpawn(dung, food);
    }
  }

  /**
   * @param {number} amount
   * @param {string} foodType
   */
  scheduleDungSpawn(amount, foodType = '') {
    this.#pendingDung += amount;
      
    if (Settings.log.dungProduction && amount > 0) {
      console.log(`Scheduled ${formatLargeNumber(amount)} dung from eating ${foodType}`);
    }
  }

  spawnDung() {
    const dungToSpawn = this.#pendingDung;
    this.#pendingDung = 0;
    this.#spawnForage(forage.dung, dungToSpawn);
  }

  cleanup() {
    // Cast stock counts to natural numbers.
    for (const food in this.#forageStocks) {
      this.#forageStocks[food] = Math.max(0, Math.ceil(this.#forageStocks[food]));
    }

    // Reset forage spawn logs
    this.#forageSpawnsToday = {};
  }

  rot() {
    for (const food in this.#forageStocks) {
      const rotSpeed = (forageDefinitions[food].rotSpeed ?? 1);
      const rot = 1 - 0.01 * rotSpeed;
      this.#forageStocks[food] = this.#forageStocks[food] * rot;
    }
  }

  /**
   * @returns {Object<string, number>} An object forageType:amount describing the forages that spawned today
   */
  endOfDay() {
    this.rot();
    this.spawnDung(); // Spawn dung after daily rot, so that dung produced today won't rot until tomorrow, giving it a chance to be eaten
    const ret = this.#forageSpawnsToday;
    this.cleanup();

    return ret;
  }

  listAvailableForageTypes() {
    const ret = [];

    for (const food in this.#forageStocks) {
      const stock = this.#forageStocks[food];
      if (stock > 0) ret.push(food);
    }

    return ret;
  }



  // #region Logging

  logState({ verbose = false } = {}) {
    let prefix = '';

    if (verbose) {
      console.log();
      console.log('Environment:');
      console.log(`  Biome: ${this.#biome.name}`);
      console.log('  Forage:');
      prefix = '  ';
    }
    
    for (const food in this.#forageStocks) {
      const amount = this.#forageStocks[food];
      if (amount > 0)  console.log(`${prefix}- ${food}: \t${amount.toFixed(0)}`);
    }
  }
}