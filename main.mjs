import { overrideConsoleWarnAndErrorTextColors } from "./util/logging.mjs";
overrideConsoleWarnAndErrorTextColors();

import Environment from "./classes/environment.mjs";
import Population from "./classes/population.mjs";
import Species from "./classes/species.mjs";
import { biome } from "./definitions/biomes.mjs";
import { speciesDefinitions } from "./definitions/species.mjs";
import { runSim } from "./simulation.mjs";
import Constants from "./constants.mjs";

const species = Object.values(speciesDefinitions).map(def => new Species(def));
const population = species.map(s => new Population(s));
const environment = Environment.generate(biome);

runSim(environment, population, Constants.sim.days);