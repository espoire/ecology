const Constants = {
  predation: {
    maxSpeciesStartDelay: 20,
    efficiency: 0.75,
    minimumSatiation: 0.05, // A predator won't bother hunting prey that would only satisfy a tiny fraction of its appetite
    
    // Tuning factor for predation success rates at varying population scales.
    // At very large predator & prey populations numbers, hunt suuccess rate approximates 1, and expected kills approaches (num_predators - cover).
    // At very small prey populations, success rate declines noticeably.
    // Success rate = prey / (prey + cover).
    //
    // Examples:
    //   10 predators --> 10 prey @ 40 cover means 20% success rate and 2 expected kills.
    //   1M predators --> 1M prey @ 40 cover means 99.996% success rate and 999,960 expected kills.
    //   1M predators --> 10 prey @ 40 cover means 20% success rate and 200k (clamped to 10) expected kills.
    cover: 100,
  },
  energy: {
    dailyUpkeepFactor: 1/8, // Daily upkeep is this fraction of a species' birth cost, so a species with birthCost 16 would need to gain 2 energy per day to maintain its population
    deathPowerDays: 4, // If a species falls this many days behind on energy upkeep, one member starves
  },
  birth: {
    baseRateCap: 0.1, // 10% of population per day, before size & fecundity adjustments
  },
};

export default Constants;