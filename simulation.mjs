import { forageDefinitions } from "./definitions/forage.mjs";
import { forage, water } from "./definitions/names.mjs";
import Settings from "./settings.mjs";
import { formatLargeNumber } from "./util/number.mjs";
import { filterObject, normalizeObject } from "./util/object.mjs";
import { bellRandom, randBool, roundRandom } from "./util/random.mjs";

/** @typedef {import("./classes/species.mjs").default} Species */

export function runSim(environment, population, days = 10) {
  spawnResources(environment, 1); // Spawn an initial week's worth of resources so populations have something to eat on day 1

  console.log('Initial population:');
  for (const pop of population) {
    let fat = pop.fat ?? 0;
    if (isNaN(fat)) fat = 0;
    const fatPercent = Math.round(fat * 100);
    const fatText = fatPercent > 0 ? ` + ${fatPercent}% fat` : '';
    const countText = formatLargeNumber(pop.count);
    console.log(`- ${pop.species} (power ${pop.species.power.toFixed(1)}, appetite ${pop.species.appetite}): ${countText}${fatText}`);
  }

  console.log('Environment:');
  console.log(`  Biome: ${environment.biome.name}`);
  console.log('  Forage:');
  for (const food in environment.food) {
    const amount = environment.food[food];
    if (amount > 0) {
      console.log(`  - ${food}: ${amount.toFixed(0)}`);
    }
  }

  console.log('---');

  for (let day = 0; day < days; day++) {
    simulateDay(environment, population);
  }

  console.log('Simulation complete.');

  console.log();
  console.log('Final food stocks:');
  for (const food in environment.food) {
    const amount = environment.food[food];
    if (amount > 0) {
      console.log(`- ${food}: ${amount.toFixed(0)}`);
    }
  }

  console.log();
  console.log('Final populations:');
  const sortedPopulations = population.sort((a, b) => b.count * b.species.power - a.count * a.species.power);
  for (const pop of sortedPopulations) {
    if (pop.count === 0) {
      console.log(`- ${pop.species}: extinct`);
      continue;
    }

    let fat = pop.fat ?? 0;
    if (isNaN(fat)) fat = 0;
    const fatPercent = Math.round(fat * 100);
    const fatText = fatPercent > 0 ? ` + ${fatPercent}% fat` : '';
    const countText = formatLargeNumber(pop.count);
    console.log(`- ${pop.species}: ${countText}${fatText} - total power ${formatLargeNumber(pop.count * pop.species.power)}`);
  }
}

function simulateDay(environment, populations) {
  spawnResources(environment);

  // Register demands from population
  const totalDemand = {
    food: {},
    water: {},
  };
  const demands = [];
  for (const pop of populations) {
    const demand = getFoodDemands(environment.food, pop);
    demands.push(demand);

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
    satisfaction.food[food] = Math.min(1, environment.food[food] / totalDemand.food[food]);
  }

  // Assign actual amounts consumed to each population
  const actualConsumptionByPopulation = [];
  const totalConsumption = {};
  for (let i = 0; i < populations.length; i++) {
    const pop = populations[i];
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

  // Update remaining resources
  for (const food in totalConsumption) {
    environment.food[food] -= totalConsumption[food];
  }

  // Withdraw from fat, if deficit energy

  // Compute energy/water gain/loss for each population
  const netEnergyByPopulation = [];
  for (let i = 0; i < populations.length; i++) {
    const pop = populations[i];
    const species = pop.species;
    const demand = demands[i];
    const consumption = actualConsumptionByPopulation[i];
    
    let netEnergy = 0;
    let netWater = 0;

    // Gain energy/water for foods consumed
    for (const food in consumption) {
      netEnergy += consumption[food] * species.getEnergyYield(food);
      if (forageDefinitions[food].water) {
        netWater += consumption[food] * forageDefinitions[food].water;
      }
    }

    // Lose energy for basic hunger
    netEnergy -= pop.species.getEnergyUpkeep() * pop.count;

    if (netEnergy < 0 && Settings.log.energyDeficits) {
      console.log(`Population ${pop.species} has energy deficit of ${-netEnergy.toFixed(1)}`);
      console.log(`  Consumed:`);
      for (const food in consumption) {
        console.log(`    ${food}: ${consumption[food].toFixed(1)} (energy ${species.getEnergyYield(food)}, water ${forageDefinitions[food].water ?? 0})`);
      }
    }

    netEnergyByPopulation.push(netEnergy);
  }

  // Update population counts based on satisfaction
  const deathsByPopulation = [];
  for (let i = 0; i < populations.length; i++) {
    const pop = populations[i];
    /** @type {Species} */
    const species = pop.species;
    let netEnergy = netEnergyByPopulation[i];

    if (netEnergy < 0) {
      let fatUsed = 0;
      if (species.canStoreFat()) {
        // If any fat reserves, withdraw from fat to cover deficit
        const fatFraction = pop.fat;
        const fatPerMember = species.getFatCapacityPerMember();
        const availableFatEnergy = fatFraction * fatPerMember * pop.count;
  
        if (availableFatEnergy >= -netEnergy) {
          // Can cover entire deficit with fat
          fatUsed = -netEnergy;
        } else {
          fatUsed = availableFatEnergy;
        }
  
        pop.fat -= fatUsed / (fatPerMember * pop.count);
        netEnergy += fatUsed;
      }

      // If still defecit, deaths proportional to energy deficit
      let deaths = species.getDeathsFromEnergyDeficit(netEnergy);

      if (isNaN(deaths)) {
        console.log('Error: deaths is NaN');
        console.log('species:', species);
        console.log('netEnergy:', netEnergy);
        console.log('species.power:', species.power);
        deaths = 0;
      }

      if (deaths > pop.count) {
        deaths = pop.count;

        console.log(`${species} population has gone extinct.`);
        console.log('netEnergy:', netEnergy);
        console.log('species.power:', species.power);
        console.log('Ate:', actualConsumptionByPopulation[i]);
        console.log('Demanded:', demands[i]);
        console.log('Energy from food:');
        for (const food in actualConsumptionByPopulation[i]) {
          console.log(`  ${actualConsumptionByPopulation[i][food]} ${food}: ${actualConsumptionByPopulation[i][food] * species.getEnergyYield(food)}`);
        }
        console.log('Energy spent on metabolism:', -species.getEnergyUpkeep() * pop.count);
        console.log('Energy from fat used:', fatUsed);
        console.log('Total net energy:', netEnergy);
      }

      pop.count -= deaths;
      deathsByPopulation[i] = deaths;

    } else if (netEnergy > 0) {
      // Births proportional to energy surplus
      const costPerBirth = species.getBirthEnergyCost();
      let cap = Math.floor(pop.count * species.getFecundityMultiplier());
      if (cap < 1) cap = 1; // Always allow at least 1 birth if sufficient energy
      if (pop.count === 1) cap = 0; // If only 1 member of the population, cannot reproduce asexually, so no births regardless of energy surplus
      let births = Math.min(cap, Math.floor(netEnergy / costPerBirth));

      let birthsWithFatSpend = 0;
      if (species.canStoreFat()) {
        // If any fat reserves, maybe withdraw from fat to make births possible that wouldn't be with just food energy
        const fatFraction = pop.fat;
        const fatPerMember = species.getFatCapacityPerMember();
        const availableFatEnergy = fatFraction * fatPerMember * pop.count;

        const totalEnergy = netEnergy + availableFatEnergy;
        birthsWithFatSpend = Math.min(cap, Math.floor(totalEnergy / costPerBirth));

        if (birthsWithFatSpend > births) {
          const additionalBirths = birthsWithFatSpend - births;
          const additionalEnergyNeeded = additionalBirths * costPerBirth;
          const fatEnergyToUse = Math.min(availableFatEnergy, additionalEnergyNeeded);
          pop.fat -= fatEnergyToUse / (fatPerMember * pop.count);
          netEnergy += fatEnergyToUse;
          births = birthsWithFatSpend;
        }
      }

      if (isNaN(births)) {
        console.log('Error: births is NaN');
        console.log('species:', species);
        console.log('netEnergy:', netEnergy);
        console.log('costPerBirth:', costPerBirth);
        console.log('species.power:', species.power);
        console.log('cap:', cap);
        births = 0;
      }

      const energySpentOnBirths = births * costPerBirth;
      pop.count += births;
      netEnergy -= energySpentOnBirths;

      // If any remaining unspent surplus, attempt to store to fat
      if (species.canStoreFat()) {
        const fatFraction = pop.fat;
        const fatPerMember = species.getFatCapacityPerMember();
        const availableFatStorage = (1 - fatFraction) * fatPerMember * pop.count;
        const fatToStore = Math.min(availableFatStorage, netEnergy);
        pop.fat += fatToStore / (fatPerMember * pop.count);
        netEnergy -= fatToStore;
      }

      // Maybe log leftover netEnergy as wasted overconsumption or something?
    }
  }

  // Add to carrion per deaths
  for (const i in deathsByPopulation) {
    const species = populations[i].species;
    const deaths = deathsByPopulation[i];

    if (deaths > 0) {
      const carrionAdded = deaths * species.getCarrionPerStarvationDeath();
      environment.food[forage.carrion] += carrionAdded;
    }
  }

  // Rot food supply
  for (const food in environment.food) {
    environment.food[food] *= 0.99; // Lose 1% of food to rot each day
    environment.food[food] = Math.floor(environment.food[food]);
    environment.food[food] = Math.max(0, environment.food[food]);
  }
}

const resourceMultiplier = 1000;
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

/**
 * @param {Dictionary<string, number>} availableFoods
 * @param {{ species: Species, count: number }} population
 */
function getFoodDemands(availableFoods, population) {
  const species = population.species;

  const demand = {};
  const canEat = [];

  for (const food in availableFoods) {
    if (availableFoods[food] > 0 && species.canEat(food)) {
      canEat.push(food);
    }
  }
  const uncappedFoods = new Set(canEat);

  const scores = {};
  let totalScore = 0;
  for (const food of canEat) {
    const energyYield = species.getEnergyYield(food);
    const waterYield = forageDefinitions[food].water ?? 0;

    const score = energyYield + waterYield/10;
    if (score <= 0) continue;

    scores[food] = score;
    totalScore += score;
  }

  const pickyness = 1; // Split bid between foods based on score. Higher pickyness means more skewed towards higher score foods.
  const preferenceScores = {};
  let secondTotal = 0;
  for (const food of canEat) {
    preferenceScores[food] = (scores[food] / totalScore) ** pickyness;
  }

  const normalizedScores = normalizeObject(preferenceScores);

  const totalAppetite = species.appetite * population.count;
  for (const food of canEat) {
    const maxDigestable = totalAppetite / forageDefinitions[food].digestion; // Max amount they can eat based on digestion limits
    demand[food] = normalizedScores[food] * maxDigestable;
  }

  for (const food in demand) {
    if (demand[food] > availableFoods[food]) {
      demand[food] = availableFoods[food];
      uncappedFoods.delete(food);
    }
  }

  let usedAppetite = 0;
  for (const food in demand) {
    usedAppetite += demand[food] * forageDefinitions[food].digestion;
  }
  let unusedAppetite = totalAppetite - usedAppetite;

  while (unusedAppetite > 0 && uncappedFoods.size > 0) {
    const filteredScores = filterObject(preferenceScores, (key) => uncappedFoods.has(key));
    const normalizedScores = normalizeObject(filteredScores);

    for (const food of uncappedFoods) {
      const maxDigestable = unusedAppetite / forageDefinitions[food].digestion;
      const additionalDemand = normalizedScores[food] * maxDigestable;
      demand[food] += additionalDemand;
    }

    for (const food of uncappedFoods) {
      if (demand[food] > availableFoods[food]) {
        demand[food] = availableFoods[food];
        uncappedFoods.delete(food);
      }
    }

    let usedAppetite = 0;
    for (const food in demand) {
      usedAppetite += demand[food] * forageDefinitions[food].digestion;
    }
    unusedAppetite = totalAppetite - usedAppetite;
  }

  return demand;
}