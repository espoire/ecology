import Constants from "../constants.mjs";
import { biomeDefinitions } from "../definitions/biomes.mjs";
import Settings from "../settings.mjs";
import Climate from "./climate.mjs";

export default class Biome {
  /** @type {string} */ #name;
  /** @type {Climate} */ #climate;
  /** @type {Object<string, number>} forageType:number */ #forage;
  /** @type {number} */ #cover;

  get climate() { return this.#climate; }
  get forage() { return this.#forage; }
  get cover() { return this.#cover; }

  /**
   * @param {string} name The biome's name and unique identifier in the biomes definitions object.
   */
  constructor(name) {
    const config = biomeDefinitions[name];
    if (!config) throw new Error(`Biome "${name}" is not defined.`);
    const { climate, forage = {}, cover = 0 } = config;

    if (!climate && Settings.log.omittedBiomeClimate) console.warn(`Climate was is not defined for biome "${name}". Defaulting to "${Constants.climate.default}".`);

    this.#name = name;
    this.#climate = new Climate(climate);
    this.#forage = forage;
    this.#cover = cover;
  }

  getModifiedForageSpawn(day) {
    return this.climate.getModifiedForageSpawn(day, this.forage);
  }
}