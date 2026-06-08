import { forage } from "./names.mjs";

export const forageDefinitions = {
  [forage.nuts]: {
    energy: 10,
    adaptationCost: 4,
    dung: 0.3,
  },
  [forage.seeds]: {
    energy: 9,
    adaptationCost: 2,
    dung: 0.35,
  },
  [forage.carrion]: {  // Also enables predation (although weapons:1 is needed to actually establish a predator-prey relationship against anything)
    energy: 8,
    water: 1,
    adaptationCost: 4,
    dung: 0.1,
    rotSpeed: 5,
  },
  [forage.fruit]: {
    energy: 6,
    water: 10,
    adaptationCost: 2,
    dung: 0.2,
    rotSpeed: 3,
  },
  [forage.grass]: {
    energy: 5,
    water: 4,
    adaptationCost: 3,
    dung: 0.7,
  },
  [forage.leaves]: {
    energy: 4,
    water: 4,
    adaptationCost: 3.5,
    dung: 0.75,
  },
  [forage.algae]: {
    energy: 3.5,
    water: 1,   // TODO: water is inverted if no 'salt' water drinking adaptation
    adaptationCost: 4,
    dung: 0.4,
  },
  [forage.wood]: {
    energy: 3.5,
    adaptationCost: 8,
    dung: 0.9,
  },
  [forage.lichen]: {
    energy: 3,
    adaptationCost: 5,
    dung: 0.6,
  },
  [forage.dung]: {
    energy: 2,
    adaptationCost: 2,
    rotSpeed: 20,
  },
};