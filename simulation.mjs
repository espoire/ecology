import FoodChain from "./classes/food-chain.mjs";
import Constants from "./constants.mjs";
import { forageDefinitions } from "./definitions/forages.mjs";
import meat from "./definitions/meat.mjs";
import { forage, water } from "./definitions/names.mjs";
import Settings from "./settings.mjs";
import CsvExporter from "./util/CsvExporter.mjs";
import { sumMapValues } from "./util/map.mjs";
import { clamp, formatLargeNumber, formatSmallNumber } from "./util/number.mjs";
import { filterObject, mapObjectValues, normalizeObject } from "./util/object.mjs";
import { roundRandom } from "./util/random.mjs";

/** @typedef {import("./classes/species.mjs").default} Species */
/** @typedef {import("./classes/population.mjs").default} Population */
/** @typedef {import("./classes/environment.mjs").default} Environment */

/**
 * @param {Environment} env
 * @param {Population[]} pops 
 * @param {number} days 
 */
export function runSim(env, pops, days = 10) {
  const foodChain = new FoodChain(pops.map(pop => pop.species));
  spawnInitialResources(env);

  _initTimeSeriesLog(env, pops);
  logSimStart(env, pops);
  for (let i = 0; i < days; i++) {
    const forageSpawnsToday = simulateDay(i, env, pops, foodChain);
    _updateTimeSeriesLog(i, env, pops, forageSpawnsToday);
  }
  logSimEnd(env, pops, days);
  _exportTimeSeriesCsv();
}


let forageSpawnsToday = null;

/**
 * Simulate a single day of the ecosystem.
 * @param {number} day
 * @param {Environment} env
 * @param {Population[]} pops
 * @param {FoodChain} foodChain
 * @returns {Object<string, number>} The forages that spawned today, as returned by `env.endOfDay()`
 */
function simulateDay(day, env, pops, foodChain) {
  env.spawnDailyForage(day);

  const cover = env.cover;

  // Get predation plans
  /** @type {Map<Population, number>[]} Where index corresponds to the predator population in `pops` */
  const predationPlans = pops.map(pop => pop.getPredationDemands(day, cover, pops, foodChain));

  // Sum total demand by prey population across predators
  const totalDemandByPreyPopulation = new Map();
  /** @type {Set<Population>} */ const preyPopulations = new Set();
  for (let i = 0; i < predationPlans.length; i++) {
    const plan = predationPlans[i];
    const predatorPop = pops[i];

    for (const preyPop of plan.keys()) {
      const demand = plan.get(preyPop);
      const canFind = preyPop.getHuntSuccessRate(predatorPop.species, cover);
      const modifiedDemand = demand * canFind; // Effective demand is reduced by the predator population's ability to find this prey population
      plan.set(preyPop, modifiedDemand);
    }

    for (const [preyPop, demand] of plan.entries()) {
      const currentDemand = totalDemandByPreyPopulation.get(preyPop) ?? 0;
      totalDemandByPreyPopulation.set(preyPop, currentDemand + demand);
      preyPopulations.add(preyPop);
    }
  }

  // Calculate satisfaction by prey population
  const satisfactionByPreyPopulation = new Map();
  for (const [preyPop, totalDemand] of totalDemandByPreyPopulation.entries()) {
    if (totalDemand == 0) continue;

    // Satisfaction is the portion of demand that can be met with available resources -- in this case, the prey population count
    const availableRatio = preyPop.count / totalDemand;
    satisfactionByPreyPopulation.set(preyPop, clamp(availableRatio, 0, 1));
  }

  // Assign actual kills to each predator population based on satisfaction
  /** @type {Map<Population, number>[]} */
  const actualKillsByPredatorPopulation = [];
  /** @type {Map<Population, number>} */
  const actualDeathsByPreyPopulation = new Map();
  const killQuotas = pops.map(pop => pop.getPredationKillQuota());
  const appetites = pops.map(pop => pop.getTotalAppetite());

  // Loop through BY PREY POPULATION to assign kills, going in meat-per-kill descending order
  const preyPopsByMeat = [...preyPopulations].sort((a, b) => b.getMeatVolumeForKill() - a.getMeatVolumeForKill());
  for (const prey of preyPopsByMeat) {
    if (!prey.isPresent(day)) continue; // Skip prey populations that aren't present today
    let preyCount = prey.count;

    const satisfaction = satisfactionByPreyPopulation.get(prey) ?? 0;
    if (satisfaction === 0) continue; // Skip prey populations that have no predation demand

    // Get all predators that want this prey population
    const predatorPops = predationPlans
      .map((plan, index) => ({ plan, index }))
      .filter(({ plan }) => plan.has(prey))
      .sort((a, b) => b.plan.get(prey) - a.plan.get(prey)); // Sort predators by demand for this prey population, highest first

    for (const { plan, index } of predatorPops) {
      const predators = pops[index];
      const demand = plan.get(prey); // How much this predator population wants to kill from this prey population
      const satisfiedDemand = demand * satisfaction; // Applying canFind 
      const baseKills = roundRandom(satisfiedDemand); // Base kills is the satisfied demand rounded to a whole number, with some randomness

      let kills = baseKills;
      if (kills > preyCount) kills = preyCount; // Can't kill more than the available prey population
      
      const killQuota = killQuotas[index]; // Max this predator population can kill across all prey populations
      if (kills > killQuota) kills = killQuota; // Can't kill more than the predator population's kill quota

      const meatPerKill = prey.getMeatVolumeForKill();
      const appetitePerMember = predators.species.appetite;
      const usableMeatPerKill = Math.min(appetitePerMember, meatPerKill); // "An individual kill won't be directly eaten by more than one individual"
      const remainingAppetiteTotal = appetites[index];
      const maxKillsToSatisfyAppetite = Math.ceil(remainingAppetiteTotal / usableMeatPerKill);
      if (kills > maxKillsToSatisfyAppetite) kills = maxKillsToSatisfyAppetite; // No need to kill more than would satisfy the predator population's appetite

      const actualAppetiteSatisfied = kills * usableMeatPerKill;
      appetites[index] -= actualAppetiteSatisfied; // Reduce the remaining appetite for this predator population by the actual appetite satisfied by these kills

      actualKillsByPredatorPopulation[index] ??= new Map();
      actualKillsByPredatorPopulation[index].set(prey, kills);

      actualDeathsByPreyPopulation.set(prey, (actualDeathsByPreyPopulation.get(prey) ?? 0) + kills);
      preyCount -= kills;
      killQuotas[index] -= kills;
    }
  }

  _logPredationMaybe(day, pops, actualKillsByPredatorPopulation, actualDeathsByPreyPopulation);

  // Process meat consumption for each predator population
  //   Record energy/water gains
  //   Record appetite satisfaction
  //   Record meat wasted from oversatisfied individual-appetites
  let totalMeatWasted = 0;
  let totalDungSpawn = 0;
  const populationStatuses = [];
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    const kills = actualKillsByPredatorPopulation[i];
    if (!kills) continue;

    const { energyGained, waterGained, appetiteSatisfied, meatEaten, meatWasted } = pop.processPredation(kills);
    populationStatuses[i] = { energyGained, waterGained, appetiteSatisfied };
    totalMeatWasted += meatWasted;

    const dung = (meatEaten * (meat.dung ?? 0)) ?? 0;
    totalDungSpawn += dung;
    if (Settings.log.dungProduction && dung > 0) {
      console.log(`Day ${day + 1}: ${pop.species} produced ${formatLargeNumber(dung)} dung from eating ${formatLargeNumber(meatEaten)} meat`);
    }
  }
  env.scheduleDungSpawn(totalDungSpawn, 'meat'); // Schedule dung to be spawned at the end of the day, after rot, so that dung from predation won't rot until tomorrow, giving it a chance to be eaten
  env.spawnCarrion(totalMeatWasted); // Meat spoils directly to carrion 1:1, and can be eaten immediately same-day by scavengers

  // Apply deaths from predation to prey populations
  //   Reduce population
  //   Reduce fat stores proportionally (if they had any)
  //   Reduce appetite satisfaction proportionally (if they were also eating meat today)
  for (const [preyPop, deaths] of actualDeathsByPreyPopulation.entries()) {
    preyPop.applyPredationDeaths(deaths, populationStatuses[preyPop.index]);

    if (preyPop.count <= 0 && Settings.log.extinctions) {
      const mode = Settings.log.extinctions;
      if (mode === 'terse') console.log(`- ${preyPop.species.name} went extinct on day ${day + 1} (predation)`);
    }
  }

  // Register demands from population
  const totalDemand = {
    food: {},
    water: {},
  };

  /** @type {Object<string, number>[]} Where index corresponds to population index */
  const demands = pops.map((pop, i) => {
    if (!pop.isPresent(day)) return {}; // Skip populations that aren't present today
    populationStatuses[i] ??= { energyGained: 0, waterGained: 0, appetiteSatisfied: 0 }; // Ensure population status exists for this population, even if they had no predation activity today
    return pop.getForageDemands(env.food, populationStatuses[i]);
  });

  // Sum total demand by food type across populations
  for (const demand of demands) {
    for (const food in demand) {
      totalDemand.food[food] = (totalDemand.food[food] ?? 0) + demand[food];
    }
  }

  // Calculate satisfaction by food type
  const satisfaction = env.getForageSatisfaction(totalDemand.food);

  // Assign actual amounts consumed to each population
  const actualConsumptionByPopulation = [];
  /** @type {Object<string, number>} */ const totalConsumption = {};
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    if (!pop.isPresent(day)) {
      actualConsumptionByPopulation.push({});
      continue;
    }

    const demand = demands[i];
    const consumption = {};
    let foodConsumed = 0;
    for (const food in satisfaction) {
      const satisfied = satisfaction[food] ?? 0;
      const demanded = demand[food] ?? 0;
      if (satisfied <= 0 || demanded <= 0) continue;

      const consumed = satisfied * demanded;
      consumption[food] = consumed;
      totalConsumption[food] = (totalConsumption[food] ?? 0) + consumed;
    }
    actualConsumptionByPopulation.push(consumption);
  }

  // Update remaining resources after consumption
  env.consumeForages(totalConsumption);

  // Process consumption for each population (update population counts & fat stores) and calculate deaths by population
  const deathsByPopulation = [];
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    if (!pop.isPresent(day)) continue;

    const priorPopulation = pop.count;

    const forageEaten = actualConsumptionByPopulation[i];
    const { births, deaths, fatDelta, remainingEnergyDeficit } = pop.processConsumption(forageEaten, populationStatuses[i]);
    if (pop.count <= 0 && Settings.log.extinctions) {
      const mode = Settings.log.extinctions;
      if (mode === 'verbose') pop.logExtinction(forageEaten, demands[i], -fatDelta, remainingEnergyDeficit, priorPopulation);
      if (mode === 'terse') console.log(`- ${pop.species.name} went extinct on day ${day + 1} (starvation)`);
    }

    if (deaths > 0) deathsByPopulation[i] = deaths;
  }

  // Roll extra deaths for subviable populations
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    if (!pop.isPresent(day)) continue;
    const deaths = pop.rollSubviableDeaths(day);
    deathsByPopulation[i] = (deathsByPopulation[i] ?? 0) + deaths;
  }

  // Add to carrion per deaths
  for (const i in deathsByPopulation) {
    spawnCarrionForStarvationDeaths(env, pops[i].species, deathsByPopulation[i]);
  }

  const forageSpawnsToday = env.endOfDay();
  return forageSpawnsToday;
}

/**
 * @param {Environment} env
 * @param {Species} species
 * @param {number} deaths
 */
function spawnCarrionForStarvationDeaths(env, species, deaths) {
  if (deaths <= 0) return;

  const carrionAdded = deaths * species.getCarrionPerStarvationDeath();
  env.spawnCarrion(carrionAdded);
}

/**
 * Spawns a fairly representative mix of the year-round resources for this environment.
 * @param {Environment} env
 */
function spawnInitialResources(env, steps = 16) {
  for (let i = 0; i < steps; i++) {
    const day = Math.floor(i * Constants.seasons.yearLength / steps);
    env.spawnDailyForage(day);
  }
}

/**
 * @param {Environment} env
 * @param {Population[]} pops
 */
function logSimStart(env, pops) {
  let loggedAnything = false;

  if (Settings.log.initialPopulations) {
    console.log();
    console.log('Initial population:');
    for (const pop of pops) pop.logState('- ');
    loggedAnything = true;
  }
  
  if (Settings.log.initialEnvironment) {
    env.logState({ verbose: true });
    loggedAnything = true;
  }
  
  if (loggedAnything) {
    console.log();
    console.log('---');
    console.log();
  }
}

/**
 * @param {Environment} env
 * @param {Population[]} pops
 * @param {number} days
 */
function logSimEnd(env, pops, days) {
  console.log();
  console.log('Simulation complete.');
  console.log(`${days} days simulated.`);

  console.log();
  console.log('Final food stocks:');
  env.logState({ verbose: false });

  console.log();
  console.log('Final populations:');
  const sortedPopulations = pops.sort(sortByLivingThenByTotalEnergy);
  const popsToLog = Settings.log.extinctPopulationsInFinalRankings ? sortedPopulations : sortedPopulations.filter(pop => pop.count > 0);
  for (const pop of popsToLog) pop.logFinalState('- ');

  const numberOfExtinct = pops.filter(pop => pop.count <= 0).length;
  const numberOfLiving = pops.length - numberOfExtinct;
  const percentExtinct = formatSmallNumber(numberOfExtinct / pops.length * 100);
  console.log();
  console.log(`${numberOfLiving} living populations, ${numberOfExtinct} extinct populations (${percentExtinct}%).`);
}

/**
 * @param {Population} a
 * @param {Population} b
 * @returns {number} Negative if `a` should come before `b`, positive if `b` should come before `a`, 0 if equal
 */
function sortByLivingThenByTotalEnergy(a, b) {
  // Living populations come first
  if (a.count > 0 && b.count === 0) return -1;
  if (a.count === 0 && b.count > 0) return 1;

  // Then by total energy, highest first
  return b.getTotalEnergy() - a.getTotalEnergy();
}

/**
 * @param {number} day
 * @param {Population[]} pops
 * @param {Map<Population, number>[]} actualKillsByPredatorPopulation
 * @param {Map<Population, number>} actualDeathsByPreyPopulation
 */
function _logPredationMaybe(day, pops, actualKillsByPredatorPopulation, actualDeathsByPreyPopulation) {
  if (!Settings.log.predation) return;

  let printedAnything = false;
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    const kills = actualKillsByPredatorPopulation[i];
    const killCount = sumMapValues(kills);
    const deathCount = actualDeathsByPreyPopulation.get(pop) ?? 0;

    if (killCount > 0 || deathCount > 0) {
      if (!printedAnything) {
        console.log();
        console.log(`Day ${day + 1} predation:`);
      }

      console.log(`- ${pop.species.name}: ate ${killCount}, ${deathCount} were eaten`);

      printedAnything = true;
    }
  }

  if (printedAnything) console.log();
}

let timeSeries;
let suppressTimeSeriesLog = false;
/**
 * @param {Environment} env
 * @param {Population[]} pops
 */
function _initTimeSeriesLog(env, pops) {
  if (Settings.export.disable) {
    suppressTimeSeriesLog = true;
    return;
  }

  timeSeries = [];

  const headers = [];
  if (Settings.export.includeDayNumber) headers.push('day');
  if (Settings.export.forage) {
    headers.push(...Object.keys(forageDefinitions));
  }
  if (Settings.export.forageSpawns) {
    headers.push(...Object.keys(env.biome.forage).map(key => `${key}-spawned`));
  }
  if (Settings.export.species) {
    headers.push(...pops.map(pop => pop.species.name));
  }

  if (headers.length === 0) {
    suppressTimeSeriesLog = true;
    return;
  }

  timeSeries.push(headers);
}

/**
 * @param {number} day
 * @param {Environment} env
 * @param {Population[]} pops
 * @param {Object<string, number>} forageSpawnsToday The forages that spawned today, as returned by `env.endOfDay()`
 */
function _updateTimeSeriesLog(day, env, pops, forageSpawnsToday) {
  if (suppressTimeSeriesLog) return;
  if (day % Settings.export.dayInterval !== 0) return;

  const row = [];

  if (Settings.export.includeDayNumber) row.push(day);

  if (Settings.export.forage) {
    for (const forageType in env.food) {
      const amount = env.food[forageType];
      row.push(amount);
    }
  }

  if (Settings.export.forageSpawns) {
    for (const forageType in env.biome.forage) {
      const amount = forageSpawnsToday[forageType];
      row.push(amount);
    }
  }

  if (Settings.export.species) {
    for (const pop of pops) {
      if (!pop.isPresent(day)) {
        row.push(''); // Blank if population isn't present yet
        continue;
      }

      let value;
      if (Settings.export.species === 'count') {
        value = pop.count + pop.getAvailableFatEnergy() / pop.species.getBirthEnergyCost(); // Count includes available fat energy converted to population count equivalent, to give a sense of total survivability of the population including fat stores
      } else if (Settings.export.species === 'total-energy') {
        value = pop.getTotalEnergy() + pop.getAvailableFatEnergy();
      }

      if (Settings.export.logScale) {
        value = _mapToLogScale(value);
      } else {
        row.push(value.toFixed(1));
      }

      row.push(value);
    }
  }

  timeSeries.push(row);
}

/**
 * @param {number} value
 * @returns {number | string} A formatted short (few decimal places) log-scaled version of the value
 */
function _mapToLogScale(value) {
  if (value <= 0) return 0;
  const logValue = Math.log2(value);
  return logValue < 0 ? 0 : formatSmallNumber(logValue, 4);
}

function _exportTimeSeriesCsv() {
  if (suppressTimeSeriesLog) return;
  CsvExporter.write(timeSeries, 'log.csv');
}