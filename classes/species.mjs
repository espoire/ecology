import Constants from "../constants.mjs";
import { adaptations } from "../definitions/adaptations.mjs";
import { forageDefinitions } from "../definitions/forages.mjs";
import meat from "../definitions/meat.mjs";
import { forage } from "../definitions/names.mjs";
import { getSizeMetadata, maxSizeTier } from "../definitions/sizes.mjs";
import Settings from "../settings.mjs";
import { first, maxBy, sum, tail } from "../util/array.mjs";
import { clamp, formatSmallNumber } from "../util/number.mjs";
import { roundRandom } from "../util/random.mjs";
import { sortBy } from "../util/sort.mjs";
import AdaptationCost from "./AdaptationCost.mjs";

export default class Species {
  /** @type {string} */ #name;
  /** @type {string[]} */ #diet;
  /** @type {number} */ #size = 1;
  /** @type {number} */ #fecundity = 0;
  /** @type {number} */ #weapons = 0;
  /** @type {number} */ #armor = 0;
  /** @type {number} */ #speed = 0;
  /** @type {number} */ #fat = 0;
  /** @type {number} */ #keenSenses = 0;
  /** @type {number} */ #crypsis = 0;
  /** @type {number} */ #multikill = 0;
  /** @type {boolean} */ #venom = false;
  /** @type {boolean} */ #antivenom = false;
  /** @type {boolean} */ #flying = false;
  /** @type {boolean} */ #reach = false;

  /** @type {object} A summary object of all the adaptations set to non-cost-free values */ #adaptations;

  /** @type {number} */ #power;
  /** @type {number} */ #appetite;

  get name() { return this.#name; }
  get size() { return this.#size; }
  get power() { return this.#power; }
  get appetite() { return this.#appetite; }
  get speed() { return this.#speed; }

  /**
   * @param {{
   *   name: string,
   *   diet: string[],   // Array of forage type names that this species can eat
   *   fecundity?: number,
   *   weapons?: number,
   *   armor?: number,
   *   speed?: number,
   *   fat?: number,
   *   size?: number,
   *   venom?: 'venom' | 'anti-venom' | null,
   *   flying?: boolean,
   *   reach?: boolean,
   *   multikill?: number,
   *   keenSenses?: number,
   *   crypsis?: number
   * }} config
   */
  constructor(config) {
    const { name, diet, fecundity = 0, weapons = 0, armor = 0, speed = 0, fat = 0, size = 1, venom = null, flying = false, reach = false, multikill = 0, keenSenses = 0, crypsis = 0 } = config;

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
    this.#multikill = multikill;
    this.#keenSenses = keenSenses;
    this.#crypsis = crypsis;

    if (venom === 'venom') {
      this.#venom = true;
      this.#antivenom = true;
    } else if (venom === 'anti-venom') {
      this.#antivenom = true;
    }

    this.#appetite = this.#size;

    this.#adaptations = this.getAllAdaptations(config);

    this.initialize();
  }

  initialize() {
    this.initializePower();
    this.logInitializationMaybe();
  }

  initializePower() {
    const adapts = this.#adaptations;
    const upkeep = AdaptationCost.calculateUpkeep(adapts);
    this.#power = upkeep.total;
    this.#explainUpkeepMaybe(upkeep);
  }

  getAllAdaptations(config) {
    const ret = {};

    for (const key in adaptations) {
      const value = config[key] ?? adaptations[key].default;

      const costFreeValue = adaptations[key].free;
      if (value !== costFreeValue) ret[key] = value;
    }

    if (this.#diet.length > 0) ret.diet = structuredClone(this.#diet);

    return ret;
  }

  /**
   * @param {{
   *   total: number,
   *   subtotal: number,
   *   costs: { type: string, cost: number, base: number, modifiers: { label: string, description?: string, multiplier?: number, flat?: number }[] }[],
   *   modifiers: { label: string, description?: string, multiplier?: number, flat?: number }[]
   * }} explanationObj
   */
  #explainUpkeepMaybe(explanationObj) {
    const aliases = [this.#name, 'all', '*'];
    if (isNaN(this.#power) || aliases.some(alias => Settings.log.species.upkeep.includes(alias))) {
      /** @type {string[]} */
      const explanation = AdaptationCost.explainUpkeep(explanationObj);
      
      console.log();
      console.log(`Upkeep for species '${this.#name}'`);
      for (const line of explanation) console.log(`  ${line}`);
      console.log();
    }
  }

  logInitializationMaybe() {
    const aliases = [this.#name, 'all', '*'];

    if (aliases.some(alias => Settings.log.species.fecundity.includes(alias))) {
      console.log();
      console.log(`Initialized species ${this.#name} with fecundity ${this.#fecundity}`);
      console.log(`  Fecundity multiplier: ${formatSmallNumber(this.getFecundityMultiplier())}`);
      console.log(`    Base: ${formatSmallNumber(Constants.birth.baseRateCap)}`);
      if (this.#fecundity > 0) console.log(`    From fecundity ${this.#fecundity}: x${formatSmallNumber(this.#fecundity + 1)}`);
      if (this.#size !== 1) console.log(`    From size ${this.#size}: x${formatSmallNumber(1/Math.sqrt(this.#size))}`);

      const birthRateCapPercentage = this.getFecundityMultiplier() * 100;
      console.log(`  Birth rate cap: ${formatSmallNumber(birthRateCapPercentage)}% of population per day`);

      const energyPerDayPerMemberToSaturateBirthRate = this.getBirthEnergyCost() * this.getFecundityMultiplier();
      const dailyUpkeep = this.getEnergyUpkeep();
      const saturationPercentageOfUpkeep = energyPerDayPerMemberToSaturateBirthRate / dailyUpkeep * 100;

      console.log(`  Power per member to saturate birth rate: ${formatSmallNumber(energyPerDayPerMemberToSaturateBirthRate)} P`);
      console.log(`  Saturation percentage of upkeep: ${formatSmallNumber(saturationPercentageOfUpkeep)}%`);

      const appetitePerMember = this.#appetite;
      const bestFoodByEnergyYield = this.getBestFoodByEnergyYield();
      const energyPerDayPerMemberAtSaturation = appetitePerMember * bestFoodByEnergyYield.energy;
      const surplusPerMemberAtSaturation = energyPerDayPerMemberAtSaturation - dailyUpkeep;

      console.log(`  Appetite: ${formatSmallNumber(appetitePerMember)} food/day`);
      console.log(`  Best food source: ${bestFoodByEnergyYield.type} (${formatSmallNumber(bestFoodByEnergyYield.energy)} E/food)`);
      console.log(`  Power income if eating ${bestFoodByEnergyYield.type} to saturation: ${formatSmallNumber(energyPerDayPerMemberAtSaturation)} P`);
      console.log(`  Upkeep: ${formatSmallNumber(dailyUpkeep)} P`);
      console.log(`  Surplus power at saturation: ${formatSmallNumber(surplusPerMemberAtSaturation)} P`);

      if (surplusPerMemberAtSaturation < 0.9 * energyPerDayPerMemberToSaturateBirthRate) {
        const isWarn = this.#fecundity > 0;
        const logFn = isWarn ? console.warn : console.log;

        logFn(`  ${isWarn ? 'Warning: ' : ''}Birth rate de facto capped by diet & appetite.`);

        const ratio = surplusPerMemberAtSaturation / energyPerDayPerMemberToSaturateBirthRate;
        const effectiveCap = birthRateCapPercentage * ratio;

        logFn(`    Cap reduced to: ${formatSmallNumber(ratio * 100)}%`);
        logFn(`    Effective birth rate cap: ${formatSmallNumber(effectiveCap)}% of population per day`);

        if (isWarn) {
          const maxEffectiveFecundity = Math.ceil((this.#fecundity + 1) * ratio) - 1;
          if (maxEffectiveFecundity < this.#fecundity) {
            console.error(`      Fecundity above ${maxEffectiveFecundity} provides no additional benefit.`);
            console.error(`      Current fecundity: ${this.#fecundity}`);
            console.error(`      Wasted points: ${this.#fecundity - maxEffectiveFecundity}`);
          }
        }
      } else if (surplusPerMemberAtSaturation > 1.1 * energyPerDayPerMemberToSaturateBirthRate) {
        console.warn(`  Species birth rate capped by fecundity, not diet. Consider adding fecundity points.`);
      }
      console.log();
    }

    if (Settings.log.energyEconomicallyUnderwaterSpecies) {
      const dailyUpkeep = this.getEnergyUpkeep();
      const appetitePerMember = this.#appetite;
      const bestFoodByEnergyYield = this.getBestFoodByEnergyYield();
      const energyPerDayPerMemberAtSaturation = appetitePerMember * bestFoodByEnergyYield.energy;
      const surplusPerMemberAtSaturation = energyPerDayPerMemberAtSaturation - dailyUpkeep;

      if (surplusPerMemberAtSaturation < 0) {
        console.log();
        console.warn(`Species ${this} is economically underwater.`);
        console.warn(`  Appetite: ${formatSmallNumber(appetitePerMember)} food/day`);
        console.warn(`  Best food source: ${bestFoodByEnergyYield.type} (${formatSmallNumber(bestFoodByEnergyYield.energy)} E/food)`);
        console.warn(`  Power income at appetite saturation: ${formatSmallNumber(energyPerDayPerMemberAtSaturation)} P`);
        console.warn(`  Upkeep: ${formatSmallNumber(dailyUpkeep)} P`);
        console.warn(`  Power deficit despite saturation: ${formatSmallNumber(-surplusPerMemberAtSaturation)} P`);

        const percentage = energyPerDayPerMemberAtSaturation / dailyUpkeep * 100;
        console.warn(`  Can only afford ${formatSmallNumber(percentage)}% of upkeep costs, under ideal conditions.`);
      }
    }

    if (Settings.log.subviableStartingPopulations) {
      const minimumViablePopulation = this.getMinimumViablePopulation();
      const initialPopulation = this.getInitialPopulation().population;

      if (initialPopulation < minimumViablePopulation) {
        console.warn(`Species ${this} initial population (${initialPopulation}) is below the minimum viable population (${minimumViablePopulation}).`);
      }
    }
  }

  /**
   * @returns {number} The best possible energy income this species can achieve per member per day.
   */
  getMaximalEnergyIncome() {
    const appetitePerMember = this.#appetite;
    const bestFoodByEnergyYield = this.getBestFoodByEnergyYield();
    return appetitePerMember * bestFoodByEnergyYield.energy;
  }

  getMinimumViablePopulation() {
    const maxIncome = this.getMaximalEnergyIncome();
    const upkeep = this.getEnergyUpkeep();
    const fatCapacity = this.getFatCapacityPerMember();
    const maxEnergyPerMember = maxIncome - upkeep + fatCapacity;

    const birthCost = this.getBirthEnergyCost();

    const minimumPopulation = Math.ceil(birthCost / maxEnergyPerMember);
    return minimumPopulation;
  }

  /**
   * @returns {{ type: 'string', energy: number }}
   */
  getBestFoodByEnergyYield() {
    let foodEnergyYields = this.#diet.map(forageType => ({ type: forageType, energy: this.getEnergyYield(forageType) }));
    if (this.canBePredator().able) foodEnergyYields.push({ type: 'meat', energy: meat.energy }); // If the species can eat carrion, it can also get energy from meat, which is more energy-dense than most forage
    return maxBy(foodEnergyYields, f => f.energy);
  }

  getInitialPopulation() {
    let energyBudget = 1000;
    if (this.canBePredator()) energyBudget /= 2; // Carnivores start at a lower population

    let population = Math.floor(energyBudget / this.getBirthEnergyCost());
    if (population < 2) population = 2; // Minimum population of 2 to allow for reproduction

    const minimumViablePopulation = this.getMinimumViablePopulation();
    const ratio = population / minimumViablePopulation;
    // If initial population is below minimum viable population but within 50% of it, round up to minimum viable population to avoid certain death. This is justified by the fact that the initial population is somewhat arbitrary and not the result of a preceding population growth process that would naturally weed out subviable populations.
    if (population < minimumViablePopulation && ratio >= 0.5) population = minimumViablePopulation;

    const cost = population * this.getBirthEnergyCost();
    let leftoverEnergy = energyBudget - cost;

    if (leftoverEnergy < 0) leftoverEnergy = 0;

    return { population, leftoverEnergy };
  }

  getInitialFatPercentage() {
    if (!this.canStoreFat()) return 0;

    const { population, leftoverEnergy } = this.getInitialPopulation();
    const totalFatCapacity = population * this.getFatCapacityPerMember();
    let freeStartingFat = 0.2;
    if (this.canBePredator().able) freeStartingFat += 0.5; // Predators start with more fat, since they have a harder time finding food at very low population levels and are more likely to experience energy deficits that could lead to premature starvation.
    const fatPercentage = leftoverEnergy / totalFatCapacity + freeStartingFat;

    return clamp(fatPercentage, 0, 1);
  }

  /**
   * @returns {number} The day number on which this species should enter the simulation
   */
  getAppearanceDelay() {
    if (!this.canBePredator().able) return 0; // Herbivores all start on day 0

    // Predators start later, to give herbivores a chance to bootstrap up to more realistic populations, so predators don't all instantly starve
    const maxDelay = Constants.predation.maxSpeciesStartDelay;
    const size = getSizeMetadata(this.#size);
    const sizeTeir = size.index;
    const delay = Math.round(sizeTeir / maxSizeTier * maxDelay);
    return delay;
  }

  toString() {
    return this.#name;
  }

  getBirthEnergyCost() {
    return this.getEnergyUpkeep() * Constants.energy.birthCostDays;
  }

  getEnergyUpkeep() {
    return this.#power;
  }

  getDeathEnergy() {
    return this.getEnergyUpkeep() * Constants.energy.deathPowerDays; // Starvation occurs (probabilistically) when the species falls X many days' upkeep behind.
  }

  canStoreFat() {
    return this.#fat > 0;
  }

  getFatCapacityPerMember() {
    if (!this.canStoreFat()) return 0;
    return 4 ** this.#fat;
  }

  getPredationKillQuota() {
    if (!this.canBePredator().able) return 0;
    return 4 ** this.#multikill;
  }

  /**
   * @param {number} energyDeficit
   * @return {number} deaths from energy deficit
   */
  getDeathsFromEnergyDeficit(energyDeficit, randomFn = Math.random) {
    if (energyDeficit <= 0) return 0; // No deficit, no deaths

    const deathEnergy = this.getDeathEnergy();
    const deaths = energyDeficit / deathEnergy;
    return roundRandom(deaths, randomFn);
  }

  getFecundityMultiplier() {
    return Constants.birth.baseRateCap * (this.#fecundity + 1) / Math.sqrt(this.#size);
  }

  getCarrionPerStarvationDeath() {
    const starvationCarrionEfficiency = 4/5;
    return this.getBaseMeatVolumeWithoutFat() * starvationCarrionEfficiency; // And then it drops as carrion instead of meat, losing another ~half and most of the water.
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
   * @returns {{ able: boolean, reason?: string }} Whether this species can hunt the other species, and if not, the reasons why not.
   */
  canHunt(otherSpecies) {
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
    const kills = this.getPredationKillQuota();
    const meat = meatVolume * kills;
    const satiation = meat / perMemberAppetite;
    if (satiation < Constants.predation.minimumSatiation) return {
      able: false,
      reason: `Prey not worth hunting: provides ${formatSmallNumber(satiation * 100)}% of a predator's appetite${kills > 1 ? ` (over max ${kills} kills)` : ''}, which is below the minimum threshold of ${Constants.predation.minimumSatiation * 100}%`,
    };

    return { able: true };
  }
}