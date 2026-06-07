import FoodChain from "./classes/food-chain.mjs";
import Constants from "./constants.mjs";
import { forage, water } from "./definitions/names.mjs";
import Settings from "./settings.mjs";
import { sumMapValues } from "./util/map.mjs";
import { clamp, formatLargeNumber, formatSmallNumber } from "./util/number.mjs";
import { filterObject, mapObjectValues, normalizeObject } from "./util/object.mjs";
import { bellRandom, randBool, roundRandom } from "./util/random.mjs";
import fs from 'node:fs';

/** @typedef {import("./classes/species.mjs").default} Species */
/** @typedef {import("./classes/population.mjs").default} Population */

/**
 * @param {Object} env
 * @param {Population[]} pops 
 * @param {number} days 
 */
export function runSim(env, pops, days = 10) {
  const foodChain = new FoodChain(pops.map(pop => pop.species));

  _initTimeSeriesLog(env, pops);
  logSimStart(env, pops);
  for (let i = 0; i < days; i++) {
    simulateDay(i, env, pops, foodChain);
    _updateTimeSeriesLog(i, env, pops);
  }
  logSimEnd(env, pops, days);
  _exportTimeSeriesTsv();
}

/**
 * Simulate a single day of the ecosystem.
 * @param {number} day
 * @param {Object} env
 * @param {Population[]} pops
 * @param {FoodChain} foodChain
 */
function simulateDay(day, env, pops, foodChain) {
  spawnResources(day, env);

  // Get predation plans
  /** @type {Map<Population, number>[]} Where index corresponds to the predator population in `pops` */
  const predationPlans = pops.map(pop => pop.getPredationDemands(day, pops, foodChain));

  // Sum total demand by prey population across predators
  const totalDemandByPreyPopulation = new Map();
  /** @type {Set<Population>} */ const preyPopulations = new Set();
  for (const plan of predationPlans) {
    for (const preyPop of plan.keys()) {
      const demand = plan.get(preyPop);
      const canFind = preyPop.getHuntSuccessRate();
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
  const populationStatuses = [];
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    const kills = actualKillsByPredatorPopulation[i];
    if (!kills) continue;

    const { energyGained, waterGained, appetiteSatisfied, meatWasted } = pop.processPredation(kills);
    populationStatuses[i] = { energyGained, waterGained, appetiteSatisfied };
    totalMeatWasted += meatWasted;
  }

  // Produce carrion from total meat waste
  env.food[forage.carrion] += totalMeatWasted; // Meat spoils directly to carrion 1:1, and can be eaten immediately same-day by scavengers

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
  const satisfaction = {
    food: {},
    water: {},
  };
  for (const food in totalDemand.food) {
    if (totalDemand.food[food] == 0) continue;

    // Satisfaction is the portion of demand that can be met with available resources
    const availableRatio = env.food[food] / totalDemand.food[food];
    satisfaction.food[food] = clamp(availableRatio, 0, 1);
  }

  // Assign actual amounts consumed to each population
  const actualConsumptionByPopulation = [];
  const totalConsumption = {};
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i];
    if (pop.count === 0) {
      actualConsumptionByPopulation.push({});
      continue;
    }

    const demand = demands[i];
    const consumption = {};
    for (const food in satisfaction.food) {
      if (satisfaction.food[food] > 0 && demand[food] > 0) {
        const consumed = satisfaction.food[food] * demand[food];
        consumption[food] = consumed;
        totalConsumption[food] = (totalConsumption[food] ?? 0) + consumed;
      }
    }
    actualConsumptionByPopulation.push(consumption);
  }

  // Update remaining resources after consumption
  for (const food in totalConsumption) {
    env.food[food] -= totalConsumption[food];
  }

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

  // Add to carrion per deaths
  for (const i in deathsByPopulation) {
    spawnCarrionForStarvationDeaths(env, pops[i].species, deathsByPopulation[i]);
  }

  rotFoodSupply(env);
}

/**
 * @param {object} env
 * @param {Species} species
 * @param {number} deaths
 */
function spawnCarrionForStarvationDeaths(env, species, deaths) {
  if (deaths <= 0) return;

  const carrionAdded = deaths * species.getCarrionPerStarvationDeath();
  env.food[forage.carrion] += carrionAdded;
}

let forageSpawnsToday = null;
const resourceMultiplier = 1;
const spawnRandomness = () => bellRandom(Constants.forage.spawnVariance, 1);
function spawnResources(day, environment, multiplier = 1) {
  const plentifulness = spawnRandomness(); // Random multiplier for resource spawn each day to create good and bad days for the population

  const spawns = environment.climate.getModifiedForageSpawn(day, environment.biome.forage);
  forageSpawnsToday = {};

  // Regenerate resources
  for (const key in spawns) {
    const amount = spawns[key];
    const roll = spawnRandomness();
    const spawnAmount = Math.max(0, amount * multiplier * plentifulness * roll * resourceMultiplier);
    environment.food[key] += spawnAmount;

    forageSpawnsToday[key] = spawnAmount; // Store today's forage spawns for export/debugging purposes
  }
  // for (const key in water) {
  //   const roll = spawnRandomness();
  //   const spawnAmount = Math.max(0, environment.biome.water[key] * multiplier * plentifulness * roll * resourceMultiplier);
  //   environment.water[key] += spawnAmount;
  // }

  // // Check for rain
  // for (let i = 0; i < multiplier; i++) {
  //   if (Math.random() < environment.biome.water.rain.frequency) {
  //     const roll = spawnRandomness();
  //     const spawnAmount = Math.max(0, environment.biome.water.rain.intensity * plentifulness * roll * resourceMultiplier);
  //     environment.water[water.fresh] += spawnAmount;
  //   }
  // }
}

function rotFoodSupply(environment) {
  mapObjectValues(environment.food, (_, amount) =>
    Math.max(0, Math.floor(amount * 0.99)),
  { inPlace: true });
}

/**
 * @param {object} env
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
    console.log();
    console.log('Environment:');
    console.log(`  Biome: ${env.biome.name}`);
    console.log('  Forage:');
    logForageStocks(env, '  ');
    loggedAnything = true;
  }
  
  if (loggedAnything) {
    console.log();
    console.log('---');
    console.log();
  }
}

/**
 * @param {object} env
 * @param {Population[]} pops
 * @param {number} days
 */
function logSimEnd(env, pops, days) {
  console.log();
  console.log('Simulation complete.');
  console.log(`${days} days simulated.`);

  console.log();
  console.log('Final food stocks:');
  logForageStocks(env);

  console.log();
  console.log('Final populations:');
  const sortedPopulations = pops.sort(sortByLivingThenByTotalPower);
  const popsToLog = Settings.log.extinctPopulationsInFinalRankings ? sortedPopulations : sortedPopulations.filter(pop => pop.count > 0);
  for (const pop of popsToLog) pop.logFinalState('- ');
}

function sortByLivingThenByTotalPower(a, b) {
  // Living populations come first
  if (a.count > 0 && b.count === 0) return -1;
  if (a.count === 0 && b.count > 0) return 1;

  // Then by total power, highest first
  return b.getTotalPower() - a.getTotalPower();
}

function logForageStocks(env, prefix = '') {
  for (const forageType in env.food) {
    const amount = env.food[forageType];
    if (amount > 0) {
      console.log(`${prefix}- ${forageType}: \t${amount.toFixed(0)}`);
    }
  }
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
function _initTimeSeriesLog(env, pops) {
  if (Settings.export.disable) {
    suppressTimeSeriesLog = true;
    return;
  }

  timeSeries = [];

  const headers = [];
  if (Settings.export.includeDayNumber) headers.push('day');
  if (Settings.export.forage) {
    headers.push(...Object.keys(env.food));
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
 * 
 * @param {number} day
 * @param {object} env
 * @param {Population[]} pops
 * @returns 
 */
function _updateTimeSeriesLog(day, env, pops) {
  if (suppressTimeSeriesLog) return;

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
        value = pop.getTotalPower() + pop.getAvailableFatEnergy();
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

function _mapToLogScale(value) {
  const logValue = Math.log2(value);
  return logValue < 0 ? 0 : formatSmallNumber(logValue, 4);
}

function _exportTimeSeriesTsv() {
  if (suppressTimeSeriesLog) return;

  const file = './out/log.csv';
  const content = timeSeries.map(row => row.join(',')).join('\n');
  fs.writeFileSync(file, content, err => {
    if (err) console.error('Error writing time series log to file:', err);
  });
}