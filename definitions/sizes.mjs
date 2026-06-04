import { invertObject } from "../util/object.mjs";

export const sizeNames = {
  micro: 'micro', // Microscopic, like bacteria or plankton
  fine: 'fine', // Ant sized
  tiny: 'tiny', // Mouse/frog sized
  small: 'small', // Cat/rabbit sized
  medium: 'medium', // Dog sized
  big: 'big', // Human sized
  huge: 'huge', // Horse/Bear sized
  giant: 'giant', // Elephant/small Whale sized
  colossal: 'colossal', // Large whales, dinosaurs, redwoods, etc
};

export const sizes = {
  [sizeNames.micro]: 0.005,
  [sizeNames.fine]: 0.04,
  [sizeNames.tiny]: 0.2,
  [sizeNames.small]: 1,
  [sizeNames.medium]: 3,
  [sizeNames.big]: 10,
  [sizeNames.huge]: 40,
  [sizeNames.giant]: 150,
  [sizeNames.colossal]: 1000,
};

const reverseSizeLookup = invertObject(sizes);

const sizeOrder = [
  sizes[sizeNames.micro],
  sizes[sizeNames.fine],
  sizes[sizeNames.tiny],
  sizes[sizeNames.small],
  sizes[sizeNames.medium],
  sizes[sizeNames.big],
  sizes[sizeNames.huge],
  sizes[sizeNames.giant],
  sizes[sizeNames.colossal],
];

export const maxSizeTier = sizeOrder.length - 1;

/**
 * @param {number} size A numeric size like 0.04 for "fine". May be in between defined sizes, like 0.5.
 * @return {{ name: string, size: number, index: number }} The name and numeric size of the closest defined size, and the index of that size in the sizeOrder array (which is used for scaling certain parameters by size).
 */
export function getSizeMetadata(size) {
  let nearestIndex = 0;
  let nearestDistance = Infinity;
  for (let i = 0; i < sizeOrder.length; i++) {
    const distance = Math.abs(size - sizeOrder[i]);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = i;
    }
  }
  const nearestSize = sizeOrder[nearestIndex];
  const nearestName = reverseSizeLookup[nearestSize];
  return { name: nearestName, size: nearestSize, index: nearestIndex };
}