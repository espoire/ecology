import Constants from "../constants.mjs";
import { forageDefinitions } from "../definitions/forages.mjs";
import meat from "../definitions/meat.mjs";
import { forage } from "../definitions/names.mjs";
import { getSizeMetadata, maxSizeTier } from "../definitions/sizes.mjs";
import Settings from "../settings.mjs";
import { first, maxBy, sum, tail } from "../util/array.mjs";
import { clamp, formatSmallNumber } from "../util/number.mjs";
import { roundRandom } from "../util/random.mjs";
import { sortBy } from "../util/sort.mjs";

export default class Species {
  /** @type {string} */ #name;
  /** @type {string[]} */ #diet;
  /** @type {number} */ #size = 1;
  /** @type {number} */ #fecundity = 0;
  /** @type {number} */ #weapons = 0;
  /** @type {number} */ #armor = 0;
  /** @type {number} */ #speed = 0;
  /** @type {number} */ #fat = 0;
  /** @type {number} */ #multikill = 0;
  /** @type {boolean} */ #venom = false;
  /** @type {boolean} */ #antivenom = false;
  /** @type {boolean} */ #flying = false;
  /** @type {boolean} */ #reach = false;

  /** @type {number} */ #power;
  /** @type {number} */ #appetite;

  get name() { return this.#name; }
  get size() { return this.#size; }
  get power() { return this.#power; }
  get appetite() { return this.#appetite; }
  get speed() { return this.#speed; }

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
   * @param {number} multikill
   */
  constructor({ name, diet, fecundity = 0, weapons = 0, armor = 0, speed = 0, fat = 0, size = 1, venom = null, flying = false, reach = false, multikill = 1 }) {
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

    if (venom === 'venom') {
      this.#venom = true;
      this.#antivenom = true;
    } else if (venom === 'anti-venom') {
      this.#antivenom = true;
    }

    this.#appetite = this.#size;

    this.initialize();
  }

  initialize() {
    this.initializePower();
    this.logInitializationMaybe();
  }

  initializePower() {
    const baseCost = 0.05;
    const sizeCost = this.#size ** 1.2 * 0.95;

    const sortedDiet = this.#diet.sort(sortBy(f => forageDefinitions[f].adaptationCost, 'descending'));
    const firstDiet = first(sortedDiet);
    const restDiets = tail(-1, sortedDiet);

    const cost = ((forageType) => forageDefinitions[forageType].adaptationCost);
    const firstDietCost = cost(firstDiet) * this.#size;
    
    const additionalDietDiscount = Constants.adaptation.synergies.omnivory;
    const fractionOfAdditionalDietCostWhichScalesWithSize = 0.98; // The rest is more of a fixed cost for having a more complex digestive system, which is less significant for larger animals
    const additionalDietBaseCost = sum(restDiets.map(cost));
    const additionalDietCosts = additionalDietBaseCost * additionalDietDiscount * (fractionOfAdditionalDietCostWhichScalesWithSize * this.#size + (1 - fractionOfAdditionalDietCostWhichScalesWithSize));
    const dietCosts = firstDietCost + additionalDietCosts;

    // This block noncausal, for debug logging only
    const dietPresizeCost = cost(firstDiet) + additionalDietBaseCost * additionalDietDiscount;
    
    const baseFatCost = this.#fat > 0 ? 3 * this.#fat : 0;
    const flyingFatCostMultiplier = this.#flying ? 2.5 : 1; // Flying animals pay more for fat storage since it's extra weight to carry
    const fatCost = baseFatCost * flyingFatCostMultiplier; // Fat cost does not scale with size

    const weaponsCost = this.#weapons * 3 * this.#size;

    const fractionOfArmorCostWhichScalesWithSize = 0.7; // Armor is relatively cheaper for larger animals
    const baseArmorCost = this.#armor * 2; // Armor is innately cheaper than weapons
    const flyingArmorCostMultiplier = this.#flying ? 2.5 : 1; // Flying animals pay way more for armor
    const armorCost = baseArmorCost * (fractionOfArmorCostWhichScalesWithSize * this.#size + (1 - fractionOfArmorCostWhichScalesWithSize)) * flyingArmorCostMultiplier;
    
    // Flying gives a synergy bonus to speed, making it cheaper
    const flyingSpeedSynergy = this.#flying ? 0.9 : 1;
    // 0.9 chosen so that flying-predator almost-but-not-quite breaks even with reach-predator
    // So that flying-predator dominats at speed > 3, reach dominates at speed < 2, and they're debatable at speed = 2 or 3
    // (Predator speed 2: flying is more costly than reach, but you also get the flying defensive benefit, so it's not a clear-cut choice either way.)
    const speedCost = this.#speed * 3 * flyingSpeedSynergy * this.#size;

    const fecundityCost = this.#fecundity * this.#size;

    const reachCost = (this.#reach ? 3 : 0) * this.#size; // Reach negates flying, and is cheaper than flying

    const fractionOfVenomCostWhichScalesWithSize = 0.9; // Venom and resistance is somewhat cheaper for larger animals
    const baseVenomCost = (this.#venom ? 6 : 0) + (this.#antivenom ? 5 : 0);
    const venomCost = baseVenomCost * (fractionOfVenomCostWhichScalesWithSize * this.#size + (1 - fractionOfVenomCostWhichScalesWithSize));

    const baseFlyingCost = this.#flying ? 4 : 0; // Flying is cheaper than an equivalent amount of speed
    const flyingCost = baseFlyingCost * Math.max(this.#size, this.#size ** 2); // Flying scales dramatically with size
    
    const multikillCost = this.#multikill * 4 * this.#size; // [PH] TODO set cost

    const abilitiesCost = weaponsCost + armorCost + speedCost + fecundityCost + reachCost + flyingCost + venomCost + multikillCost;
    const total = baseCost + sizeCost + dietCosts + fatCost + abilitiesCost;

    const sessileBonus = this.#speed === 0 ? 0.95 : 1; // Sessile animals are cheaper to maintain since they don't have to spend energy on movement, so they get a discount on their effective power level
    this.#power = total * Constants.energy.upkeepMultiplier * sessileBonus;

    const aliases = [this.#name, 'all', '*'];
    if (isNaN(this.#power) || aliases.some(alias => Settings.log.species.power.includes(alias))) {
      console.log();
      console.log('species:', this.#name, 'power:', formatSmallNumber(this.#power), 'P');
      console.log('  upkeep:', formatSmallNumber(this.getEnergyUpkeep()), ' P');
      console.log('  birth cost:', formatSmallNumber(this.getBirthEnergyCost()), ' E');
      console.log('  starvation:', formatSmallNumber(this.getDeathEnergy()), ' E');
      console.log();
      console.log('  base:', formatSmallNumber(baseCost), 'E');
      console.log('  size:', `${this.#size}  =  ${formatSmallNumber(sizeCost)} E`);
      console.log('  diet:', `${firstDiet} (${cost(firstDiet)})`, restDiets.length ? ` + ${restDiets.map(f => `${f} (${cost(f)} * ${additionalDietDiscount})`).join(' + ')}` : '' ,` =  ${formatSmallNumber(dietPresizeCost)} E  =>  ${formatSmallNumber(dietCosts)} E after size scaling`);
      if (this.#armor) console.log('  armor:', `${this.#armor} armor`, ` =  ${formatSmallNumber(armorCost)} E`);
      if (this.#fat) console.log('  fat:', `${this.#fat} fat`, ` =  ${formatSmallNumber(fatCost)} E`);
      if (this.#weapons) console.log('  weapons:', `${this.#weapons} weapons`, ` =  ${formatSmallNumber(weaponsCost)} E`);
      if (this.#speed) console.log('  speed:', `${this.#speed} speed`, ` =  ${formatSmallNumber(speedCost)} E`);
      if (this.#fecundity) console.log('  fecundity:', `${this.#fecundity} fecundity`, ` =  ${formatSmallNumber(fecundityCost)} E`);
      if (this.#reach) console.log('  reach: ', `${formatSmallNumber(reachCost)} E`);
      if (this.#flying) console.log('  flying: ', `${formatSmallNumber(flyingCost)} E`);
      if (this.#venom) console.log('  venom: ', `${formatSmallNumber(venomCost)} E`);
      if (this.#multikill) console.log('  multikill: ', `${formatSmallNumber(multikillCost)} E`);
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