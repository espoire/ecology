/** @typedef {import('./species.mjs').default} Species */
/** @typedef {import('./food-chain.mjs').default} FoodChain */

import Constants from '../constants.mjs';
import { forageDefinitions } from '../definitions/forages.mjs';
import meat from '../definitions/meat.mjs';
import Settings from '../settings.mjs';
import { mapArrayValuesToMap, mapMapValues, normalizeMap } from '../util/map.mjs';
import { clamp, formatLargeNumber, formatSmallNumber } from '../util/number.mjs';
import { filterObject, mapArrayValuesToObject, mapObjectValues, normalizeObject, sumObjectValues } from '../util/object.mjs';
import { bellRandom } from '../util/random.mjs';

/**
 * Manages a population of a single species within the simulation.
 * Tracks info like number of individuals, and current fat reserves.
 */
export default class Population {
  /** @type {Species} */ #species;
  /** @type {number} */ #count;
  /** @type {number} */ #fat;  // In absolute energy units. Always 0 if the species doesn't have fat reserves.

  get count() { return this.#count; }
  get species() { return this.#species; }

  constructor(species) {
    this.#species = species;
    this.#count = species.getInitialPopulation().population;
    this.#fat = species.getInitialFatPercentage() * this.getTotalFatEnergyCapacity();
  }

  isExtinct() {
    return this.#count <= 0;
  }

  isPresent(day) {
    if (this.isExtinct()) return false;
    const delay = this.#species.getAppearanceDelay();
    return day >= delay;
  }

  /** @returns {number} In [0 .. 1] how much of the species' fat capacity is currently utilized */
  getFatRatio() {
    if (!this.#species.canStoreFat()) return 0;
    return this.#fat / this.getTotalFatEnergyCapacity();
  }

  /** @returns {number} In [0 .. 100] how much of the species' fat capacity is currently utilized, as a percentage */
  getFatPercentage() {
    return this.getFatRatio() * 100;
  }

  /** @returns {number} The total fat energy capacity of the population */
  getTotalFatEnergyCapacity() {
    if (!this.#species.canStoreFat()) return 0;

    const fatPerMember = this.#species.getFatCapacityPerMember();
    return fatPerMember * this.#count;
  }

  /** @returns {number} The current fat energy per member of the population */
  getCurrentFatEnergyPerMember() {
    if (!this.#species.canStoreFat()) return 0;
    return this.#fat / this.#count;
  }

  /** @returns {number} The available fat energy of the population */
  getAvailableFatEnergy() {
    if (!this.#species.canStoreFat()) return 0;
    return this.#fat;
  }

  /** @returns {number} The remaining fat energy capacity of the population */
  getRemainingFatEnergyCapacity() {
    return this.getTotalFatEnergyCapacity() - this.getAvailableFatEnergy()
  }

  getTotalPower() {
    return this.#count * this.#species.power;
  }

  getTotalAppetite() {
    return this.#count * this.#species.appetite;
  }

  getTotalEnergyUpkeep(populationCount = this.#count) {
    return populationCount * this.#species.getEnergyUpkeep();
  }

  /**
   * @param {string[]} forages
   * @return {Object<string, number>} preference scores by forage type
   */
  getPreferenceScores(forages) {
    // Score each option
    const rawScores = mapArrayValuesToObject(forages, forageType => this.getScoreForForage(forageType));
    const onlyPositiveScores = filterObject(rawScores, (key, value) => value > 0);
    const normalized = normalizeObject(onlyPositiveScores);

    const pickyness = this.#species.getPickyness();
    const preferenceScores = mapObjectValues(normalized, (key, value) => value ** pickyness);

    return preferenceScores;
  }

  getScoreForForage(forageType) {
    const energyYield = this.#species.getEnergyYield(forageType);
    const waterYield = forageDefinitions[forageType].water ?? 0;

    return energyYield + waterYield/10;
  }

  /**
   * @param {Species} predator
   * @param {number} cover
   * @returns {number} A number in the range [0, 1] representing the probability that a single hunt attempt on this population would succeed, based on the population's size and the biome's cover value.
   */
  getHuntSuccessRate(predator, cover = Constants.predation.cover) {
    // Larger species are easier to hunt, so they effectively have less "cover" against predation, and vice versa
    const size = this.#species.size;

    // Multikill hunting is more penalized by cover, to prevent increased number of hunt attempts from circumventing cover entirely
    const multikill = predator.getPredationKillQuota();

    // Faster prey benefit slightly more from cover
    const preySpeed = this.#species.speed;
    const predatorSpeed = predator.speed;
    const speedDefecit = Math.max(0, predatorSpeed - preySpeed);
    const deficitReduction = 1.5 ** speedDefecit; // Faster predators slightly claw-back the prey speed advantage, by about 1/3 of the advantage per predator speed above the prey's speed
    const speed = 1 + 0.1 * preySpeed / deficitReduction; // Fast prey get up to 10% more cover per speed point

    const effectiveCover = multikill * speed * cover / size;
    const rate = (this.#count / (this.#count + effectiveCover)) ** 1.5;
    return rate;
  }

  /**
   * @param {number} cover The cover factor for the current biome, affecting hunt success rates.
   * @param {Population} preyPopulation
   * @returns {number} score for the given prey population, where higher is more preferred, usually in the range [0 .. approximately 1]
   * Includes some randomness to model hunting luck.
   */
  getScoreForPrey(cover, preyPopulation) {
    const myHungerPerMember = this.#species.appetite;
    const meatVolume = preyPopulation.getMeatVolumeForKill() *
        preyPopulation.getHuntSuccessRate(this.#species, cover); // Include expected failed hunts for low-pop prey, which reduces the effective meat gained per kill attempt

    const satisfactionRatio = meatVolume / myHungerPerMember;

    let satisfactionScore = 0;
    if (satisfactionRatio <= 1) {
      satisfactionScore = satisfactionRatio; // Linear up to 1
    } else {
      satisfactionScore = 0.95 + 0.05 / satisfactionRatio; // Starts at 1.0 and goes down towards 0.99 slightly for very oversized kills
    }
    satisfactionScore **= 2;

    const randomFactor = bellRandom(0.1, 1); // Add some randomness to model "which specific targets did the predator encounter today" luck

    return satisfactionScore * randomFactor;
  }

  getMeatVolumeForKill() {
    const meatEnergy = this.getMeatEnergyForKill();
    const energyPerUnitMeat = meat.energy;
    return meatEnergy / energyPerUnitMeat;
  }

  getMeatEnergyForKill() {
    const predationEfficiency = Constants.predation.efficiency;

    const bodyEnergy = this.#species.getBirthEnergyCost() * predationEfficiency;
    const fatEnergy = this.getCurrentFatEnergyPerMember();
    const meatEnergy = bodyEnergy + fatEnergy;

    return meatEnergy;
  }

  getPredationKillQuota() {
    return this.#count * this.#species.getPredationKillQuota(); // Each member of the population can only make 1 kill per day, so kill quota is equal to population count
  }

  /**
   * @param {Object<string, number>} eatingPlan A collection of forage types and the amount of each type being eaten
   */
  getUnusedAppetite(eatingPlan, totalAppetite = this.getTotalAppetite()) {
    const usedAppetite = sumObjectValues(eatingPlan);
    const unusedAppetite = totalAppetite - usedAppetite;
    return unusedAppetite;
  }

  /**
   * @param {number} day The simulation day index, used to check if populations have appeared yet based on their appearance delay
   * @param {number} cover The cover factor for the current biome, affecting hunt success rates.
   * @param {Population[]} preyPops
   * @param {FoodChain} foodChain
   * @returns {Map<Population, number>} (fractional) kill requests by prey population
   */
  getPredationDemands(day, cover, preyPops, foodChain) {
    const isPredator = foodChain.isPredator(this.#species);
    const isPresent = this.isPresent(day);
    if (!isPresent || !isPredator) return new Map(); // Not present or not a predator, so no predation demands

    // Step 1: assign scores to predation options
    const preyPopulations = foodChain.getPreyListForPredator(this.#species).map(preySpecies => preyPops.find(pop => pop.#species === preySpecies)).filter(pop => pop && pop.isPresent(day));
    const predationScores = mapArrayValuesToMap(preyPopulations, preyPop => this.getScoreForPrey(cover, preyPop));

    // Step 2: assign kill-request amounts, totaling <= kill quota, based on predation scores
    const killQuota = this.getPredationKillQuota(); // Max 1 kill per predator member
    const normalized = normalizeMap(predationScores);
    const killRequests = mapMapValues(normalized, score => score * killQuota);

    return killRequests;
  }

  /**
   * @param {Object<string, number>} availableForages
   * @param {{ energyGained: number, waterGained: number, appetiteSatisfied: number }} status Information about the population's daily status after predation
   * @return {Object<string, number>} demand by forage type
   */
  getForageDemands(availableForages, status) {
    if (this.#count === 0) return {};
    if (status.appetiteSatisfied >= this.getTotalAppetite()) return {}; // If already fully satisfied by predation, no forage demands

    const species = this.#species;

    const canEat = Object.keys(
      filterObject(availableForages, (forageType, amount) => {
        return amount > 0 && species.canEat(forageType);
      })
    );
    const uncappedForages = new Set(canEat);
    const preferenceScores = this.getPreferenceScores(canEat);
    const normalizedScores = normalizeObject(preferenceScores);

    const appetiteNotSatisfiedByPredation = this.getTotalAppetite() - status.appetiteSatisfied;

    /** @type {Object<string, number>} */
    const demand = mapObjectValues(normalizedScores, (forageType, score) => {
      return score * appetiteNotSatisfiedByPredation;
    });

    // Loop through, and reduce any bids which exceed the available stock
    for (const forageType in demand) {
      if (demand[forageType] > availableForages[forageType]) {
        demand[forageType] = availableForages[forageType];
        uncappedForages.delete(forageType);
      }
    }

    // Iterate until either we have no remaining appetite, or all options are capped by available forage
    let unusedAppetite = this.getUnusedAppetite(demand, appetiteNotSatisfiedByPredation);
    while (unusedAppetite > 0 && uncappedForages.size > 0) {

      // Recalculate preference scores for only the remaining options, and renormalize
      const filteredScores = filterObject(preferenceScores, (key) => uncappedForages.has(key));
      const normalizedScores = normalizeObject(filteredScores);

      // Assign remaining appetite based on the new scores, but capped by the available forage and appetite limits
      const additionalDemand = mapObjectValues(normalizedScores, (forageType, score) => {
        return score * unusedAppetite;
      });

      for (const forageType in additionalDemand) demand[forageType] += additionalDemand[forageType];

      // Loop through, and reduce any bids which exceed the available stock
      for (const forageType of uncappedForages) {
        if (demand[forageType] > availableForages[forageType]) {
          demand[forageType] = availableForages[forageType];
          uncappedForages.delete(forageType);
        }
      }

      unusedAppetite = this.getUnusedAppetite(demand, appetiteNotSatisfiedByPredation);
    }

    return demand;
  }

  /**
   * @param {Map<Population, number>} kills
   * @return {{ energyGained: number, waterGained: number, appetiteSatisfied: number, meatWasted: number }}
   */
  processPredation(kills) {
    let remainingAppetite = this.getTotalAppetite();
    let meatEaten = 0, meatWasted = 0;
    for (const [preyPop, killCount] of kills.entries()) {
      const meatPerKill = preyPop.getMeatVolumeForKill();
      const totalMeatProduced = meatPerKill * killCount;
      const eatenPerKill = Math.min(meatPerKill, this.#species.appetite) // Each hunter can only eat so much, so if the prey is very large, there will be per-kill waste
      const totalEaten = Math.min(remainingAppetite, eatenPerKill * killCount);
      remainingAppetite -= totalEaten;
      meatEaten += totalEaten;

      if (totalEaten < totalMeatProduced) meatWasted += totalMeatProduced - totalEaten;
    }

    const energyGained = meatEaten * meat.energy;
    const waterGained = meatEaten * meat.water;
    const appetiteSatisfied = meatEaten;
    return { energyGained, waterGained, appetiteSatisfied, meatWasted };
  }

  /**
   * @param {number} deaths
   * @param {{ energyGained: number, waterGained: number, appetiteSatisfied: number, meatWasted: number }?} populationStatus
   */
  applyPredationDeaths(deaths, populationStatus) {
    const deathRatio = deaths / this.#count;
    this.#count -= deaths;

    const fatEnergyLost = deaths * this.getCurrentFatEnergyPerMember();
    this.spendFatEnergy(fatEnergyLost); // Reduce fat reserves proportional to population lost

    if (populationStatus) {
      populationStatus.appetiteSatisfied *= (1 - deathRatio); // Reduce appetite satisfied proportional to population lost
    }
  }

  /**
   * @param {Object<string, number>} eatenForages
   * @param {{ energyGained: number, waterGained: number }} status Information about the population's daily status after predation
   * @return {{ births: number, deaths: number, fatDelta: number, remainingEnergyDeficit: number }}
   * births: number of births from energy surplus
   * deaths: number of deaths from energy deficit
   * fatDelta: net change in fat energy (positive if fat stores increased)
   * remainingEnergyDeficit: any remaining energy deficit after using up fat reserves, which could be used to calculate additional deaths if desired
   */
  processConsumption(eatenForages, status) {
    const species = this.#species;

    let netEnergy = status.energyGained;
    let netWater = status.waterGained;

    // Gain energy/water for foods consumed
    for (const forageType in eatenForages) {
      const food = forageDefinitions[forageType];
      netEnergy += eatenForages[forageType] * species.getEnergyYield(forageType);
      if (food.water) netWater += eatenForages[forageType] * food.water;
    }

    // Lose energy for basic hunger
    netEnergy -= this.getTotalEnergyUpkeep();
    if (netEnergy < 0 && Settings.log.energyDeficits) this.logEnergyDeficit(-netEnergy, eatenForages);

    // Update population counts based on satisfaction
    let births = 0, deaths = 0, energyStoredAsFat = 0, fatEnergyUsed = 0, remainingEnergyDeficit = 0;
    if (netEnergy < 0) {
      const energyDeficit = -netEnergy;
      ({ remainingEnergyDeficit, fatEnergyUsed, deaths } = this.withdrawFromFatAndMaybeDie(energyDeficit));
    } else if (netEnergy > 0) {
      ({ births, energyStoredAsFat } = this.maybeBirthOrStoreToFat(netEnergy));
    }

    return { births, deaths, fatDelta: energyStoredAsFat - fatEnergyUsed, remainingEnergyDeficit };
  }

  withdrawFromFatAndMaybeDie(energyDeficit) {
    const species = this.#species;

    const { remainingEnergyDeficit, fatEnergyUsed } = this.withdrawFromFatToCoverEnergyDeficit(energyDeficit);
    if (remainingEnergyDeficit <= 0) {
      // No deaths if we were able to pay the energy deficit with fat reserves
      return { remainingEnergyDeficit: 0, fatEnergyUsed, deaths: 0 };
    }

    // If still defecit, deaths proportional to energy deficit
    let deaths = species.getDeathsFromEnergyDeficit(remainingEnergyDeficit);
    if (deaths > this.#count) deaths = this.#count;

    if (deaths > 0 && Settings.log.deaths) console.log(`Population '${species}': ${deaths} deaths.`);

    this.#count -= deaths;
    return { remainingEnergyDeficit, fatEnergyUsed, deaths };
  }

  withdrawFromFatToCoverEnergyDeficit(energyDeficit) {
    const species = this.#species;
    if (!species.canStoreFat()) return { remainingEnergyDeficit: energyDeficit, fatEnergyUsed: 0 };

    const fatEnergyUsed = Math.min(this.getAvailableFatEnergy(), energyDeficit);
    this.spendFatEnergy(fatEnergyUsed);
    const remainingEnergyDeficit = energyDeficit - fatEnergyUsed;

    return { remainingEnergyDeficit, fatEnergyUsed };
  }

  spendFatEnergy(energyAmount) {
    if (!this.#species.canStoreFat()) return;
    this.#fat -= energyAmount;
    this.#fat = clamp(this.#fat, 0, this.getTotalFatEnergyCapacity());
  }

  storeEnergyAsFat(energyAmount) {
    if (!this.#species.canStoreFat()) return;
    this.#fat += energyAmount;
    this.#fat = clamp(this.#fat, 0, this.getTotalFatEnergyCapacity());
  }

  getBirthsMax() {
    const species = this.#species;
    let cap = Math.floor(this.#count * species.getFecundityMultiplier());

    if (cap < 1) cap = 1; // Always allow at least 1 birth if sufficient energy
    if (this.#count === 1) cap = 0; // If only 1 member of the population, cannot reproduce asexually, so no births regardless of energy surplus

    return cap;
  }

  getBirthsForEnergyAmount(energy) {
    const costPerBirth = this.#species.getBirthEnergyCost();
    const numBirthsForEnergy = Math.floor(energy / costPerBirth);
    const max = this.getBirthsMax();
    const births = clamp(numBirthsForEnergy, 0, max);

    return births;
  }

  selectNumBirths(energy) {
    const species = this.#species;

    // Calculate the minimum number of births to avoid energy wastage
    const remainingFatCapacity = this.getRemainingFatEnergyCapacity();
    const overage = energy - remainingFatCapacity; // The amount of energy we can't store as fat, which represents the minimum energy we should spend on births to avoid waste

    if (overage <= 0) return { births: 0, remainingEnergySurplus: energy }; // No overage, so no need to spend on births, we can just store as fat

    const costPerBirth = this.#species.getBirthEnergyCost();
    const birthsToAvoidWaste = Math.ceil(overage / costPerBirth);
    const totalAvailableEnergy = energy + this.getAvailableFatEnergy(); // Total energy we have access to, including fat reserves

    // Figure out how much energy we want to spend
    let energyToSpend = birthsToAvoidWaste * costPerBirth;
    energyToSpend = clamp(energyToSpend, 0, totalAvailableEnergy); // We can't spend more energy than we have access to

    // Figure out how many births we make
    const births = this.getBirthsForEnergyAmount(energyToSpend); // Might be less due to e.g. fecundity caps.

    // Spend the energy
    const energySpentOnBirths = births * costPerBirth;
    energy -= energySpentOnBirths;

    // Return result, caller must use the (maybe negative) remainingEnergySurplus to edit fat stores
    return { births, remainingEnergySurplus: energy };
  }

  maybeBirthOrStoreToFat(energySurplus) {
    const { births, remainingEnergySurplus } = this.selectNumBirths(energySurplus);
    this.#count += births;

    // If any remaining unspent surplus, attempt to store to fat
    this.storeEnergyAsFat(remainingEnergySurplus);

    return { births, energyStoredAsFat: remainingEnergySurplus };
  }





  // #region Logging

  logState(prefix = '') {
    const powerText = `${formatSmallNumber(this.#species.power)} P, ${formatSmallNumber(this.#species.getEnergyUpkeep())} P upkeep`;
    const storageText = this.#species.canStoreFat() ? `, ${formatLargeNumber(this.#species.getFatCapacityPerMember())} E fat storage` : '';
    const fatPercent = this.getFatPercentage();
    const fatText = fatPercent > 0 ? ` + ${fatPercent.toFixed(1)}% fat` : '';
    const countText = formatLargeNumber(this.#count);
    const start = this.#species.getAppearanceDelay();
    const startText = start > 0 ? `, starts day ${start}` : '';
    console.log(`${prefix}${this.#species} (${powerText}${storageText}, appetite ${formatSmallNumber(this.#species.appetite)}${startText}): \t${countText}${fatText}`);
  }

  logFinalState(prefix = '') {
    if (this.#count === 0) {
      console.log(`${prefix}${this.#species}: extinct`);
    } else {
      const fatPercent = this.getFatPercentage();
      const fatText = fatPercent > 0 ? ` + ${fatPercent.toFixed(0)}% fat` : '';
      const countText = formatLargeNumber(this.#count);
      console.log(`${prefix}${this.#species}: \t${countText}${fatText} \t- total ${formatLargeNumber(this.getTotalPower())} P`);
    }
  }

  logEnergyDeficit(energyDeficit, eatenForages) {
    console.log(`Population '${this.#species}' has energy deficit of ${energyDeficit.toFixed(1)}`);
    console.log(`  Consumed:`);
    for (const forageType in eatenForages) {
      console.log(`    ${forageType}: ${eatenForages[forageType].toFixed(1)} (per each: ${this.#species.getEnergyYield(forageType)} E, ${forageDefinitions[forageType].water ?? 0} water)`);
    }
  }

  logExtinction(forageEaten, forageDemanded, fatEnergyUsed, remainingEnergyDeficit, priorPopulation) {
    const species = this.#species;

    console.log();
    console.log(`${species} population has gone extinct.`);
    console.log('Ate:', forageEaten);
    console.log('Demanded:', forageDemanded);
    console.log('Demanded:', forageDemanded);
    console.log('Energy from food:');
    for (const food in forageEaten) {
      const amount = forageEaten[food];
      const energyYield = species.getEnergyYield(food) * amount;
      console.log(`  ${amount} ${food}: ${energyYield.toFixed(1)} energy`);
    }
    console.log('Energy spent on metabolism:', -this.getTotalEnergyUpkeep(priorPopulation));
    console.log('Energy from fat used:', fatEnergyUsed);
    console.log('remaining energy deficit after fat withdrawal:', remainingEnergyDeficit);
  console.log();
  }

  // #endregion
}