const Constants = {
  predation: {
    efficiency: 0.75,
    minimumSatiationFraction: 0.05, // A predator won't bother hunting prey that would only satisfy a tiny fraction of its appetite
    missWeight: 0.6, // Relative weight of the "miss" option in predation scoring, modeling the chance that a predator fails to catch anything
  },
  energy: {
    deathPowerDays: 2, // If a species falls this many days behind on energy upkeep, one member starves
  },
};

export default Constants;