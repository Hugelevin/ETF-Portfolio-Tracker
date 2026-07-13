import type {
  Instrument,
  MarketPoint,
  MarketQuote,
  PortfolioSummary,
  PositionMetrics,
  PurchaseLot,
} from "../types";

export function calculatePosition(
  instrument: Instrument,
  lots: PurchaseLot[],
  quote: MarketQuote | null,
): PositionMetrics {
  const totalShares = lots.reduce((sum, lot) => sum + lot.shares, 0);
  const purchaseCostExcludingFees = lots.reduce(
    (sum, lot) => sum + lot.shares * lot.pricePerShare,
    0,
  );
  const totalCost = lots.reduce(
    (sum, lot) => sum + lot.shares * lot.pricePerShare + lot.fees,
    0,
  );
  const averagePurchasePrice =
    totalShares > 0 ? purchaseCostExcludingFees / totalShares : 0;
  const currentValue = quote ? totalShares * quote.price : null;
  const profitLoss = currentValue === null ? null : currentValue - totalCost;
  const profitLossPercentage =
    profitLoss === null || totalCost <= 0 ? null : (profitLoss / totalCost) * 100;
  const dailyChange =
    quote?.previousClose == null
      ? null
      : totalShares * (quote.price - quote.previousClose);
  const dailyChangePercentage =
    quote?.previousClose == null || quote.previousClose <= 0
      ? null
      : ((quote.price - quote.previousClose) / quote.previousClose) * 100;

  return {
    instrument,
    lots,
    totalShares,
    totalCost,
    averagePurchasePrice,
    currentValue,
    profitLoss,
    profitLossPercentage,
    dailyChange,
    dailyChangePercentage,
    quote,
  };
}

export interface PositionValuePoint {
  timestamp: string;
  investedValue: number;
  marketValue: number;
}

export interface PeriodPerformance {
  value: number;
  percentage: number;
  referenceTimestamp: string;
}

export function calculatePeriodPerformance(
  history: MarketPoint[],
  period: "1W" | "1M",
): PeriodPerformance | null {
  const sorted = [...history].sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
  const latest = sorted.at(-1);
  if (!latest) return null;

  const target = new Date(latest.timestamp);
  if (period === "1W") {
    target.setUTCDate(target.getUTCDate() - 7);
  } else {
    target.setUTCMonth(target.getUTCMonth() - 1);
  }

  const reference = sorted
    .filter((point) => Date.parse(point.timestamp) <= target.getTime())
    .at(-1);
  if (!reference || reference.close <= 0) return null;

  const value = latest.close - reference.close;
  return {
    value,
    percentage: (value / reference.close) * 100,
    referenceTimestamp: reference.timestamp,
  };
}

export function buildPositionValueHistory(
  lots: PurchaseLot[],
  history: MarketPoint[],
): PositionValuePoint[] {
  return history.map((point) => {
    const pointDate = point.timestamp.slice(0, 10);
    const ownedLots = lots.filter((lot) => lot.purchaseDate <= pointDate);
    const shares = ownedLots.reduce((sum, lot) => sum + lot.shares, 0);
    const investedValue = ownedLots.reduce(
      (sum, lot) => sum + lot.shares * lot.pricePerShare + lot.fees,
      0,
    );

    return {
      timestamp: point.timestamp,
      investedValue,
      marketValue: shares * point.close,
    };
  });
}

export function calculatePortfolioSummary(
  positions: PositionMetrics[],
  baseCurrency: string,
): PortfolioSummary {
  const baseCurrencyPositions = positions.filter(
    (position) => position.instrument.currency === baseCurrency,
  );
  const pricedPositions = baseCurrencyPositions.filter(
    (position) => position.currentValue !== null,
  );
  const totalInvested = baseCurrencyPositions.reduce(
    (sum, position) => sum + position.totalCost,
    0,
  );
  const currentValue = pricedPositions.reduce(
    (sum, position) => sum + (position.currentValue ?? 0),
    0,
  );
  const pricedCost = pricedPositions.reduce(
    (sum, position) => sum + position.totalCost,
    0,
  );
  const profitLoss = currentValue - pricedCost;
  const dailyChangePositions = pricedPositions.filter(
    (position) => position.dailyChange !== null,
  );
  const dailyChange = dailyChangePositions.length
    ? dailyChangePositions.reduce((sum, position) => sum + (position.dailyChange ?? 0), 0)
    : null;
  const nonBaseCurrencyPositionIds = positions
    .filter((position) => position.instrument.currency !== baseCurrency)
    .map((position) => position.instrument.id);
  const missingPricePositionIds = baseCurrencyPositions
    .filter((position) => position.currentValue === null)
    .map((position) => position.instrument.id);
  const excludedPositionIds = [...missingPricePositionIds, ...nonBaseCurrencyPositionIds];

  return {
    totalInvested,
    currentValue,
    profitLoss,
    profitLossPercentage:
      pricedCost > 0 ? (profitLoss / pricedCost) * 100 : null,
    dailyChange,
    dailyChangePositions: dailyChangePositions.length,
    pricedPositions: pricedPositions.length,
    baseCurrencyPositions: baseCurrencyPositions.length,
    totalPositions: positions.length,
    excludedPositionIds,
    missingPricePositionIds,
    nonBaseCurrencyPositionIds,
  };
}
