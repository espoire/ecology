import { forageDefinitions } from "./definitions/forage.mjs";
import { forage, water } from "./definitions/names.mjs";
import Settings from "./settings.mjs";
import { clamp } from "./util/number.mjs";
import { filterObject, mapObjectValues, normalizeObject } from "./util/object.mjs";
import { bellRandom, randBool, roundRandom } from "./util/random.mjs";

/** @typedef {import("./classes/species.mjs").default} Species */
/** @typedef {import("./classes/population.mjs").default} Population */

/**
 * @param {Object} env
 * @param {Population[]} pops 
 * @param {number} days 
 */
export function runSim(env, pops, days = 10) {
  spawnResources(env, 1); // Spawn an initial week's worth of resources so populations have something to eat on day 1
  logSimStart(env, pops);
  for (let i = 0; i < days; i++) simulateDay(env, pops);
  logSimEnd(env, pops, days);
}

/**
 * @param {Object} env
 * @param {Population[]} pops
 */
function simulateDay(env, pops) {
  spawnResources(env);

  // Register demands from population
  const totalDemand = {
    food: {},
    water: {},
  };

  /** @type {Object<string, number>[]} Where index corresponds to population index */
  const demands = pops.map(pop => pop.getForageDemands(env.food));

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
    if (pop.count === 0) continue;

    const priorPopulation = pop.count;

    const forageEaten = actualConsumptionByPopulation[i];
    const { births, deaths, fatDelta, remainingEnergyDeficit } = pop.processConsumption(forageEaten);
    if (pop.count <= 0 && Settings.log.extinctions) pop.logExtinction(forageEaten, demands[i], -fatDelta, remainingEnergyDeficit, priorPopulation);

    if (deaths > 0) deathsByPopulation[i] = deaths;
  }

  // Add to carrion per deaths
  for (const i in deathsByPopulation) {
    spawnCarrionForStarvationDeaths(env, pops[i].species, deathsByPopulation[i]);
  }

  rotFoodSupply(env);
}

function spawnCarrionForStarvationDeaths(env, species, deaths) {
  if (deaths <= 0) return;

  const carrionAdded = deaths * species.getCarrionPerStarvationDeath();
  env.food[forage.carrion] += carrionAdded;
}

const resourceMultiplier = 1;
const spawnRandomness = () => bellRandom(0.5, 1);
function spawnResources(environment, days = 1) {
  const plentifulness = spawnRandomness(); // Random multiplier for resource spawn each day to create good and bad days for the population

  // Regenerate resources
  for (const key in environment.biome.forage) {
    const roll = spawnRandomness();
    const spawnAmount = Math.max(0, environment.biome.forage[key] * days * plentifulness * roll * resourceMultiplier);
    environment.food[key] += spawnAmount;
  }
  for (const key in water) {
    const roll = spawnRandomness();
    const spawnAmount = Math.max(0, environment.biome.water[key] * days * plentifulness * roll * resourceMultiplier);
    environment.water[key] += spawnAmount;
  }

  // Check for rain
  for (let i = 0; i < days; i++) {
    if (Math.random() < environment.biome.water.rain.frequency) {
      const roll = spawnRandomness();
      const spawnAmount = Math.max(0, environment.biome.water.rain.intensity * plentifulness * roll * resourceMultiplier);
      environment.water[water.fresh] += spawnAmount;
    }
  }
}

function rotFoodSupply(environment) {
  mapObjectValues(environment.food, (_, amount) =>
    Math.max(0, Math.floor(amount * 0.99)),
  { inPlace: true });
}

function logSimStart(env, pops) {
  console.log('Initial population:');
  for (const pop of pops) pop.logState('- ');

  console.log();
  console.log('Environment:');
  console.log(`  Biome: ${env.biome.name}`);
  console.log('  Forage:');
  logForageStocks(env, '  ');
  
  console.log();
  console.log('---');
  console.log();
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
  const sortedPopulations = pops.sort(sortByTotalPower);
  for (const pop of sortedPopulations) pop.logFinalState('- ');
}

function sortByTotalPower(a, b) {
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