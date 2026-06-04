import { ensureArray } from "./util/array.mjs";

const Settings = {
  log: {
    energyDeficits: false,
    deaths: false,
    extinctions: false, // 'verbose' | 'terse' | false
    initialPopulations: true,
    initialEnvironment: false,
    extinctPopulationsInFinalRankings: true,
    foodChain: false,
    predation: false,
    speciesPower: [], // Set to a species name to log detailed power calculation for that species whenever it's initialized or re-initialized
  },
  export: {
    disable: false,
    includeDayNumber: false,
    species: 'total-energy', // 'count' | 'total-energy' | false
    forage: false, // boolean
    logScale: true, // boolean
  },
};

Settings.log.speciesPower = ensureArray(Settings.log.speciesPower);

export default Settings;