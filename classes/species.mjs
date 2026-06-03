import Constants from "../constants.mjs";
import { forageDefinitions } from "../definitions/forage.mjs";
import meat from "../definitions/meat.mjs";
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
  /** @type {boolean} */ #venom = false;
  /** @type {boolean} */ #antivenom = false;
  /** @type {boolean} */ #flying = false;
  /** @type {boolean} */ #reach = false;

  /** @type {number} */ #power;
  /** @type {number} */ #appetite;

  get name() { return this.#name; }
  get power() { return this.#power; }
  get appetite() { return this.#appetite; }

  /**
   * @param {string} name
   * @param {string[]} diet Array of forage type names that this species can eat
   * @param {number} fecundity
   * @param {number} weapons
   * @param {number} armor
   * @param {number} speed
   * @param {number} fat
   * @param {number} size
   * @param {'venom' | 'anti-venom' | null} venom
   * @param {boolean} flying
   * @param {boolean} reach
   */
  constructor({ name, diet, fecundity = 1, weapons = 0, armor = 0, speed = 0, fat = 0, size = 1, venom = null, flying = false, reach = false }) {
    this.#name = name;
    this.#diet = diet;
    this.#fecundity = fecundity;
    this.#weapons = weapons;
    this.#armor = armor;
    this.#speed = speed;
    this.#fat = fat;
    this.#size = size;
    this.#flying = flying;
    this.#reach = reach;

    if (venom === 'venom') {
      this.#venom = true;
      this.#antivenom = true;
    } else if (venom === 'anti-venom') {
      this.#antivenom = true;
    }

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

    const fractionOfVenomCostWhichScalesWithSize = 0.9; // Venom and resistance is somewhat cheaper for larger animals
    const baseVenomCost = (this.#venom ? 2 : 0) + (this.#antivenom ? 2 : 0);
    const venomCost = baseVenomCost * (fractionOfVenomCostWhichScalesWithSize * this.#size + (1 - fractionOfVenomCostWhichScalesWithSize));

    const fractionOfFlyingCostWhichScalesWithSize = 1.5; // Flying is much more expensive for larger animals
    const baseFlyingCost = this.#flying ? 1.5 : 0; // Flying is cheaper than an equivalent amount of speed
    const flyingCost = baseFlyingCost * (fractionOfFlyingCostWhichScalesWithSize * this.#size + (1 - fractionOfFlyingCostWhichScalesWithSize));
    
    const fractionOfArmorCostWhichScalesWithSize = 0.75; // Armor is relatively cheaper for larger animals
    const baseArmorCost = this.#armor * 0.75; // Armor is innately cheaper than weapons
    const flyingArmorCostMultiplier = this.#flying ? 2.5 : 1; // Flying animals pay way more for armor
    const armorCost = baseArmorCost * (fractionOfArmorCostWhichScalesWithSize * this.#size + (1 - fractionOfArmorCostWhichScalesWithSize)) * flyingArmorCostMultiplier;

    const weaponsCost = this.#weapons;
    const speedCost = this.#speed;
    const fecundityCost = (this.#fecundity - 1)/10;
    const reachCost = this.#reach ? 1 : 0; // Reach negates flying, and is cheaper than flying
    const abilitiesBaseCost = weaponsCost + speedCost + fecundityCost + reachCost;
    const abilitiesCost = abilitiesBaseCost * this.#size;
    
    const baseFatCost = Math.sqrt(this.#fat)/200;
    const flyingFatCostMultiplier = this.#flying ? 2.5 : 1; // Flying animals pay more for fat storage since it's extra weight to carry
    const fatCost = baseFatCost * flyingFatCostMultiplier;

    const total = baseCost + sizeCost + dietCosts + armorCost + abilitiesCost + fatCost; // Fat cost does not scale with size
    this.#power = total / 3;

    if (isNaN(this.#power)) {
      console.log('Error: species power is NaN');
      console.log('species:', this.#name);
      console.log('diet size:', this.#diet.length);
      console.log('abilities:');
      console.log('  speed:', this.#speed, speedCost);
      console.log('  fat:', this.#fat, baseFatCost);
      console.log('  fecundity:', this.#fecundity, fecundityCost);
      console.log('size:', this.#size);
    }

    this.#appetite = this.#size ** 0.9 + 0.01;
  }

  getInitialPopulation() {
    const energyBudget = 500;

    let population = Math.floor(energyBudget / this.getBirthEnergyCost());
    if (population < 2) population = 2; // Minimum population of 2 to allow for reproduction

    const cost = population * this.getBirthEnergyCost();
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

    const daysUpkeepBehind = energyDeficit / this.#power;
    const deathFraction = daysUpkeepBehind / Constants.energy.deathPowerDays;
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

  getBaseMeatEnergyWithoutFat() {
    const predationEfficiency = Constants.predation.efficiency;
    const bodyEnergy = this.getBirthEnergyCost() * predationEfficiency;
    return bodyEnergy;
  }

  getBaseMeatVolumeWithoutFat() {
    const meatEnergy = this.getBaseMeatEnergyWithoutFat();
    const energyPerUnitMeat = meat.energy;
    return meatEnergy / energyPerUnitMeat;
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
    if (otherSpecies.#venom && !this.#antivenom) return { able: false, reason: "Need anti-venom to prey on venomous species" };

    const sizeRatio = this.#size / otherSpecies.#size;
    const logSizeDifference = Math.log2(sizeRatio) / 2; // Being 4x bigger than the prey gives a +1 bonus, being 4x smaller gives a -1 penalty
    const mySizeBonus = Math.max(0, logSizeDifference); // Being bigger than the prey helps
    const preySizeBonus = Math.max(0, -logSizeDifference); // Being smaller than the prey hurts

    if (this.#venom && !otherSpecies.#antivenom) {
      // Venom check: if I have working venom, can I beat the prey's armor?
      const venomCombatPower = 1; // Equivalent to having 1 extra weapons for the purposes of overcoming armor
      const myCombatPower = this.#weapons + venomCombatPower + mySizeBonus;
      const preyCombatPower = otherSpecies.#armor + preySizeBonus;
      if (myCombatPower <= preyCombatPower) {
        return {
          able: false,
          reason: `Insufficient combat power, even with venom: ${formatSmallNumber(myCombatPower)} (${this.#weapons} weapons + ${venomCombatPower} venom + ${formatSmallNumber(mySizeBonus)} relative size) vs ${formatSmallNumber(preyCombatPower)} (${otherSpecies.#armor} armor + ${formatSmallNumber(preySizeBonus)} relative size)`,
        };
      }
    } else {
      // Weapons check: can I beat the prey's weapons+armor?
      const myCombatPower = this.#weapons + mySizeBonus;
      let preyCombatPower = otherSpecies.#weapons + otherSpecies.#armor;
      if (preyCombatPower > 0) preyCombatPower += preySizeBonus; // Size does not matter if the prey has no defenses, but if it does, being bigger helps
      if (myCombatPower <= preyCombatPower) return {
        able: false,
        reason: `Insufficient combat power: ${formatSmallNumber(myCombatPower)} (${this.#weapons} weapons + ${formatSmallNumber(mySizeBonus)} relative size) vs ${formatSmallNumber(preyCombatPower)} (${otherSpecies.#weapons} weapons + ${otherSpecies.#armor} armor + ${formatSmallNumber(preySizeBonus)} relative size)`,
      };
    }


    // Speed check: can I catch the prey?
    const mySpeedScore = this.#speed;
    let preyFlyingBonus = 0;
    if (otherSpecies.#flying && !this.#flying && !this.#reach) preyFlyingBonus = 2; // Flying is a big advantage against non-flying predators, defensively
    const preySpeedScore = otherSpecies.#speed + preyFlyingBonus;
    if (mySpeedScore < preySpeedScore) return {
      able: false,
      reason: `Insufficient speed: ${mySpeedScore} vs ${preySpeedScore} ${preyFlyingBonus ? ` (${otherSpecies.#speed} speed + ${preyFlyingBonus} flying)` : ''}`,
    };

    // Meat yield check: is the prey worth hunting?
    const meatVolume = otherSpecies.getBaseMeatVolumeWithoutFat();
    const perMemberAppetite = this.#appetite;
    const satiationFraction = meatVolume / perMemberAppetite;
    if (satiationFraction < Constants.predation.minimumSatiationFraction) return {
      able: false,
      reason: `Prey not worth hunting: provides ${formatSmallNumber(satiationFraction * 100)}% of a predator's appetite, which is below the minimum threshold of ${Constants.predation.minimumSatiationFraction * 100}%`,
    };

    return { able: true };
  }
}