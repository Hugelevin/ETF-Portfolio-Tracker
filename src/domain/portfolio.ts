import type {
  ChartRange,
  Instrument,
  MarketPoint,
  MarketQuote,
  PortfolioSummary,
  PositionMetrics,
  PurchaseLot,
} from "../types";
import { subtractUtcMonths } from "./dates";

export function calculatePosition(
  instrument: Instrument,
  lots: PurchaseLot[],
  quote: MarketQuote | null,
): PositionMetrics {
  if (quote && (quote.instrumentId !== instrument.id || quote.currency !== instrument.currency || !Number.isFinite(quote.price) || quote.price <= 0)) quote = null;
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
  // A published price/NAV is authoritative. A yield percentage never values a
  // fund position because a stale rate could silently invent a balance.
  const fundNavRatio = instrument.assetType === "FUND" && quote && averagePurchasePrice > 0
    ? quote.price / averagePurchasePrice
    : null;
  const costBasisWarning = fundNavRatio !== null && (fundNavRatio > 5 || fundNavRatio < 0.2)
    ? "The recorded fund purchase price is not comparable with the current NAV. Re-import or review this lot before calculating a return."
    : null;
  const currentValue = costBasisWarning
    ? null
    : quote ? totalShares * quote.price : null;
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
  ) : null;
  const dailyChangePercentage = quote && !costBasisWarning ? (
    quote.previousClose == null || quote.previousClose <= 0
      ? null
      : ((quote.price - quote.previousClose) / quote.previousClose) * 100
  ) : null;

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

export interface PositionValuePoint {
  timestamp: string;
  investedValue: number;
  marketValue: number;
}

export interface PortfolioValuePoint extends PositionValuePoint {
  pricedPositions: number;
}

export interface PortfolioReturnPoint extends PortfolioValuePoint {
  returnPercentage: number;
}

export interface MonthlyRiskReturn {
  month: string;
  percentage: number;
}

export interface PortfolioRiskStatistics {
  maximumDrawdownPercentage: number | null;
  currentDrawdownPercentage: number | null;
  highestPortfolioValue: number | null;
  annualisedVolatilityPercentage: number | null;
  bestMonth: MonthlyRiskReturn | null;
  worstMonth: MonthlyRiskReturn | null;
  averageRecoveryDays: number | null;
  longestRecoveryDays: number | null;
  recoveredDrawdowns: number;
}

export interface PeriodPerformance {
  value: number;
  percentage: number;
  referenceTimestamp: string;
}

export interface AnnualisedYield {
  percentage: number;
  days: number;
  referenceTimestamp: string;
  latestTimestamp: string;
}

export interface MoneyWeightedReturn {
  percentage: number;
  valuationDate: string;
}

/**
 * Calculates a trailing annualised return from published NAV points. This is
 * intentionally described as a NAV yield, not the fund provider's advertised
 * APY, because it is derived independently from price history.
 */
export function calculateAnnualisedYield(
  history: MarketPoint[],
  trailingDays = 7,
): AnnualisedYield | null {
  if (!Number.isFinite(trailingDays) || trailingDays <= 0) return null;
  const sorted = [...history]
    .filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isFinite(Date.parse(point.timestamp)))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const latest = sorted.at(-1);
  if (!latest) return null;

  const target = Date.parse(latest.timestamp) - trailingDays * DAY_MS;
  const reference = sorted.filter((point) => Date.parse(point.timestamp) <= target).at(-1);
  if (!reference) return null;
  const days = (Date.parse(latest.timestamp) - Date.parse(reference.timestamp)) / DAY_MS;
  // Weekends and market holidays can make the nearest usable point older than
  // seven days. Beyond twice the requested window the result is too sparse to
  // describe as a current trailing yield.
  if (days <= 0 || days > trailingDays * 2 || reference.close <= 0) return null;
  const percentage = ((latest.close / reference.close) ** (365 / days) - 1) * 100;
  if (!Number.isFinite(percentage)) return null;

  return {
    percentage,
    days,
    referenceTimestamp: reference.timestamp,
    latestTimestamp: latest.timestamp,
  };
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
  const sorted = [...history].filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isFinite(Date.parse(point.timestamp))).sort(
    (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
  );
  const latest = sorted.at(-1);
  if (!latest) return null;

  const target = period === "1M" ? subtractUtcMonths(new Date(latest.timestamp), 1) : new Date(latest.timestamp);
  if (period === "1W") {
    target.setUTCDate(target.getUTCDate() - 7);
  }

  const reference = sorted
    .filter((point) => Date.parse(point.timestamp) <= target.getTime())
    .at(-1);
  // Sparse history must not turn a year-old observation into a weekly return.
  if (!reference || reference.close <= 0 || target.getTime() - Date.parse(reference.timestamp) > 7 * DAY_MS) return null;

  const value = latest.close - reference.close;
  return {
    value,
    percentage: (value / reference.close) * 100,
    referenceTimestamp: reference.timestamp,
  };
}

/** Returns the first-to-last performance of the exact history shown. */
export function calculateHistoryPerformance(
  history: MarketPoint[],
  range?: ChartRange,
): PeriodPerformance | null {
  const sorted = [...history]
    .filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isFinite(Date.parse(point.timestamp)))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const first = sorted[0];
  const latest = sorted.at(-1);
  if (!first || !latest || first.timestamp === latest.timestamp) return null;
  const coveredDays = (Date.parse(latest.timestamp) - Date.parse(first.timestamp)) / DAY_MS;
  const minimumCoveredDays: Partial<Record<ChartRange, number>> = {
    "1W": 4,
    "1M": 21,
    "3M": 75,
    "1Y": 300,
  };
  if (range && coveredDays < (minimumCoveredDays[range] ?? 0)) return null;
  const value = latest.close - first.close;
  return {
    value,
    percentage: (value / first.close) * 100,
    referenceTimestamp: first.timestamp,
  };
}

/**
 * Calculates an annualised money-weighted return (XIRR) before broker fees.
 * Purchases are cash outflows and the latest complete valuation is the inflow.
 */
export function calculateMoneyWeightedReturn(
  positions: PositionMetrics[],
  valuationDate?: string,
): MoneyWeightedReturn | null {
  if (!positions.length || positions.some((position) => position.currentValue === null)) return null;
  const quoteDates = positions.map((position) => position.quote?.asOf.slice(0, 10));
  if (quoteDates.some((date) => !date || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)))) return null;
  const resolvedValuationDate = valuationDate ?? quoteDates[0];
  if (!resolvedValuationDate) return null;
  // XIRR requires one coherent valuation date. Mixed cached quote dates cannot
  // be treated as a single terminal portfolio value without historical FX/price reconstruction.
  if (quoteDates.some((date) => date !== resolvedValuationDate)) return null;
  const valuationTime = Date.parse(`${resolvedValuationDate}T00:00:00Z`);
  if (!Number.isFinite(valuationTime)) return null;

  const byDate = new Map<string, number>();
  for (const position of positions) {
    for (const lot of position.lots) {
      if (lot.purchaseDate > resolvedValuationDate) continue;
      byDate.set(lot.purchaseDate, (byDate.get(lot.purchaseDate) ?? 0) - lot.shares * lot.pricePerShare);
    }
  }
  const currentValue = positions.reduce((sum, position) => {
    const sharesOwned = position.lots
      .filter((lot) => lot.purchaseDate <= resolvedValuationDate)
      .reduce((shareSum, lot) => shareSum + lot.shares, 0);
    return sum + sharesOwned * (position.quote?.price ?? 0);
  }, 0);
  byDate.set(resolvedValuationDate, (byDate.get(resolvedValuationDate) ?? 0) + currentValue);
  const flows = [...byDate.entries()]
    .map(([date, amount]) => ({ time: Date.parse(`${date}T00:00:00Z`), amount }))
    .filter((flow) => Number.isFinite(flow.time) && Number.isFinite(flow.amount))
    .sort((left, right) => left.time - right.time);
  if (flows.length < 2 || flows[0]!.time >= valuationTime || !flows.some((flow) => flow.amount < 0) || !flows.some((flow) => flow.amount > 0)) return null;

  const origin = flows[0]!.time;
  const npv = (rate: number) => flows.reduce((sum, flow) => sum + flow.amount / ((1 + rate) ** ((flow.time - origin) / (365 * DAY_MS))), 0);
  let low = -0.9999;
  let high = 10;
  let lowValue = npv(low);
  let highValue = npv(high);
  while (Math.sign(lowValue) === Math.sign(highValue) && high < 1_000_000) {
    high *= 10;
    highValue = npv(high);
  }
  if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || Math.sign(lowValue) === Math.sign(highValue)) return null;

  for (let index = 0; index < 120; index += 1) {
    const middle = (low + high) / 2;
    const middleValue = npv(middle);
    if (!Number.isFinite(middleValue)) return null;
    if (Math.abs(middleValue) < 0.000001) {
      return { percentage: middle * 100, valuationDate: resolvedValuationDate };
    }
    if (Math.sign(middleValue) === Math.sign(lowValue)) {
      low = middle;
      lowValue = middleValue;
    } else {
      high = middle;
      highValue = middleValue;
    }
  }
  const rate = (low + high) / 2;
  return Number.isFinite(rate) ? { percentage: rate * 100, valuationDate: resolvedValuationDate } : null;
}

export function buildPositionValueHistory(
  lots: PurchaseLot[],
  history: MarketPoint[],
): PositionValuePoint[] {
  const orderedLots = [...lots].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  let lotIndex = 0;
  let shares = 0;
  let investedValue = 0;
  return [...history].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).flatMap((point) => {
    const pointDate = point.timestamp.slice(0, 10);
    while (lotIndex < orderedLots.length && orderedLots[lotIndex]!.purchaseDate <= pointDate) {
      const lot = orderedLots[lotIndex++]!;
      shares += lot.shares;
      investedValue += lot.shares * lot.pricePerShare;
    }

    if (shares <= 0) return [];
    return [{
      timestamp: point.timestamp,
      investedValue,
      marketValue: shares * point.close,
    }];
  });
}

/**
 * Builds a portfolio-wide history without inventing missing prices. Values are
 * emitted only when every position owned on that date has a price on or before
 * that date. Fees stay separate from invested capital, matching the dashboard.
 */
export function buildPortfolioValueHistory(
  positions: PositionMetrics[],
  histories: Record<string, MarketPoint[]>,
  baseCurrency = "EUR",
): PortfolioValuePoint[] {
  const basePositions = positions.filter((position) => position.instrument.currency === baseCurrency);
  // Sorted cursors visit each price and order once instead of rescanning entire
  // histories for every date. MAX histories otherwise block mobile rendering.
  const cursors = basePositions.map((position) => ({
    lots: [...position.lots].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate)),
    points: [...(histories[position.instrument.id] ?? [])]
      .filter((point) => Number.isFinite(point.close) && point.close > 0 && Number.isFinite(Date.parse(point.timestamp)))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    lotIndex: 0, priceIndex: 0, shares: 0, invested: 0,
    price: null as MarketPoint | null,
  }));
  const dates = [...new Set(cursors.flatMap((cursor) => cursor.points.map((point) => point.timestamp.slice(0, 10))))].sort();

  return dates.flatMap((date): PortfolioValuePoint[] => {
    let investedValue = 0;
    let marketValue = 0;
    let pricedPositions = 0;

    for (const cursor of cursors) {
      while (cursor.lotIndex < cursor.lots.length && cursor.lots[cursor.lotIndex]!.purchaseDate <= date) {
        const lot = cursor.lots[cursor.lotIndex++]!;
        cursor.shares += lot.shares;
        cursor.invested += lot.shares * lot.pricePerShare;
      }
      while (cursor.priceIndex < cursor.points.length && cursor.points[cursor.priceIndex]!.timestamp.slice(0, 10) <= date) {
        cursor.price = cursor.points[cursor.priceIndex++]!;
      }
      if (cursor.shares <= 0) continue;
      // Carry closes over weekends/holidays, never indefinitely across gaps.
      if (!cursor.price || Date.parse(date) - Date.parse(cursor.price.timestamp.slice(0, 10)) > 7 * DAY_MS) return [];
      investedValue += cursor.invested;
      marketValue += cursor.shares * cursor.price.close;
      pricedPositions += 1;
    }

    if (pricedPositions === 0) return [];
    return [{
      timestamp: `${date}T12:00:00.000Z`,
      investedValue,
      marketValue,
      pricedPositions,
    }];
  });
}

/**
 * Estimates linked returns after removing net purchases at each point, treating
 * flows as end-of-period. Exact flow-time valuations are not present in order
 * data; this is not an exact intraday time-weighted return.
 */
export function buildTimeWeightedReturnSeries(
  points: PortfolioValuePoint[],
): PortfolioReturnPoint[] {
  let cumulativeGrowth = 1;
  return points.map((point, index) => {
    const previous = points[index - 1];
    if (previous && previous.marketValue > 0) {
      const contribution = point.investedValue - previous.investedValue;
      const periodGrowth = (point.marketValue - contribution) / previous.marketValue;
      if (Number.isFinite(periodGrowth) && periodGrowth >= 0) cumulativeGrowth *= periodGrowth;
    }
    return { ...point, returnPercentage: (cumulativeGrowth - 1) * 100 };
  });
}

/**
 * Calculates estimated risk from the contribution-adjusted return index. Raw portfolio
 * value is used only for the highest-value statistic, so new orders cannot be
 * mistaken for performance or recovery.
 */
export function calculatePortfolioRiskStatistics(
  points: PortfolioValuePoint[],
): PortfolioRiskStatistics {
  const empty: PortfolioRiskStatistics = {
    maximumDrawdownPercentage: null,
    currentDrawdownPercentage: null,
    highestPortfolioValue: null,
    annualisedVolatilityPercentage: null,
    bestMonth: null,
    worstMonth: null,
    averageRecoveryDays: null,
    longestRecoveryDays: null,
    recoveredDrawdowns: 0,
  };
  const sorted = [...points]
    .filter((point) => Number.isFinite(point.marketValue) && point.marketValue > 0 && Number.isFinite(point.investedValue) && Number.isFinite(Date.parse(point.timestamp)))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  if (!sorted.length) return empty;
  if (sorted.length === 1) return { ...empty, highestPortfolioValue: sorted[0]!.marketValue };

  const returnSeries = buildTimeWeightedReturnSeries(sorted);
  const growth = returnSeries.map((point) => ({
    timestamp: point.timestamp,
    value: 1 + point.returnPercentage / 100,
  }));
  let peak = growth[0]!.value;
  let peakTimestamp = growth[0]!.timestamp;
  let drawdownStart: string | null = null;
  let maximumDrawdownPercentage = 0;
  const recoveryDays: number[] = [];

  for (const point of growth.slice(1)) {
    if (point.value >= peak) {
      if (drawdownStart) recoveryDays.push((Date.parse(point.timestamp) - Date.parse(drawdownStart)) / DAY_MS);
      peak = point.value;
      peakTimestamp = point.timestamp;
      drawdownStart = null;
      continue;
    }
    if (!drawdownStart) drawdownStart = peakTimestamp;
    maximumDrawdownPercentage = Math.min(maximumDrawdownPercentage, (point.value / peak - 1) * 100);
  }
  const latestGrowth = growth.at(-1)!.value;
  const currentDrawdownPercentage = (latestGrowth / peak - 1) * 100;

  const periodicReturns = growth.slice(1).flatMap((point, index) => {
    const previous = growth[index];
    return previous && previous.value > 0 ? [point.value / previous.value - 1] : [];
  });
  const intervals = growth.slice(1).map((point, index) => (Date.parse(point.timestamp) - Date.parse(growth[index]!.timestamp)) / DAY_MS).filter((days) => days > 0);
  const sortedIntervals = [...intervals].sort((left, right) => left - right);
  const medianInterval = sortedIntervals.length ? sortedIntervals[Math.floor(sortedIntervals.length / 2)]! : null;
  let annualisedVolatilityPercentage: number | null = null;
  if (periodicReturns.length >= 2 && medianInterval) {
    const mean = periodicReturns.reduce((sum, value) => sum + value, 0) / periodicReturns.length;
    const variance = periodicReturns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (periodicReturns.length - 1);
    const periodsPerYear = Math.min(252, 365 / medianInterval);
    annualisedVolatilityPercentage = Math.sqrt(variance) * Math.sqrt(periodsPerYear) * 100;
  }

  const monthEnds = new Map<string, { growth: number; timestamp: string }>();
  for (const point of growth) monthEnds.set(point.timestamp.slice(0, 7), { growth: point.value, timestamp: point.timestamp });
  const monthlyPoints = [...monthEnds.entries()].sort(([left], [right]) => left.localeCompare(right));
  const monthlyReturns = monthlyPoints.slice(1).flatMap(([month, point], index): MonthlyRiskReturn[] => {
    const previousEntry = monthlyPoints[index];
    if (!previousEntry) return [];
    const [previousMonth, previous] = previousEntry;
    const end = new Date(Date.parse(`${month}-01T00:00:00Z`));
    end.setUTCMonth(end.getUTCMonth() + 1);
    // Only completed calendar months, with a recent close at each boundary.
    const latestTime = Date.parse(sorted.at(-1)!.timestamp);
    const currentMonthFinished = Date.now() >= end.getTime() && latestTime >= end.getTime() - 7 * DAY_MS;
    const expectedPrevious = subtractUtcMonths(new Date(`${month}-01T00:00:00Z`), 1).toISOString().slice(0, 7);
    const startTime = Date.parse(`${month}-01T00:00:00Z`);
    const boundariesCovered = startTime - Date.parse(previous.timestamp) <= 7 * DAY_MS && end.getTime() - Date.parse(point.timestamp) <= 7 * DAY_MS;
    return previous.growth > 0 && previousMonth === expectedPrevious && currentMonthFinished && boundariesCovered
      ? [{ month, percentage: (point.growth / previous.growth - 1) * 100 }] : [];
  });
  const bestMonth = monthlyReturns.reduce<MonthlyRiskReturn | null>((best, item) => !best || item.percentage > best.percentage ? item : best, null);
  const worstMonth = monthlyReturns.reduce<MonthlyRiskReturn | null>((worst, item) => !worst || item.percentage < worst.percentage ? item : worst, null);

  return {
    maximumDrawdownPercentage,
    currentDrawdownPercentage,
    highestPortfolioValue: Math.max(...sorted.map((point) => point.marketValue)),
    annualisedVolatilityPercentage,
    bestMonth,
    worstMonth,
    averageRecoveryDays: recoveryDays.length ? recoveryDays.reduce((sum, days) => sum + days, 0) / recoveryDays.length : null,
    longestRecoveryDays: recoveryDays.length ? Math.max(...recoveryDays) : null,
    recoveredDrawdowns: recoveryDays.length,
  };
}

/** Bounds SVG work. With a value accessor, retains each bucket's extrema so
 * brief peaks and troughs do not disappear from long-range price charts. */
export function downsamplePoints<T>(points: T[], maximum = 90, valueOf?: (point: T) => number, stepValueOf?: (point: T) => number): T[] {
  if (points.length <= maximum || maximum < 2) return points;
  if (stepValueOf) {
    const required = new Set([0, points.length - 1]);
    for (let index = 1; index < points.length; index += 1) {
      if (stepValueOf(points[index]!) !== stepValueOf(points[index - 1]!)) {
        required.add(index - 1); required.add(index);
      }
    }
    // Transaction boundaries take priority over the visual point budget.
    const remaining = maximum - required.size;
    const selected = new Set(remaining > 0 ? downsamplePoints(points, remaining + 2, valueOf) : []);
    required.forEach((index) => selected.add(points[index]!));
    return points.filter((point) => selected.has(point));
  }
  if (valueOf && maximum >= 4) {
    const bucketCount = Math.floor((maximum - 2) / 2);
    const selected = new Set([0, points.length - 1]);
    for (let bucket = 0; bucket < bucketCount; bucket += 1) {
      const start = 1 + Math.floor(bucket * (points.length - 2) / bucketCount);
      const end = 1 + Math.floor((bucket + 1) * (points.length - 2) / bucketCount);
      let low = start;
      let high = start;
      for (let index = start + 1; index < end; index += 1) {
        if (valueOf(points[index]!) < valueOf(points[low]!)) low = index;
        if (valueOf(points[index]!) > valueOf(points[high]!)) high = index;
      }
      selected.add(low); selected.add(high);
    }
    return [...selected].sort((a, b) => a - b).map((index) => points[index]!);
  }
  const sampled: T[] = [];
  const lastIndex = points.length - 1;
  for (let index = 0; index < maximum; index += 1) {
    sampled.push(points[Math.round((index * lastIndex) / (maximum - 1))]!);
  }
  return sampled;
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
    (sum, position) => sum + position.purchaseCostExcludingFees,
    0,
  );
  const totalFees = baseCurrencyPositions.reduce(
    (sum, position) => sum + position.totalFees,
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
  const dailyCurrentValue = dailyChangePositions.reduce(
    (sum, position) => sum + (position.currentValue ?? 0),
    0,
  );
  const dailyPreviousValue = dailyChange === null ? null : dailyCurrentValue - dailyChange;
  const dailyChangePercentage = dailyChange === null || dailyPreviousValue === null || dailyPreviousValue <= 0
    ? null
    : (dailyChange / dailyPreviousValue) * 100;
  const nonBaseCurrencyPositionIds = positions
    .filter((position) => position.instrument.currency !== baseCurrency)
    .map((position) => position.instrument.id);
  const missingPricePositionIds = baseCurrencyPositions
    .filter((position) => position.currentValue === null)
    .map((position) => position.instrument.id);
  const excludedPositionIds = [...missingPricePositionIds, ...nonBaseCurrencyPositionIds];

  return {
    totalInvested,
    totalFees,
    currentValue,
    marketReturn,
    marketReturnPercentage:
      pricedPurchaseCost > 0 ? (marketReturn / pricedPurchaseCost) * 100 : null,
    profitLoss,
    profitLossPercentage:
      pricedCost > 0 ? (profitLoss / pricedCost) * 100 : null,
    dailyChange,
    dailyChangePercentage,
    dailyChangePositions: dailyChangePositions.length,
    pricedPositions: pricedPositions.length,
    baseCurrencyPositions: baseCurrencyPositions.length,
    totalPositions: positions.length,
    excludedPositionIds,
    missingPricePositionIds,
    nonBaseCurrencyPositionIds,
  };
}
