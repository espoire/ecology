import { forageDefinitions } from "../definitions/forage.mjs";
import { forage } from "../definitions/names.mjs";
import { clamp, formatSmallNumber } from "../util/number.mjs";
import { roundRandom } from "../util/random.mjs";

export default class Species {
  /** @type {string} */ #name;
  /** @type {string[]} */ #diet;
  /** @type {number} */ #fecundity = 1;
  /** @type {number} */ #weapons = 0;
  /** @type {number} */ #armor = 0;
  /** @type {number} */ #speed = 0;
  /** @type {number} */ #fat = 0;
  /** @type {number} */ #size = 1;

  /** @type {number} */ #power;
  /** @type {number} */ #appetite;

  get name() { return this.#name; }
  get power() { return this.#power; }
  get appetite() { return this.#appetite; }

  constructor({ name, diet, fecundity = 1, weapons = 0, armor = 0, speed = 0, fat = 0, size = 1 }) {
    this.#name = name;
    this.#diet = diet;
    this.#fecundity = fecundity;
    this.#weapons = weapons;
    this.#armor = armor;
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

    const weaponsCost = this.#weapons;
    const armorCost = this.#armor * 0.75;
    const speedCost = this.#speed;
    const fecundityCost = (this.#fecundity - 1)/10;
    const abilitiesBaseCost = weaponsCost + armorCost + speedCost + fecundityCost;
    const abilitiesCost = abilitiesBaseCost * this.#size;
    
    const fatCost = Math.sqrt(this.#fat)/200;
    const total = baseCost + sizeCost + dietCosts + abilitiesCost + fatCost; // Fat cost does not scale with size
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
    return food.energy;
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

  /**
   * @returns {{ able: boolean, reason?: string }} Whether this species can be a predator, and if not, the reasons why not.
   */
  canBePredator() {
    if (!this.canEat(forage.carrion)) return { able: false, reason: "Cannot eat meat" }; // Meat-eating required to be a predator
    if (this.#weapons <= 0) return { able: false, reason: "No weapons" }; // No weapons means no predation
    return { able: true };
  }

  /**
   * @param {Species} otherSpecies
   * @returns {{ able: boolean, reason?: string }} Whether this species can prey upon the other species, and if not, the reasons why not.
   */
  canPreyUpon(otherSpecies) {
    const canBePredator = this.canBePredator();
    if (!canBePredator.able) return canBePredator;

    if (this === otherSpecies) return { able: false, reason: "No cannibalism" }; // No cannibalism for now

    const sizeRatio = this.#size / otherSpecies.#size;
    const logSizeDifference = Math.log2(sizeRatio) / 2; // Being 4x bigger than the prey gives a +1 bonus, being 4x smaller gives a -1 penalty
    const mySizeBonus = Math.max(0, logSizeDifference); // Being bigger than the prey helps
    const preySizeBonus = Math.max(0, -logSizeDifference); // Being smaller than the prey hurts

    // Weapons check: can I beat the prey's weapons+armor?
    const myCombatPower = this.#weapons + mySizeBonus;
    let preyCombatPower = otherSpecies.#weapons + otherSpecies.#armor;
    if (preyCombatPower > 0) preyCombatPower += preySizeBonus; // Size does not matter if the prey has no defenses, but if it does, being bigger helps
    if (myCombatPower <= preyCombatPower) return {
      able: false,
      reason: `Insufficient combat power: ${formatSmallNumber(myCombatPower)} (${this.#weapons} weapons + ${formatSmallNumber(mySizeBonus)} relative size) vs ${formatSmallNumber(preyCombatPower)} (${otherSpecies.#weapons} weapons + ${otherSpecies.#armor} armor + ${formatSmallNumber(preySizeBonus)} relative size)`,
    };

    // Speed check: can I catch the prey?
    if (this.#speed < otherSpecies.#speed) return {
      able: false,
      reason: `Insufficient speed: ${this.#speed} vs ${otherSpecies.#speed}`,
    };

    return { able: true };
  }
}