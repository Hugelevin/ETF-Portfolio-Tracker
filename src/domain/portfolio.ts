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
  valuationDate = new Date(),
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
  const totalFees = lots.reduce((sum, lot) => sum + lot.fees, 0);
  const averagePurchasePrice =
    totalShares > 0 ? purchaseCostExcludingFees / totalShares : 0;
  const yieldEstimate = instrument.assetType === "FUND" &&
    instrument.annualYieldPercentage !== undefined
    ? estimateYieldBalance(
        lots,
        instrument.annualYieldPercentage,
        instrument.annualYieldHistory ?? [],
        valuationDate,
      )
    : null;
  // A published price/NAV is authoritative. APY accrual is an explicit fallback
  // for a cash fund when provider NAV data is unavailable.
  const fundNavRatio = instrument.assetType === "FUND" && quote && averagePurchasePrice > 0
    ? quote.price / averagePurchasePrice
    : null;
  const costBasisWarning = fundNavRatio !== null && (fundNavRatio > 5 || fundNavRatio < 0.2)
    ? "The recorded fund purchase price is not comparable with the current NAV. Re-import or review this lot before calculating a return."
    : null;
  const currentValue = costBasisWarning
    ? null
    : quote ? totalShares * quote.price : yieldEstimate?.currentValue ?? null;
  const marketReturn = currentValue === null ? null : currentValue - purchaseCostExcludingFees;
  const marketReturnPercentage = marketReturn === null || purchaseCostExcludingFees <= 0
    ? null
    : (marketReturn / purchaseCostExcludingFees) * 100;
  const profitLoss = currentValue === null ? null : currentValue - totalCost;
  const profitLossPercentage =
    profitLoss === null || totalCost <= 0 ? null : (profitLoss / totalCost) * 100;
  const dailyChange = quote && !costBasisWarning ? (
    quote.previousClose == null
      ? null
      : totalShares * (quote.price - quote.previousClose)
  ) : yieldEstimate?.dailyChange ?? null;
  const dailyChangePercentage = quote && !costBasisWarning ? (
    quote.previousClose == null || quote.previousClose <= 0
      ? null
      : ((quote.price - quote.previousClose) / quote.previousClose) * 100
  ) : yieldEstimate?.dailyChangePercentage ?? null;

  return {
    instrument,
    lots,
    totalShares,
    purchaseCostExcludingFees,
    totalFees,
    totalCost,
    averagePurchasePrice,
    currentValue,
    marketReturn,
    marketReturnPercentage,
    profitLoss,
    profitLossPercentage,
    dailyChange,
    dailyChangePercentage,
    costBasisWarning,
    quote,
  };
}

const DAY_MS = 24 * 60 * 60 * 1_000;

function estimateYieldBalance(
  lots: PurchaseLot[],
  annualYieldPercentage: number,
  annualYieldHistory: NonNullable<Instrument["annualYieldHistory"]>,
  valuationDate: Date,
): { currentValue: number; dailyChange: number; dailyChangePercentage: number } {
  const valuationDay = Date.UTC(
    valuationDate.getFullYear(),
    valuationDate.getMonth(),
    valuationDate.getDate(),
  );
  const rates = [...annualYieldHistory]
    .map((rate) => ({
      day: Date.parse(`${rate.effectiveDate}T00:00:00.000Z`),
      rate: rate.annualYieldPercentage,
    }))
    .sort((left, right) => left.day - right.day);
  const valueAtDay = (targetDay: number) => lots.reduce((sum, lot) => {
    const purchaseDay = Date.parse(`${lot.purchaseDate}T00:00:00.000Z`);
    if (targetDay < purchaseDay) return sum;

    let value = lot.shares * lot.pricePerShare;
    let cursor = purchaseDay;
    let activeRate = rates.filter((rate) => rate.day <= purchaseDay).at(-1)?.rate ??
      rates[0]?.rate ?? annualYieldPercentage;
    for (const rate of rates.filter((item) => item.day > purchaseDay && item.day <= targetDay)) {
      value *= (1 + activeRate / 100) ** ((rate.day - cursor) / DAY_MS / 365);
      cursor = rate.day;
      activeRate = rate.rate;
    }
    value *= (1 + activeRate / 100) ** ((targetDay - cursor) / DAY_MS / 365);
    return sum + value;
  }, 0);
  const valueAtOffset = (dayOffset: number) => valueAtDay(valuationDay - dayOffset * DAY_MS);
  const currentValue = valueAtOffset(0);
  const previousValue = valueAtOffset(1);
  const dailyChange = currentValue - previousValue;

  return {
    currentValue,
    dailyChange,
    dailyChangePercentage: previousValue > 0 ? (dailyChange / previousValue) * 100 : 0,
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

export function calculateChartDomain(
  points: PositionValuePoint[],
  includeInvestedValue: boolean,
): [number, number] {
  const values = points.flatMap((point) => includeInvestedValue
    ? [point.marketValue, point.investedValue]
    : [point.marketValue]);
  if (!values.length) return [0, 1];

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = maximum - minimum;
  const padding = span > 0 ? span * 0.1 : Math.max(Math.abs(maximum) * 0.05, 1);
  return [Math.max(0, minimum - padding), maximum + padding];
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
  const pricedPurchaseCost = pricedPositions.reduce(
    (sum, position) => sum + position.purchaseCostExcludingFees,
    0,
  );
  const marketReturn = currentValue - pricedPurchaseCost;
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
    marketReturn,
    marketReturnPercentage:
      pricedPurchaseCost > 0 ? (marketReturn / pricedPurchaseCost) * 100 : null,
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
