import Environment from "./classes/environment.mjs";
import Population from "./classes/population.mjs";
import Species from "./classes/species.mjs";
import { biome } from "./definitions/biome.mjs";
import { speciesDefinitions } from "./definitions/species.mjs";
import { runSim } from "./simulation.mjs";

const species = Object.values(speciesDefinitions).map(def => new Species(def));
const population = species.map(s => new Population(s));
const environment = Environment.generate(biome);

const k = 1000;
runSim(environment, population, 100*k);