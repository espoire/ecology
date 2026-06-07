import { forage, water } from "../definitions/names.mjs";
import Biome from "./biome.mjs";

export default class Environment {
  static generate(biome) {
    return {
      biome: new Biome(biome),
      food: {
        [forage.leaves]: 0,
        [forage.grass]: 0,
        [forage.seeds]: 0,
        [forage.nuts]: 0,
        [forage.fruit]: 0,
        [forage.algae]: 0,
        [forage.lichen]: 0,
        [forage.wood]: 0,
        [forage.carrion]: 0,
      },
      water: {
        [water.fresh]: 0,
        [water.salt]: 0,
      },
    };
  }
}