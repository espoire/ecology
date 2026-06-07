import Constants from "../constants.mjs";
import { climates } from "../definitions/climates.mjs";
import Settings from "../settings.mjs";
import { TAU } from "../util/number.mjs";

export default class Climate {
  /** @type {string} */
  #name;

  /** @type {Object<string, Object<string, number>>} POJO map forageType:season:number */
  #forage;

  /**
   * @param {string} climateName The key of the climate config in the `climates` definitions object.
   */
  constructor(climateName) {
    const id = climateName ?? Constants.climate.default;
    let config = climates[id];

    if (!config && Settings.log.omittedClimate) console.warn(`Climate "${climateName}" is not defined. Defaulting to "${Constants.climate.default}".`);
    if (!config) config = climates[Constants.climate.default];

    const { name, forage } = config;

    this.#name = name;
    this.#forage = structuredClone(forage);
  }

  /**
   * @param {number} day
   * @returns {{ spring?: number, summer?: number, autumn?: number, winter?: number }} season weights, with 1 or 2 keys present
   * Conceptually, the current season is almost always a linear combination of two adjacent seasons, where their weights add to 1.
   */
  static getSeason(day) {
    const yearLength = Constants.seasons.yearLength;
    const yearProgress = (day % yearLength) / yearLength;

    const sine = Math.sin(yearProgress * TAU);
    const slope = Math.cos(yearProgress * TAU);

    if (sine === 1) return { summer: 1 };
    if (sine === -1) return { winter: 1 };
    if (slope === 1) return { spring: 1 };
    if (slope === -1) return { autumn: 1 };

    const springOrAutumn = slope > 0 ? 'spring' : 'autumn';
    const summerOrWinter = sine > 0 ? 'summer' : 'winter';

    let summerOrWinterWeight = Math.abs(sine);
    let springOrAutumnWeight = 1 - summerOrWinterWeight;

    return {
      [springOrAutumn]: springOrAutumnWeight,
      [summerOrWinter]: summerOrWinterWeight,
    };
  }

  /**
   * 
   * @param {{ spring?: number, summer?: number, autumn?: number, winter?: number }} seasons As returned by Climate.getSeason()
   * @param {string} forageType
   * @returns {number} forage spawn modifier
   */
  getForageSpawnModifier(seasons, forageType) {
    const forageWeightsBySeason = this.#forage[forageType];
    if (!forageWeightsBySeason) return 0;

    let modifier = 0;
    for (const [season, seasonWeight] of Object.entries(seasons)) {
      const forageWeight = forageWeightsBySeason[season] ?? 0;
      modifier += forageWeight * seasonWeight;
    }

    return modifier;
  }

  /**
   * @param {number} day
   * @param {Object<string, number>} forageBaseRates
   * @returns {Object<string, number>} modified forage spawn rates
   */
  getModifiedForageSpawn(day, forageBaseRates) {
    const seasons = Climate.getSeason(day);
    const modifiedRates = {};

    for (const [forageType, baseRate] of Object.entries(forageBaseRates)) {
      const modifier = this.getForageSpawnModifier(seasons, forageType);
      modifiedRates[forageType] = baseRate * modifier;
    }

    return modifiedRates;
  }
}