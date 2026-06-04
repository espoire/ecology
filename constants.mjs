const Constants = {
  predation: {
    efficiency: 0.75,
    minimumSatiationFraction: 0.05, // A predator won't bother hunting prey that would only satisfy a tiny fraction of its appetite
    missWeight: 0.6, // Relative weight of the "miss" option in predation scoring, modeling the chance that a predator fails to catch anything
  },
  energy: {
    dailyUpkeepFactor: 1/8, // Daily upkeep is this fraction of a species' birth cost, so a species with birthCost 16 would need to gain 2 energy per day to maintain its population
    deathPowerDays: 4, // If a species falls this many days behind on energy upkeep, one member starves
  },
};

export default Constants;