import Species from "./classes/species.mjs";
import { biome } from "./definitions/biome.mjs";
import { forage, water } from "./definitions/names.mjs";
import { speciesDefinitions } from "./definitions/species.mjs";
import { runSim } from "./simulation.mjs";

const species = Object.values(speciesDefinitions).map(def => new Species(def));

const population = [];
for (const s of species) {
  population.push({
    species: s,
    count: s.getInitialPopulation().population,
    fat: s.getInitialFatPercentage(),
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

runSim(environment, population, 10000);