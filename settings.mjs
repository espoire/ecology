import { ensureArray } from "./util/array.mjs";

const Settings = {
  log: {
    energyDeficits: false,
    deaths: false,
    extinctions: false, // 'verbose' | 'terse' | false
    initialPopulations: false,
    extinctPopulationsInFinalRankings: false,
    foodChain: false,
    predation: false,
    speciesPower: ['gnat', 'bear'], // Set to a species name to log detailed power calculation for that species whenever it's initialized or re-initialized
  },
};

Settings.log.speciesPower = ensureArray(Settings.log.speciesPower);

export default Settings;