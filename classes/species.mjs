import { forageDefinitions } from "../definitions/forage.mjs";
import { clamp } from "../util/number.mjs";
import { roundRandom } from "../util/random.mjs";

export default class Species {
  /** @type {string} */ #name;
  /** @type {string[]} */ #diet;
  /** @type {number} */ #fecundity = 1;
  /** @type {number} */ #speed = 0;
  /** @type {number} */ #vision = 0;
  /** @type {number} */ #fat = 0;
  /** @type {number} */ #size = 1;

  /** @type {number} */ #power;
  /** @type {number} */ #appetite;

  get power() { return this.#power; }
  get appetite() { return this.#appetite; }

  constructor({ name, diet, fecundity = 1, speed = 0, fat = 0, size = 1 }) {
    this.#name = name;
    this.#diet = diet;
    this.#fecundity = fecundity;
    this.#speed = speed;
    this.#fat = fat;
    this.#size = size;

    this.initialize();
  }

  initialize() {
    const baseCost = 0.05;
    const sizeCost = this.#size * 0.5;

    let baseDietCosts = 0;
    for (const forageType of this.#diet) {
      const food = forageDefinitions[forageType];
      baseDietCosts += food.adaptationCost;
    }
    const fractionOfDietCostWhichScalesWithSize = 0.8; // The rest is more of a fixed cost for having a more complex digestive system, which is less significant for larger animals
    const dietCosts = baseDietCosts * (fractionOfDietCostWhichScalesWithSize * this.#size + (1 - fractionOfDietCostWhichScalesWithSize));

    const speedCost = this.#speed * 0.0; // Disabled until speed actually does anything
    const fecundityCost = (this.#fecundity - 1)/10;
    const abilities = speedCost + fecundityCost;
    
    const fatCost = Math.sqrt(this.#fat)/200;
    const total = baseCost + sizeCost + dietCosts + abilities * this.#size + fatCost; // Fat cost does not scale with size
    this.#power = total / 3;

    if (isNaN(this.#power)) {
      console.log('Error: species power is NaN');
      console.log('species:', this.#name);
      console.log('diet size:', this.#diet.length);
      console.log('abilities:');
      console.log('  speed:', this.#speed, speedCost);
      console.log('  fat:', this.#fat, fatCost);
      console.log('  fecundity:', this.#fecundity, fecundityCost);
      console.log('size:', this.#size);
    }

    this.#appetite = Math.ceil(this.#size ** 0.9 + 0.01);
  }

  getInitialPopulation() {
    const energyBudget = 1000;

    let population = Math.floor(energyBudget / this.#power);
    if (population < 2) population = 2; // Minimum population of 2 to allow for reproduction

    const cost = population * this.#power;
    let leftoverEnergy = energyBudget - cost;

    if (leftoverEnergy < 0) leftoverEnergy = 0;

    return { population, leftoverEnergy };
  }

  getInitialFatPercentage() {
    if (!this.canStoreFat()) return 0;

    const { population, leftoverEnergy } = this.getInitialPopulation();
    const totalFatCapacity = population * this.getFatCapacityPerMember();
    const freeStartingFat = 0.1;
    const fatPercentage = leftoverEnergy / totalFatCapacity + freeStartingFat;

    return clamp(fatPercentage, 0, 1);
  }

  toString() {
    return this.#name;
  }

  getEnergyUpkeep() {
    return this.#power;
  }

  canStoreFat() {
    return this.#fat > 0;
  }

  getFatCapacityPerMember() {
    if (!this.canStoreFat()) return 0;
    return this.#fat * this.#size;
  }

  /**
   * @param {number} energyDeficit
   * @return {number} deaths from energy deficit
   */
  getDeathsFromEnergyDeficit(energyDeficit, randomFn = Math.random) {
    if (energyDeficit <= 0) return 0; // No deficit, no deaths

    const deathFraction = energyDeficit / this.#power / 4;
    return roundRandom(deathFraction, randomFn);
  }

  getBirthEnergyCost() {
    return this.#power * 8;
  }

  getFecundityMultiplier() {
    return this.#fecundity / Math.sqrt(this.#size);
  }

  /**
   * @return {number} energy provided by eating 1 member of this species as food for predators
   */
  getFoodValue() {
    const predationEfficiency = 3/4;
    return this.getBirthEnergyCost() * predationEfficiency;
  }

  getCarrionPerStarvationDeath() {
    const starvationCarrionEfficiency = 4/5;
    return this.getFoodValue() * starvationCarrionEfficiency / forageDefinitions.carrion.energy;
  }

  /**
   * @param {string} forageType A forage type name
   * @return {boolean} whether this species can eat that food
   */
  canEat(forageType) {
    const food = forageDefinitions[forageType];

    if (!this.#diet.includes(forageType)) {
      return false;
    }

    return true;
  }

  isMobile() {
    return this.#speed > 0;
  }

  /**
   * @param {string} forageType A forage type name
   * @return {number} energy yield per unit of food, adjusted for any stat penalties
   */
  getEnergyYield(forageType) {
    const food = forageDefinitions[forageType];
    const baseEnergy = food.energy;

    let searchPenalty = 1;
    if (this.isMobile() && food.vision > this.#vision) {
      searchPenalty += food.vision - this.#vision;
    }

    return baseEnergy / searchPenalty;
  }

  /**
   * Returns a species parameter determining how a population of this species
   * splits its food consumption bids between foods based on score.
   * Higher pickyness means more skewed towards higher score foods.
   * @returns {number} In the range (0 .. Infinity), where 1 means proportional to score, <1 means more even, and >1 means more skewed towards higher score foods.
   */
  getPickyness() {
    return 1; // TODO
  }
}