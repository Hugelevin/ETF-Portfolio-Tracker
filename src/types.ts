export type AssetType = "ETF" | "FUND";
export type CurrencyCode = string;

export interface Instrument {
  id: string;
  name: string;
  ticker: string;
  isin: string;
  exchange: string;
  micCode?: string;
  currency: CurrencyCode;
  assetType: AssetType;
  yahooSymbol: string;
  eodhdSymbol?: string;
}

export interface PurchaseLot {
  id: string;
  instrumentId: string;
  shares: number;
  pricePerShare: number;
  purchaseDate: string;
  fees: number;
}

export type MarketSource = "yahoo" | "eodhd" | "manual" | "cache";

export interface MarketQuote {
  instrumentId: string;
  price: number;
  previousClose: number | null;
  currency: CurrencyCode;
  exchange: string;
  asOf: string;
  fetchedAt: string;
  source: MarketSource;
  label: string;
  stale: boolean;
}

export interface MarketPoint {
  timestamp: string;
  close: number;
}

export interface MarketRecord {
  quote: MarketQuote;
  history: MarketPoint[];
}

export interface PositionMetrics {
  instrument: Instrument;
  lots: PurchaseLot[];
  totalShares: number;
  totalCost: number;
  averagePurchasePrice: number;
  currentValue: number | null;
  profitLoss: number | null;
  profitLossPercentage: number | null;
  dailyChange: number | null;
  dailyChangePercentage: number | null;
  quote: MarketQuote | null;
}

export interface PortfolioDocument {
  schemaVersion: 1;
  baseCurrency: "EUR";
  instruments: Instrument[];
  lots: PurchaseLot[];
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercentage: number | null;
  dailyChange: number | null;
  dailyChangePositions: number;
  pricedPositions: number;
  baseCurrencyPositions: number;
  totalPositions: number;
  excludedPositionIds: string[];
  missingPricePositionIds: string[];
  nonBaseCurrencyPositionIds: string[];
}

export interface AppSettings {
  proxyUrl: string;
  eodhdApiKey: string;
}

export interface ManualPrice {
  instrumentId: string;
  price: number;
  asOf: string;
}

export type ChartRange = "1D" | "1W" | "1M" | "3M" | "1Y" | "MAX";
