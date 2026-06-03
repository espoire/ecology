import { forage } from "./names.mjs";

export const forageDefinitions = {
  [forage.nuts]: {
    energy: 10,
    adaptationCost: 2,
  },
  [forage.seeds]: {
    energy: 9,
    adaptationCost: 1,
  },
  [forage.carrion]: {  // Also enables predation (although weapons:1 is needed to actually establish a predator-prey relationship against anything)
    energy: 8,
    water: 1,
    adaptationCost: 2,
  },
  [forage.fruit]: {
    energy: 6,
    water: 10,
    adaptationCost: 1,
  },
  [forage.grass]: {
    energy: 5,
    water: 4,
    adaptationCost: 2,
  },
  [forage.leaves]: {
    energy: 4,
    water: 4,
    adaptationCost: 2,
  },
  [forage.algae]: {
    energy: 3,
    water: 1,   // TODO: water is inverted if no 'salt' water drinking adaptation
    adaptationCost: 2,
  },
  [forage.wood]: {
    energy: 3,
    adaptationCost: 4,
  },
  [forage.lichen]: {
    energy: 2.5,
    adaptationCost: 2.5,
  },
};