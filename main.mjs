import { biome } from "./definitions/biome.mjs";
import { forageDefinitions } from "./definitions/forage.mjs";
import { forage, water } from "./definitions/names.mjs";
import { speciesDefinitions } from "./definitions/species.mjs";
import { formatLargeNumber } from "./util/number.mjs";
import { bellRandom, randBool, roundRandom } from "./util/random.mjs";

// TODO
// Refactor
//   Make population fat stored as energy amount, not fraction. Should no generate free energy from nowhere when having births at nonzero fat.
//   Violent deaths waste fat, subtract from reserves when they occur (TODO future)
//   Clean up main omnibus into modules
// Predation
//   Add carnivores that can eat other animals.
//   Food value based on prey power + current fat, includes some water
//   Food digestion based on prey size
//   Speed: Predatior speed must be >= prey speed to catch them.
//     Hunt cost based on the prey speed stat
//   Maybe add a "stealth" stat that makes it harder for predators to find them, and "vision" stat for predators opposes?
//   Attack:
//     Predator: Must be >= prey armor AND > prey attack to eat them.
//     Prey: Adds hunt cost for predator.
//   Venom: boolean trait, as predator adds extra Attack (unless prey has venom resistance trait).
//     As prey, cannot be eaten by predators without venom resistance trait.
//     Substantial metabolic cost
//   Venom resistance: boolean trait, negates venom trait of predator/prey. Substantial metabolic cost.
// Parasitism
//   Add parasites that can directly extract energy from hosts without killing them (except insofar as they cause energy deficit that leads to death).
//   Some kind of infection/transmission mechanic, parasite population keeps an infected count for each host species, growth rate is capped by per-host infected counts
//   When hosts die, infected ones preferentially-likely to die
// Habitat Requirements
//   hot/cold/air/aquatic add a power cost
//   Biomes list their climate tags
//   If species has any required climate tags that biome doesn't have, cannot live in that biome; do not include during setup
//   If species has any excluded climate tags that biome does have, cannot live in that biome; do not include during setup
// Water
//   Species need 1 water per energy consumed
//   Fat can also store an equal amount of water
//     Track population fat energy & water separately. Same cap for each, non-exclusive.
//   Bid/claim from water sources, just like how forage works
//   Water-storing trait adds to water storage cap, but also adds to metabolic cost (less than a like amount of fat stat would, though)
//   Water-efficiency trait reduces water needs per energy consumed, but also adds to metabolic cost
// Seasons
//   Biomes have a "seasonality" subobject that determines how much resource spawn rates fluctuate over the course of a year?
//   { min: number, period: number (days) } (max is 1.0)
//   Enhance to vary per resource type. E.g. fruit peaks in autumn, leaves in spring/summer, etc.
// Plants
//   Add plant species, use ground-water and sunlight, ARE composed of various forages?
//   Sunlight produced daily, rots 100% daily, and "eating" it doesn't consume it.
//   E.g. the day has a sunlight intensity value, differing plants can use up to some max amount. E.g. trees can use more sun than a strawberry can
//   Include the plants' forage values when bidding/consuming, if they get eaten then kill some of the plant population
//   Rain and sun are anti-correlated, so on rainy days there is less sun and vice versa. Maybe also have some random variation in sun independent of rain?
//   Surface water "decays" into ground water at a constant rate
//     Usually fast enough that a rainy day will sink in in a day or three
//     Several consecutive heavy-rain days might overwhelm the ground water capacity and lead to some excess surface water remaining for a while, though
//   Plants only use ground water
//   Biome has a ground water capacity cap
//   Add (tiny) amounts of water to various forage types

const log = {
  energyDeficits: false,
};

let species = [];
for (const key in speciesDefinitions) {
  species.push(structuredClone(speciesDefinitions[key]));
}

const population = [];
for (const s of species) {
  const metabolism = (s.diet.length -1) + (s.drinks.length -1);
  const abilities = s.speed + s.vision ** 2 + s.attack + Math.sqrt(s.fat)/10 + ((s.fecundity ?? 1) - 1)/10;

  s.power = (metabolism + abilities) * s.size;

  if (isNaN(s.power)) {
    console.log('Error: species power is NaN');
    console.log('species:', s.name);
    console.log('diet size:', s.diet.length);
    console.log('drinks size:', s.drinks.length);
    console.log('abilities:');
    console.log('  speed:', s.speed);
    console.log('  vision:', s.vision, s.vision ** 2);
    console.log('  attack:', s.attack);
    console.log('  fat:', s.fat, Math.sqrt(s.fat)/10);
    console.log('  fecundity:', s.fecundity, ((s.fecundity ?? 1) - 1)/10);
    console.log('size:', s.size);
  }

  s.thirst = s.power;
  s.appetite = Math.ceil(100 * s.size ** 0.9 + 1);
  const initialPop = Math.floor(2 + 10 / s.size); // Start with smaller populations for larger animals to avoid immediate overconsumption;
  const initialFat = s.fat > 0 ? 0.1 : 0; // Start with 10% of max fat reserves, if they have any fat capacity

  population.push({
    species: s,
    count: initialPop,
    fat: initialFat,
  });
}

const environment = {
  biome: biome,
  food: {
    [forage.leaves]: 0,
    [forage.grass]: 0,
    [forage.seeds]: 0,
    [forage.nuts]: 0,
    [forage.fruit]: 0,
    [forage.algae]: 0,
    [forage.lichen]: 0,
    [forage.wood]: 0,
    [forage.carrion]: 0,
  },
  water: {
    [water.fresh]: 0,
    [water.salt]: 0,
  },
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
    const s = pop.species;
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
      netEnergy += consumption[food] * getEnergyYield(food, species);
      if (forageDefinitions[food].water) {
        netWater += consumption[food] * forageDefinitions[food].water;
      }
    }

    // Lose energy for basic hunger
    netEnergy -= pop.species.power * pop.count;

    if (netEnergy < 0 && log.energyDeficits) {
      console.log(`Population ${pop.species.name} has energy deficit of ${-netEnergy.toFixed(1)}`);
      console.log(`  Consumed:`);
      for (const food in consumption) {
        console.log(`    ${food}: ${consumption[food].toFixed(1)} (energy ${getEnergyYield(food, species)}, water ${forageDefinitions[food].water ?? 0})`);
      }
    }

    netEnergyByPopulation.push(netEnergy);
  }

  // Update population counts based on satisfaction
  const deathsByPopulation = [];
  for (let i = 0; i < populations.length; i++) {
    const pop = populations[i];
    const species = pop.species;
    let netEnergy = netEnergyByPopulation[i];

    if (netEnergy < 0) {
      let fatUsed = 0;
      if (species.fat > 0) {
        // If any fat reserves, withdraw from fat to cover deficit
        const fatFraction = pop.fat;
        const fatPerMember = species.fat * species.size;
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
      let deaths = roundRandom(-netEnergy / species.power / 4);

      if (deaths === 0 && pop.count === 1) {
        if (randBool(1/100)) deaths = 1; // Even with enough energy to survive, small chance of going extinct from random events if only 1 member of the population.
      }

      if (isNaN(deaths)) {
        console.log('Error: deaths is NaN');
        console.log('species:', species.name);
        console.log('netEnergy:', netEnergy);
        console.log('species.power:', species.power);
        deaths = 0;
      }

      if (deaths > pop.count) {
        deaths = pop.count;

        console.log(`${species.name} population has gone extinct.`);
        console.log('netEnergy:', netEnergy);
        console.log('species.power:', species.power);
        console.log('Ate:', actualConsumptionByPopulation[i]);
        console.log('Demanded:', demands[i]);
        console.log('Energy from food:');
        for (const food in actualConsumptionByPopulation[i]) {
          console.log(`  ${actualConsumptionByPopulation[i][food]} ${food}: ${actualConsumptionByPopulation[i][food] * getEnergyYield(food, species)}`);
        }
        console.log('Energy spent on metabolism:', -species.power * pop.count);
        console.log('Energy from fat used:', fatUsed);
        console.log('Total net energy:', netEnergy);
      }

      pop.count -= deaths;
      deathsByPopulation[i] = deaths;

    } else if (netEnergy > 0) {
      // Births proportional to energy surplus, capped at 100% growth/day
      const costPerBirth = species.power * 8;
      let cap = Math.floor(pop.count / species.size ** 0.5 * (species.fecundity ?? 1)); // Max births = current population (100% growth)
      if (cap < 1) cap = 1; // Always allow at least 1 birth if sufficient energy
      if (pop.count === 1) cap = 0; // If only 1 member of the population, cannot reproduce asexually, so no births regardless of energy surplus
      let births = Math.min(cap, Math.floor(netEnergy / costPerBirth));

      let birthsWithFatSpend = 0;
      if (species.fat > 0) {
        // If any fat reserves, maybe withdraw from fat to make births possible that wouldn't be with just food energy
        const fatFraction = pop.fat;
        const fatPerMember = species.fat * species.size;
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
        console.log('species:', species.name);
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
      if (species.fat > 0) {
        const fatFraction = pop.fat;
        const fatPerMember = species.fat * species.size;
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
      const carrionAdded = deaths * species.power * (species.size ** 0.5) / (forageDefinitions.carrion.energy + 1) / 5; // Amount of carrion added based on energy of dead members
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
 * @param {{ species: object, count: number }} population
 */
function getFoodDemands(availableFoods, population) {
  const species = population.species;

  const demand = {};
  const canEat = [];

  for (const food in availableFoods) {
    if (availableFoods[food] > 0 && species.diet.includes(food)) {
      canEat.push(food);
    }
  }
  const uncappedFoods = new Set(canEat);

  const scores = {};
  let totalScore = 0;
  for (const food of canEat) {
    const energyYield = getEnergyYield(food, species);
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

  const digestionLimit = species.appetite * population.count;
  let usedDigestion = 0;
  for (const food in demand) {
    usedDigestion += demand[food] * forageDefinitions[food].digestion;
  }
  let unusedDigestion = digestionLimit - usedDigestion;

  while (unusedDigestion > 0 && uncappedFoods.size > 0) {
    const filteredScores = filterObject(preferenceScores, (key) => uncappedFoods.has(key));
    const normalizedScores = normalizeObject(filteredScores);

    for (const food of uncappedFoods) {
      const maxDigestable = unusedDigestion / forageDefinitions[food].digestion;
      const additionalDemand = normalizedScores[food] * maxDigestable;
      demand[food] += additionalDemand;
    }

    for (const food of uncappedFoods) {
      if (demand[food] > availableFoods[food]) {
        demand[food] = availableFoods[food];
        uncappedFoods.delete(food);
      }
    }

    let usedDigestion = 0;
    for (const food in demand) {
      usedDigestion += demand[food] * forageDefinitions[food].digestion;
    }
    unusedDigestion = digestionLimit - usedDigestion;
  }

  return demand;
}

function normalizeObject(obj) {
  let total = 0;
  for (const key in obj) {
    total += obj[key];
  }

  const normalized = {};
  for (const key in obj) {
    normalized[key] = obj[key] / total;
  }

  return normalized;
}

function filterObject(obj, predicate) {
  const filtered = {};
  for (const key in obj) {
    if (predicate(key)) {
      filtered[key] = obj[key];
    }
  }
  return filtered;
}

function canEat(food, species) {
  if (!species.diet.includes(food)) {
    return false;
  }

  if (forageDefinitions[food].aquatic && species.climate.excludes.includes('aquatic')) {
    return false;
  }

  if (forageDefinitions[food].hardness > 0 && species.attack < forageDefinitions[food].hardness) {
    return false;
  }

  return true;
}

/**
 * @param {string} food
 * @param {object} species
 * @return {number} energy yield per unit of food, adjusted for search costs based on species vision
 */
function getEnergyYield(food, species) {
  const mobile = (species.speed > 0);

  const baseEnergy = forageDefinitions[food].energy;

  let searchPenalty = 1;
  if (mobile && forageDefinitions[food].vision > species.vision) {
    searchPenalty += forageDefinitions[food].vision - species.vision;
  }

  return baseEnergy / searchPenalty;
}

function runSim() {
  const days = 100000;

  spawnResources(environment, 1); // Spawn an initial week's worth of resources so populations have something to eat on day 1

  console.log('Initial population:');
  for (const pop of population) {
    let fat = pop.fat ?? 0;
    if (isNaN(fat)) fat = 0;
    const fatPercent = Math.round(fat * 100);
    const fatText = fatPercent > 0 ? ` + ${fatPercent}% fat` : '';
    const countText = formatLargeNumber(pop.count);
    console.log(`- ${pop.species.name} (power ${pop.species.power.toFixed(1)}, appetite ${pop.species.appetite}): ${countText}${fatText}`);
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
    
    // console.log();
    // console.log(`Day ${day + 1}:`);

    // console.log('Population:');
    // for (const pop of population) {
    //   let fat = pop.fat ?? 0;
    //   if (isNaN(fat)) fat = 0;
    //   const fatPercent = Math.round(fat * 100);
    //   const fatText = fatPercent > 0 ? ` + ${fatPercent}% fat` : '';
    //   const countText = formatLargeNumber(pop.count);
    //   console.log(`- ${pop.species.name}: ${countText}${fatText}`);
    // }

    // console.log('Forage:');
    // for (const food in environment.food) {
    //   const amount = environment.food[food];
    //   if (amount > 0) {
    //     console.log(`- ${food}: ${amount}`);
    //   }
    // }
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
      console.log(`- ${pop.species.name}: extinct`);
      continue;
    }

    let fat = pop.fat ?? 0;
    if (isNaN(fat)) fat = 0;
    const fatPercent = Math.round(fat * 100);
    const fatText = fatPercent > 0 ? ` + ${fatPercent}% fat` : '';
    const countText = formatLargeNumber(pop.count);
    console.log(`- ${pop.species.name}: ${countText}${fatText} - total power ${formatLargeNumber(pop.count * pop.species.power)}`);
  }
}

runSim();