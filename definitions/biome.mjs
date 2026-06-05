import { forage, water } from "./names.mjs";

const biomeDefinitions = {
  plains: {
    name: 'plains',
    forage: {
      [forage.leaves]: 2000,
      [forage.grass]: 5000,
      [forage.seeds]: 2000,
      [forage.nuts]: 200,
      [forage.fruit]: 500,
      [forage.algae]: 5,
      [forage.lichen]: 50,
      [forage.wood]: 50,
      [forage.carrion]: 0,
    },
  },
  forest: {
    name: 'forest',
    forage: {
      [forage.leaves]: 8000,
      [forage.grass]: 500,
      [forage.seeds]: 200,
      [forage.nuts]: 2000,
      [forage.fruit]: 2000,
      [forage.algae]: 0.1,
      [forage.lichen]: 1000,
      [forage.wood]: 2000,
      [forage.carrion]: 0,
    },
  },
  swamp: {
    name: 'swamp',
    forage: {
      [forage.leaves]: 1000,
      [forage.grass]: 1000,
      [forage.seeds]: 200,
      [forage.nuts]: 250,
      [forage.fruit]: 500,
      [forage.algae]: 1000,
      [forage.lichen]: 100,
      [forage.wood]: 500,
      [forage.carrion]: 10,
    },
  },
  desert: {
    name: 'desert',
    forage: {
      [forage.leaves]: 100,
      [forage.grass]: 200,
      [forage.seeds]: 100,
      [forage.nuts]: 10,
      [forage.fruit]: 100,
      [forage.algae]: 0,
      [forage.lichen]: 10,
      [forage.wood]: 500,
      [forage.carrion]: 1,
    },
  },
  tundra: {
    name: 'tundra',
    forage: {
      [forage.leaves]: 100,
      [forage.grass]: 500,
      [forage.seeds]: 20,
      [forage.nuts]: 10,
      [forage.fruit]: 10,
      [forage.algae]: 0,
      [forage.lichen]: 2000,
      [forage.wood]: 150,
      [forage.carrion]: 0.1,
    },
  },
  lake: {
    name: 'lake',
    forage: {
      [forage.leaves]: 200,
      [forage.grass]: 1000,
      [forage.seeds]: 50,
      [forage.nuts]: 10,
      [forage.fruit]: 50,
      [forage.algae]: 10000,
      [forage.lichen]: 2000,
      [forage.wood]: 400,
      [forage.carrion]: 5,
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

export const biome = biomes.lake;