import { forageDefinitions } from "../definitions/forages.mjs";
import { forage, water } from "../definitions/names.mjs";
import { mapObjectValues } from "../util/object.mjs";
import Biome from "./biome.mjs";

export default class Environment {
  static generate(biome) {
    return {
      biome: new Biome(biome),
      food: mapObjectValues(forageDefinitions, () => 0),
      water: {
        [water.fresh]: 0,
        [water.salt]: 0,
      },
    };
  }
}