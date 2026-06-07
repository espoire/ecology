import { forage, water } from "./names.mjs";

export const biomeDefinitions = {
  forest: {
    name: 'forest',
    climate: 'temperate',
    cover: 2000,
    forage: {
      [forage.leaves]: 80000,
      [forage.grass]: 5000,
      [forage.seeds]: 2000,
      [forage.nuts]: 20000,
      [forage.fruit]: 20000,
      [forage.algae]: 500,
      [forage.lichen]: 10000,
      [forage.wood]: 20000,
      [forage.carrion]: 10,
    },
  },
  plains: {
    name: 'plains',
    climate: 'temperate',
    cover: 500,
    forage: {
      [forage.leaves]: 20000,
      [forage.grass]: 50000,
      [forage.seeds]: 20000,
      [forage.nuts]: 2000,
      [forage.fruit]: 5000,
      [forage.algae]: 50,
      [forage.lichen]: 500,
      [forage.wood]: 500,
      [forage.carrion]: 10,
    },
  },
  swamp: {
    name: 'swamp',
    climate: 'temperate',
    cover: 1000,
    forage: {
      [forage.leaves]: 10000,
      [forage.grass]: 10000,
      [forage.seeds]: 2000,
      [forage.nuts]: 2500,
      [forage.fruit]: 5000,
      [forage.algae]: 10000,
      [forage.lichen]: 1000,
      [forage.wood]: 5000,
      [forage.carrion]: 100,
    },
  },
  desert: {
    name: 'desert',
    climate: 'arid',
    cover: 100,
    forage: {
      [forage.leaves]: 1000,
      [forage.grass]: 2000,
      [forage.seeds]: 1000,
      [forage.nuts]: 100,
      [forage.fruit]: 1000,
      [forage.algae]: 0,
      [forage.lichen]: 100,
      [forage.wood]: 5000,
      [forage.carrion]: 10,
    },
  },
  tundra: {
    name: 'tundra',
    climate: 'polar',
    cover: 200,
    forage: {
      [forage.leaves]: 1000,
      [forage.grass]: 5000,
      [forage.seeds]: 200,
      [forage.nuts]: 100,
      [forage.fruit]: 100,
      [forage.algae]: 0,
      [forage.lichen]: 20000,
      [forage.wood]: 1500,
      [forage.carrion]: 10,
    },
  },
  lake: {
    name: 'lake',
    climate: 'temperate',
    cover: 1200,
    forage: {
      [forage.leaves]: 2000,
      [forage.grass]: 10000,
      [forage.seeds]: 500,
      [forage.nuts]: 100,
      [forage.fruit]: 500,
      [forage.algae]: 100000,
      [forage.lichen]: 20000,
      [forage.wood]: 4000,
      [forage.carrion]: 50,
    },
  },
};

// This list exists to make the above more human-browsable
const biomes = {
  plains: biomeDefinitions.plains,
  forest: biomeDefinitions.forest,
  swamp: biomeDefinitions.swamp,
  desert: biomeDefinitions.desert,
  lake: biomeDefinitions.lake,
  tundra: biomeDefinitions.tundra,
};

export const biome = 'forest';