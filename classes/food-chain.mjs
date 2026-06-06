/** @typedef {import("./species.mjs").default} Species */

import Settings from "../settings.mjs";

/**
 * Class providing helper methods for running predation logic.
 */
export default class FoodChain {
  /** @type {Object<string, Object<string, boolean>>} */ #lookup;
  /** @type {Set<Species>} */ #predators;
  /** @type {Set<Species>} */ #prey;
  /** @type {Object<string, Species[]>} */ #preyByPredator;

  /**
   * @param {Species[]} speciesList
   * @returns {} A lookup object where the first key is the predator species name and the second key is the prey species name, and the value is a boolean indicating whether the predator preys on that prey.
   */
  constructor(speciesList) {
    _logMaybe('Initializing food chain with species:', speciesList.map(s => s.name).join(', '));

    const lookup = {};
    const predators = new Set();
    const prey = new Set();
    const preyByPredator = {};

    for (const s1 of speciesList) {
      lookup[s1.name] = {};

      _logMaybe(`Determining prey for possible predator ${s1.name}...`);
      const canBePredator = s1.canBePredator();
      if (!canBePredator.able) {
        _logMaybe(`  ${s1.name} cannot be a predator: ${canBePredator.reason}`);
        continue;
      }

      for (const s2 of speciesList) {

        _logMaybe(`  Can prey on ${s2.name}?`);

        const { able, reason } = s1.canHunt(s2);
        lookup[s1.name][s2.name] = able;

        if (able) {
          predators.add(s1);
          prey.add(s2);

          if (!preyByPredator[s1.name]) preyByPredator[s1.name] = [];
          preyByPredator[s1.name].push(s2);

          _logMaybe(`    Yes, ${s1.name} can prey on ${s2.name}`);
        } else {
          _logMaybe(`    No, ${s1.name} cannot prey on ${s2.name}: ${reason}`);
        }
      }
    }

    this.#lookup = lookup;
    this.#predators = predators;
    this.#prey = prey;
    this.#preyByPredator = preyByPredator;

    _logMaybe(`\n${this.toString()}\n`);
  }

  isPredator(species) {
    return this.#predators.has(species);
  }

  getPreyListForPredator(predatorSpecies) {
    return this.#preyByPredator[predatorSpecies.name] ?? [];
  }

  toString() {
    const tokens = [];

    for (const predator of this.#predators) {
      const preyList = this.#preyByPredator[predator.name] ?? [];
      tokens.push(`- ${predator} eats: \t${preyList.length > 0 ? preyList.join(', ') : 'nothing'}`);
    }

    return `FoodChain(\n${tokens.join('\n')}\n)`;
  }
}

function _logMaybe(...messages) {
  if (Settings.log.foodChain) console.log(...messages);
}