import Species from "./classes/species.mjs";
import { biome } from "./definitions/biome.mjs";
import { forage, water } from "./definitions/names.mjs";
import { speciesDefinitions } from "./definitions/species.mjs";
import { runSim } from "./simulation.mjs";

const species = Object.values(speciesDefinitions).map(def => new Species(def));

const population = species.map(s => ({
  species: s,
  count: s.getInitialPopulation().population,
  fat: s.getInitialFatPercentage(),
}));

const environment = Environment.generate(biome);

runSim(environment, population, 10000);