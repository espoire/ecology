import { forage } from "./names.mjs";
import { seasons } from "./seasons.mjs";

export const climates = {
  temperate: {
    name: 'temperate',
    forage: {
      [forage.algae]: {
        [seasons.spring]: 1,
        [seasons.summer]: 0.6,
        [seasons.autumn]: 0.7,
        [seasons.winter]: 0.2,
      },
      [forage.carrion]: {
        [seasons.spring]: 0.2,
        [seasons.summer]: 0.1,
        [seasons.autumn]: 0.15,
        [seasons.winter]: 1,
      },
      [forage.fruit]: {
        [seasons.spring]: 0.15,
        [seasons.summer]: 0.85,
        [seasons.autumn]: 1,
        [seasons.winter]: 0,
      },
      [forage.grass]: {
        [seasons.spring]: 1,
        [seasons.summer]: 0.7,
        [seasons.autumn]: 0.55,
        [seasons.winter]: 0.05,
      },
      [forage.leaves]: {
        [seasons.spring]: 0.6,
        [seasons.summer]: 1,
        [seasons.autumn]: 0.7,
        [seasons.winter]: 0,
      },
      [forage.lichen]: {
        [seasons.spring]: 0.9,
        [seasons.summer]: 1,
        [seasons.autumn]: 0.9,
        [seasons.winter]: 0.7,
      },
      [forage.nuts]: {
        [seasons.spring]: 0,
        [seasons.summer]: 0.2,
        [seasons.autumn]: 1,
        [seasons.winter]: 0,
      },
      [forage.seeds]: {
        [seasons.spring]: 0.35,
        [seasons.summer]: 0.6,
        [seasons.autumn]: 1,
        [seasons.winter]: 0.025,
      },
      [forage.wood]: {
        [seasons.spring]: 0.65,
        [seasons.summer]: 1,
        [seasons.autumn]: 0.75,
        [seasons.winter]: 0.2,
      },
    },
  },
};