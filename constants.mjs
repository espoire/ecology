const Constants = {
  predation: {
    efficiency: 0.75,
    minimumSatiationFraction: 0.05, // A predator won't bother hunting prey that would only satisfy a tiny fraction of its appetite
    missWeight: 1.0, // Relative weight of the "miss" option in predation scoring, modeling the chance that a predator fails to catch anything
  },
};

export default Constants;