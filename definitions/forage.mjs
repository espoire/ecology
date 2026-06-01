export const forageDefinitions = {
  leaves: {
    energy: 1, // Yield per unit consumed
    digestion: 4, // Max consumed/day = 100 / digestion
    vision: 0, // No sight penalty
  },
  grass: {
    energy: 1,
    digestion: 4,
    vision: 0,
  },
  seeds: {
    energy: 2,
    digestion: 2,
    vision: 1, // If vision < 1, costs 1 extra energy to find
  },
  nuts: {
    energy: 3,
    digestion: 1,
    hardness: 2, // Requires attack >= hardness to consume
    vision: 1,
  },
  fruit: {
    energy: 2,
    water: 1, // Provides 1 water per unit consumed
    digestion: 1,
    vision: 2, // If vision < 2, costs [defecit] extra energy to find
  },
  algae: {
    energy: 1,
    digestion: 3,
    vision: 0,
    aquatic: true, // Consumer cannot exclude aquatic biome to eat this
  },
  lichen: {
    energy: 1,
    digestion: 5,
    vision: 0,
  },
  wood: {
    energy: 0.5,
    digestion: 10,
    vision: 0,
  },
  carrion: {
    energy: 4,
    water: 0.5,
    digestion: 1,
    vision: 2,
  },
};