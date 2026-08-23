export function confidenceFromWeight(totalWeight) {
  return Math.min(0.99, Math.max(0.1, totalWeight / 100));
}
