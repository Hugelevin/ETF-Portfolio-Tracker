export function calculatePriceDomain(points: Array<{ price: number }>): [number, number] {
  const prices = points.map((point) => point.price);
  if (!prices.length) return [0, 1];
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const span = maximum - minimum;
  const padding = span > 0 ? span * 0.12 : Math.max(maximum * 0.01, 0.01);
  return [Math.max(0, minimum - padding), maximum + padding];
}
