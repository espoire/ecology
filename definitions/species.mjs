import { sum } from "../util/array.mjs";
import { forage, water } from "./names.mjs";
import { sizeNames, sizes } from "./sizes.mjs";

function between(...sizes) {
  return sum(sizes) / sizes.length;
}

export const speciesDefinitions = {
  rabbit: {
    name: 'rabbit',
    diet: [forage.grass, forage.leaves, forage.seeds],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    fecundity: 12,
    speed: 5,
    armor: 1,
    fat: 15,
    size: sizes[sizeNames.small],
  },
  deer: {
    name: 'deer',
    diet: [forage.grass, forage.leaves, forage.fruit, forage.lichen],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    speed: 4,
    armor: 2,
    fat: 10,
    size: sizes[sizeNames.big],
  },
  mushroom: {
    name: 'mushroom',
    diet: [forage.carrion, forage.wood, forage.leaves],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    size: sizes[sizeNames.tiny],
  },
  squirrel: {
    name: 'squirrel',
    diet: [forage.nuts, forage.seeds, forage.fruit],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    speed: 3,
    armor: 1,
    fat: 0.4,
    size: sizes[sizeNames.tiny],
  },
  ant: {
    name: 'ant',
    diet: [forage.leaves, forage.carrion, forage.fruit, forage.grass],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    speed: 1,
    weapons: 2,
    armor: 3,
    size: sizes[sizeNames.fine],
  },
  fly: {
    name: 'fly',
    diet: [forage.carrion, forage.fruit],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['cold', 'aquatic'],
    },
    speed: 2,
    armor: 1,
    size: sizes[sizeNames.tiny],
  },
  slug: {
    name: 'slug',
    diet: [forage.leaves, forage.wood, forage.carrion, forage.fruit],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold'],
    },
    fecundity: 2.5,
    speed: 1,
    size: sizes[sizeNames.tiny],
  },
  bear: {
    name: 'bear',
    diet: [forage.carrion, forage.fruit, forage.nuts, forage.seeds],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'aquatic'],
    },
    speed: 4,
    weapons: 5,
    armor: 2,
    fat: 80,
    size: sizes[sizeNames.huge],
  },
  bison: {
    name: 'bison',
    diet: [forage.grass, forage.leaves],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'aquatic'],
    },
    speed: 2,
    armor: 3,
    fat: 30,
    size: sizes[sizeNames.huge],
  },
  fish: {
    name: 'fish',
    diet: [forage.algae],
    drinks: [water.fresh, water.salt],
    climate: {
      requires: ['aquatic'],
      excludes: ['hot', 'cold'],
    },
    speed: 1,
    armor: 1,
    fat: 10,
    size: sizes[sizeNames.small],
  },
  yeast: {
    name: 'yeast',
    diet: [forage.carrion, forage.seeds],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    size: sizes[sizeNames.micro],
  },
  termite: {
    name: 'termite',
    diet: [forage.wood],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    speed: 1,
    armor: 1,
    size: sizes[sizeNames.fine],
  },
  fox: {
    name: 'fox',
    diet: [forage.carrion, forage.fruit], // TODO add small animals to diet
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['aquatic'],
    },
    speed: 2,
    weapons: 2,
    armor: 1,
    fat: 5,
    size: sizes[sizeNames.small],
  },
  minnow: {
    name: 'minnow',
    diet: [forage.algae],
    drinks: [water.fresh],
    climate: {
      requires: ['aquatic'],
      excludes: ['hot', 'cold'],
    },
    speed: 1,
    armor: 1,
    fat: 1,
    size: sizes[sizeNames.tiny],
  },
  shrimp: {
    name: 'shrimp',
    diet: [forage.algae, forage.carrion],
    drinks: [water.salt],
    climate: {
      requires: ['aquatic'],
      excludes: ['hot', 'cold'],
    },
    speed: 1,
    armor: 2,
    size: sizes[sizeNames.tiny],
  },
  caribou: {
    name: 'caribou',
    diet: [forage.lichen],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'aquatic'],
    },
    speed: 3,
    armor: 2,
    fat: 20,
    size: sizes[sizeNames.big],
  },
  locust: {
    name: 'locust',
    diet: [forage.grass],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    size: sizes[sizeNames.tiny],
  },
  mantis: {
    name: 'mantis',
    diet: [forage.carrion, forage.grass],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    speed: 1,
    weapons: 5,
    size: between(sizes[sizeNames.fine], sizes[sizeNames.tiny]),
  },
  hawk: {
    name: 'hawk',
    diet: [forage.carrion, forage.fruit],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    speed: 6,
    weapons: 4,
    size: sizes[sizeNames.small],
  },
  spider: {
    name: 'spider',
    diet: [forage.carrion],
    drinks: [water.fresh],
    climate: {
      requires: ['air'],
      excludes: ['hot', 'cold', 'aquatic'],
    },
    speed: 0,
    weapons: 2,
    size: between(sizes[sizeNames.fine], sizes[sizeNames.tiny]),
  },
};