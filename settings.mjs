import { ensureArray } from "./util/array.mjs";

const Settings = {
  export: {
    disable: true,
    dayInterval: 1, // Exported data will have one entry per this many days
    includeDayNumber: false,
    species: 'total-energy', // 'count' | 'total-energy' | false
    forage: false, // boolean
    forageSpawns: false, // boolean
    logScale: true, // boolean
  },
  tuning: {
    resourceSpawnMultiplier: 1,
  },
  log: {
    energyDeficits: false,
    deaths: false,
    extinctions: 'terse', // 'verbose' | 'terse' | false
    initialPopulations: true,
    initialEnvironment: false,
    extinctPopulationsInFinalRankings: true,
    foodChain: false,
    predation: false,
    omittedBiomeClimate: true,
    dungProduction: false,

    subviableStartingPopulations: true, // Log whenever a species starts with a population below the minimum needed to sustain itself (which may indicate an error in the species definition or initialization process)
    energyEconomicallyUnderwaterSpecies: true,
    
    species: {
      // Add species names to log detailed calculations for that species whenever it's initialized or re-initialized
      // 'all' or '*' can be used to log all species

      upkeep: [],
      fecundity: [],
    },
  },
};

for (const key in Settings.log.species) {
  Settings.log.species[key] = ensureArray(Settings.log.species[key]);
}

export default Settings;