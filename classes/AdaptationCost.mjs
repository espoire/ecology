import Constants from "../constants.mjs";
import { forageDefinitions } from "../definitions/forages.mjs";
import { first, sum, tail } from "../util/array.mjs";
import { formatSmallNumber } from "../util/number.mjs";
import { sortBy } from "../util/sort.mjs";
import { glyph } from "../util/string.mjs";

export default class AdaptationCost {
  /**
   * @param {Object<string, number | string | boolean>} adaptations
   * @return {{
   *   total: number,
   *   subtotal: number,
   *   costs: { type: string, cost: number, base: number, modifiers: { label: string, description?: string, multiplier?: number, flat?: number }[] }[],
   *   modifiers: { label: string, description?: string, multiplier?: number, flat?: number }[]
   * }}
   */
  static calculateUpkeep(adaptations) {
    // Add base cost
    const costs = [{
      type: 'base',
      cost: Constants.energy.upkeep.base,
    }];

    // Add diet costs
    costs.push(...AdaptationCost.getDietCost(adaptations.diet, adaptations.size));

    // Add all other adaptations costs
    for (const [type, value] of Object.entries(adaptations)) {
      const costObj = AdaptationCost.getModified(type, value, adaptations);
      if (costObj) costs.push(costObj);
    }

    // Sum
    const subtotal = sum(costs.map(c => c.cost));

    // Apply global synergies/anti-synergies that affect the entire upkeep cost
    const globalSynergyObj = AdaptationCost.getGlobalSynergies(adaptations);
    const total = subtotal * globalSynergyObj.multiplier + globalSynergyObj.flat;

    return {
      total,
      subtotal,
      costs,
      modifiers: globalSynergyObj.reasons,
    };
  }

  /**
   * @param {{
   *   total: number,
   *   subtotal: number,
   *   costs: { type: string, cost: number, base: number, modifiers: { label: string, description?: string, multiplier?: number, flat?: number }[] }[],
   *   modifiers: { label: string, description?: string, multiplier?: number, flat?: number }[]
   * }} explanationObj
   * @param {boolean} verbose
   * @returns {string[]} An array of strings explaining the total upkeep cost, including breakdowns by adaptation and modifiers.
   */
  static explainUpkeep(explanationObj, { verbose = false } = {}) {
    const ret = [];

    ret.push(`Total Upkeep: ${formatSmallNumber(explanationObj.total)} P`);
    for (const costObj of explanationObj.costs) {
      ret.push(...AdaptationCost.explainCost(costObj, { verbose }));
    }

    ret.push(`Subtotal: ${formatSmallNumber(explanationObj.subtotal)} P`);

    // global modifiers
    const modifiers = explanationObj.modifiers;
    if (modifiers) for (const modifier of modifiers) {
      ret.push(`  ${AdaptationCost.explainModifier(modifier, { verbose })}`);
    }

    return ret;
  }

  /**
   * @param {{ type: string, value?: number | string | boolean, cost: number, base: number, modifiers?: { label: string, description?: string, multiplier?: number, flat?: number }[] }} costObj
   * @param {boolean} verbose
   * @returns {string[]} An array of strings explaining the cost
   */
  static explainCost(costObj, { verbose = false } = {}) {
    const { type, value, cost, base, modifiers } = costObj;
    const ret = [];

    let typeTag = '';
    if (typeof value === 'string') typeTag = `${value}`;
    else if (typeof value === 'number') typeTag = `${type} ${value}`;
    else if (value === true) typeTag = type;
    else                     typeTag = type;

    const sp = cost < 10 ? ' ' : ''; // space padding for alignment of decimal points
    let header = `  ${sp}${cost.toFixed(2)} P  <=  ${typeTag}`;
    if (base != null && cost !== base) {
      header += `  (base ${formatSmallNumber(base)} P)`;
    }

    ret.push(header);

    if (modifiers) for (const modifier of modifiers) {
      ret.push(`       ${AdaptationCost.explainModifier(modifier, { verbose })}`);
    }

    return ret;
  }

  static explainModifier(modifier, { verbose = false } = {}) {
    const { label, description, multiplier, flat } = modifier;

    let line = [];

    const hasMultiplier = (multiplier != null && multiplier !== 1);
    const hasFlat = (flat != null && flat !== 0);

    const amountText = [];
    if (multiplier != null && multiplier !== 1) amountText.push(`${glyph.cross}${formatSmallNumber(multiplier)}`);
    if (flat != null && flat !== 0) amountText.push(`+${formatSmallNumber(flat)} P`);

    line.push(amountText.join(' & '));
    line.push(` ${label}`);
    if (description && verbose) line.push(`: ${description}`);

    return line.join('');
  }

  /**
   * @param {string[]} diet Forage type names
   * @param {number} size
   * 
   * @returns {{
   *   type: string,
   *   cost: number,
   *   base: number,
   *   modifiers: { label: string, description: string, multiplier?: number, flat?: number }[]
   * }[]} An object collection describing and explaining the cost of each diet adaptation
   */
  static getDietCost(diet, size) {
    const cost = AdaptationCost.getBaseDietCost;
    const ret = [];
    
    const sortedDiet = diet.sort(sortBy(cost, 'descending'));
    const mostExpensiveDietAdaptation = first(sortedDiet);
    const restDietAdaptations = tail(-1, sortedDiet);

    const firstDietPresize = cost(mostExpensiveDietAdaptation);
    const firstDietSizeCostModification = AdaptationCost.getSizeScaling(firstDietPresize, size, 1);
    const firstDietCost = firstDietPresize + firstDietSizeCostModification;

    ret.push({
      type: `diet: ${mostExpensiveDietAdaptation}`,
      cost: firstDietCost,
      base: firstDietPresize,
      modifiers: [
        ...(firstDietSizeCostModification ? [{
          label: 'size scaling',
          description: `size ${size}`,
          flat: firstDietSizeCostModification,
        }] : [])
      ],
    });
    
    const additionalDietDiscount = Constants.adaptation.synergies.omnivory;
    const fractionOfAdditionalDietCostWhichScalesWithSize = 0.8;

    let totalAdditionalDietCost = 0;
    let totalAdditionalDietBaseCost = 0;
    for (const dietAdaptation of restDietAdaptations) {
      const additionalDietBaseCost = cost(dietAdaptation);
      const additionalDietPresizeCost = additionalDietBaseCost * additionalDietDiscount;
      const additionalDietSizeCostModification = AdaptationCost.getSizeScaling(additionalDietPresizeCost, size, fractionOfAdditionalDietCostWhichScalesWithSize);
      const additionalDietCost = additionalDietPresizeCost + additionalDietSizeCostModification;

      totalAdditionalDietCost += additionalDietCost;
      totalAdditionalDietBaseCost += additionalDietBaseCost;

      ret.push({
        type: `diet: ${dietAdaptation}`,
        cost: additionalDietCost,
        base: additionalDietBaseCost,
        modifiers: [
          {
            label: 'omnivory synergy',
            description: `additional diet adaptations cost less`,
            multiplier: additionalDietDiscount,
          },
          ...(additionalDietSizeCostModification ? [{
            label: 'size scaling',
            description: `size ${size}`,
            flat: additionalDietSizeCostModification,
          }] : [])
        ],
      });
    }

    const additionalDietBaseCost = sum(restDietAdaptations.map(cost));
    const additionalDietPresizeCost = additionalDietBaseCost * additionalDietDiscount;
    const additionalDietSizeCostModification = AdaptationCost.getSizeScaling(additionalDietPresizeCost, size, fractionOfAdditionalDietCostWhichScalesWithSize);
    const additionalDietCosts = additionalDietPresizeCost + additionalDietSizeCostModification;

    const dietCosts = firstDietCost + additionalDietCosts;

    const totalBaseCost = firstDietPresize + additionalDietBaseCost;

    return ret;
  }

  /**
   * Gets the individual cost of a single adaptation, accounting for size and snyergy/anti-synergy.
   * 
   * @param {string} type
   * @param {number | string | boolean} value
   * @param {Object<string, number | string | boolean>} allAdaptations
   * @returns {{
   *   type: string,
   *   cost: number,
   *   base: number,
   *   modifiers: { label: string, description: string, multiplier?: number, flat?: number }[]
   * }?} An object describing and explaining the cost of the adaptation
   */
  static getModified(type, value, allAdaptations) {
    const baseCost = AdaptationCost.getBase(type, value);
    if (baseCost == null) return null;

    const synergy = AdaptationCost.getSynergy(type, value, allAdaptations);

    const presize = baseCost * synergy.multiplier + synergy.flat;
    const sizeCost = AdaptationCost.getSizeScaling(presize, allAdaptations.size, type);
    const cost = presize + sizeCost;

    const ret = {
      type,
      value,
      cost: cost,
      base: baseCost,
      modifiers: [
        ...(synergy.reasons ?? []),
        ...(sizeCost ? [{
          label: 'size scaling',
          description: `size ${allAdaptations.size}`,
          flat: sizeCost,
        }] : []),
      ],
    }

    return ret;
  }

  static getSynergy(type, value, allAdaptations) {
    const synergies = [];

    switch (type) {
      case 'fat':
        if (allAdaptations.flying) {
          synergies.push({
            label: 'flying anti-synergy',
            description: 'fat too heavy for flying',
            multiplier: 2.5,
          });
        };
        break;
      case 'armor':
        if (allAdaptations.flying) {
          synergies.push({
            label: 'flying anti-synergy',
            description: 'armor too heavy for flying',
            multiplier: 2.5,
          });
        };
        break;
      case 'speed':
        // 0.9 chosen so that flying-predator almost-but-not-quite breaks even with reach-predator
        // So that flying-predator dominats at speed > 3, reach dominates at speed < 2, and they're debatable at speed = 2 or 3
        // (Predator speed 2: flying is more costly than reach, but you also get the flying defensive benefit, so it's not a clear-cut choice either way.)
        if (allAdaptations.flying) {
          synergies.push({
            label: 'flying synergy',
            description: 'flying makes it easier to go fast',
            multiplier: 0.9,
          });
        }
        break;
    }

    const { multiplier, flat } = AdaptationCost.#tallySynergies(synergies);
    return { multiplier, flat, reasons: synergies };
  }

  static getGlobalSynergies(adaptations) {
    const synergies = [];

    if ((adaptations.speed ?? 0) === 0) synergies.push({
      label: 'global: speed 0',
      description: 'sessile: immobile species use less energy in general',
      multiplier: 0.95,
    });

    if (Constants.energy.upkeep.multiplier !== 1) {
      synergies.push({
        label: 'global: tuning factor',
        multiplier: Constants.energy.upkeep.multiplier,
      });
    }

    const { multiplier, flat } = AdaptationCost.#tallySynergies(synergies);
    return { multiplier, flat, reasons: synergies };
  }

  static #tallySynergies(synergies) {
    let multiplier = 1;
    let flat = 0;

    for (const synergy of synergies) {
      multiplier *= (synergy.multiplier ?? 1);
      flat += (synergy.flat ?? 0);
    }

    return { multiplier, flat };
  }

  static getCostSizeScaling(type) {
    switch (type) {
      case 'size': return 0; // Size cost does not scale doubly with itself
      case 'fat': return 0;
      case 'armor': return 0.7;
      case 'venom': return 0.9;
    }

    return 1;
  }

  /**
   * Gets the base cost of a single adaptation, without accounting for size or synergy/anti-synergy.
   * 
   * @param {string} type
   * @param {number | string | boolean} value
   */
  static getBase(type, value) {
    switch (type) {
      case 'size': return value ** 1.2 * 0.95;
      case 'fat': return 3 * value;
      case 'weapons': return 3 * value;
      case 'armor': return 2 * value;
      case 'speed': return 3 * value;
      case 'fecundity': return 1 * value;
      case 'reach': return 3;
      case 'venom':
        if (value === 'venom') return 6 + 5;
        if (value === 'anti-venom') return 5;
        break;
      case 'flying': return 4;
      case 'multikill': return 4 * value;
    }
  }

  /**
   * Gets the base cost of a diet adaptation, without accounting for size or synergy/anti-synergy.
   * 
   * @param {string} forageType
   * @returns {number}
   */
  static getBaseDietCost(forageType) {
    return forageDefinitions[forageType].adaptationCost;
  }

  /**
   * 
   * @param {number} presizeCost
   * @param {number} size
   * @param {number | string} fractionOrType The numeric scaling fraction, or an adaptation type name used to look up that fraction.
   * @returns {number}
   */
  static getSizeScaling(presizeCost, size, fractionOrType = 1) {
    let scaling;
    if (typeof fractionOrType === 'string') {
      scaling = AdaptationCost.getCostSizeScaling(fractionOrType);
    } else {
      scaling = fractionOrType;
    }

    return presizeCost * scaling * (size - 1);
  }
}