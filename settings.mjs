import { ensureArray } from "./util/array.mjs";

const Settings = {
  log: {
    energyDeficits: false,
    energyEconomicallyUnderwaterSpecies: true,
    deaths: false,
    extinctions: 'terse', // 'verbose' | 'terse' | false
    initialPopulations: true,
    initialEnvironment: false,
    extinctPopulationsInFinalRankings: true,
    foodChain: false,
    predation: false,
    omittedBiomeClimate: true,
    dungProduction: false,
    
    species: {
      // Add species names to log detailed calculations for that species whenever it's initialized or re-initialized
      // 'all' or '*' can be used to log all species

      power: [],
      fecundity: [],
    },
  },
  export: {
    disable: false,
    includeDayNumber: false,
    species: 'total-energy', // 'count' | 'total-energy' | false
    forage: false, // boolean
    forageSpawns: false, // boolean
    logScale: true, // boolean
  },
};

for (const key in Settings.log.species) {
  Settings.log.species[key] = ensureArray(Settings.log.species[key]);
}

export default Settings;