import { forage, water } from "./names.mjs";

const biomes = {
  plains: {
    name: 'plains',
    forage: {
      [forage.leaves]: 20,
      [forage.grass]: 50,
      [forage.seeds]: 20,
      [forage.nuts]: 2,
      [forage.fruit]: 5,
      [forage.algae]: 0.05,
      [forage.lichen]: 0.5,
      [forage.wood]: 0.5,
      [forage.carrion]: 0,
    },
    water: {
      [water.fresh]: 1,
      [water.salt]: 0,
      rain: {
        frequency: 0.3,
        intensity: 20,
      },
    },
    climate: {
      hot: false,
      cold: false,
      aquatic: false,
      air: true,
    },
  },
  forest: {
    name: 'forest',
    forage: {
      [forage.leaves]: 50,
      [forage.grass]: 5,
      [forage.seeds]: 2,
      [forage.nuts]: 10,
      [forage.fruit]: 20,
      [forage.algae]: 0.001,
      [forage.lichen]: 4,
      [forage.wood]: 10,
      [forage.carrion]: 0,
    },
    water: {
      [water.fresh]: 2,
      [water.salt]: 0,
      rain: {
        frequency: 0.5,
        intensity: 50,
      },
    },
    climate: {
      hot: false,
      cold: false,
      aquatic: false,
      air: true,
    },
  },
  swamp: {
    name: 'swamp',
    forage: {
      [forage.leaves]: 10,
      [forage.grass]: 10,
      [forage.seeds]: 1,
      [forage.nuts]: 2,
      [forage.fruit]: 5,
      [forage.algae]: 10,
      [forage.lichen]: 0.1,
      [forage.wood]: 5,
      [forage.carrion]: 1,
    },
    water: {
      [water.fresh]: 10,
      [water.salt]: 2,
      rain: {
        frequency: 0.4,
        intensity: 30,
      },
    },
    climate: {
      hot: false,
      cold: false,
      aquatic: true,
      air: true,
    },
  },
  desert: {
    name: 'desert',
    forage: {
      [forage.leaves]: 0.1,
      [forage.grass]: 0.2,
      [forage.seeds]: 0.1,
      [forage.nuts]: 0.01,
      [forage.fruit]: 0.1,
      [forage.algae]: 0,
      [forage.lichen]: 0.01,
      [forage.wood]: 0.5,
      [forage.carrion]: 0.5,
    },
    water: {
      [water.fresh]: 0.1,
      [water.salt]: 0,
      rain: {
        frequency: 0.02,
        intensity: 5,
      },
    },
    climate: {
      hot: true,
      cold: false,
      aquatic: false,
      air: true,
    },
  },
  lake: {
    name: 'lake',
    forage: {
      [forage.leaves]: 2,
      [forage.grass]: 5,
      [forage.seeds]: 0.05,
      [forage.nuts]: 0.01,
      [forage.fruit]: 0.05,
      [forage.algae]: 50,
      [forage.lichen]: 4,
      [forage.wood]: 2,
      [forage.carrion]: 0.1,
    },
    water: {
      [water.fresh]: 1000,
      [water.salt]: 20,
      rain: {
        frequency: 0.4,
        intensity: 30,
      },
    },
    climate: {
      hot: false,
      cold: false,
      aquatic: true,
      air: true,
    },
  }
};

export const biome = biomes.plains;