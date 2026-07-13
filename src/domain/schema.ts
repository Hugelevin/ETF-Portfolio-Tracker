import { z } from "zod";
import type { PortfolioDocument } from "../types";
import { toLocalIsoDate } from "../format";

const finitePositive = z.number().finite().positive();
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date in YYYY-MM-DD format")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
    return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === (month ?? 1) - 1 && parsed.getUTCDate() === day;
  }, "Use a valid purchase date");

const legacyInstrumentSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1),
    ticker: z.string().trim().min(1).max(30),
    isin: z.string().trim().toUpperCase().regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/),
    exchange: z.string().trim().min(1),
    micCode: z.string().trim().min(1).max(12).optional(),
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
    assetType: z.enum(["ETF", "FUND"]),
    yahooSymbol: z.string().trim().min(1).max(50).optional(),
    annualYieldPercentage: z.number().finite().nonnegative().max(100).optional(),
    annualYieldHistory: z.array(z.object({
      effectiveDate: isoDate,
      annualYieldPercentage: z.number().finite().nonnegative().max(100),
    }).strict()).optional(),
    eodhdSymbol: z.string().trim().min(1).max(50).optional(),
  })
  .strict();

export const instrumentSchema = legacyInstrumentSchema.transform((instrument) => {
  const migrated = { ...instrument };
  delete migrated.eodhdSymbol;
  const latestRate = [...(migrated.annualYieldHistory ?? [])]
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
    .at(-1);
  if (latestRate) migrated.annualYieldPercentage = latestRate.annualYieldPercentage;
  return migrated;
});

export const purchaseLotSchema = z
  .object({
    id: z.string().trim().min(1),
    instrumentId: z.string().trim().min(1),
    shares: finitePositive,
    pricePerShare: finitePositive,
    purchaseDate: isoDate,
    fees: z.number().finite().nonnegative().default(0),
  })
  .strict();

export const portfolioDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseCurrency: z.literal("EUR"),
    instruments: z.array(instrumentSchema),
    lots: z.array(purchaseLotSchema),
  })
  .strict()
  .superRefine((portfolio, context) => {
    const instrumentIds = new Set<string>();
    const instrumentIdentities = new Set<string>();
    portfolio.instruments.forEach((instrument, index) => {
      instrument.annualYieldHistory?.forEach((rate, rateIndex) => {
        if (rate.effectiveDate > toLocalIsoDate()) {
          context.addIssue({
            code: "custom",
            message: "APY effective dates cannot be in the future",
            path: ["instruments", index, "annualYieldHistory", rateIndex, "effectiveDate"],
          });
        }
      });
      if (instrument.assetType === "ETF" && !instrument.yahooSymbol) {
        context.addIssue({
          code: "custom",
          message: `Yahoo symbol is required for ETF: ${instrument.ticker}`,
          path: ["instruments", index, "yahooSymbol"],
        });
      }
      if (instrumentIds.has(instrument.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate instrument id: ${instrument.id}`,
          path: ["instruments", index, "id"],
        });
      }
      instrumentIds.add(instrument.id);
      const venue = instrument.micCode?.trim().toUpperCase() ?? instrument.exchange.trim().toUpperCase();
      const identity = `${instrument.isin.trim().toUpperCase()}|${venue}|${instrument.currency.trim().toUpperCase()}`;
      if (instrumentIdentities.has(identity)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate instrument identity: ${instrument.isin} at ${venue} in ${instrument.currency}`,
          path: ["instruments", index],
        });
      }
      instrumentIdentities.add(identity);
    });

    const lotIds = new Set<string>();
    portfolio.lots.forEach((lot, index) => {
      if (lotIds.has(lot.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate lot id: ${lot.id}`,
          path: ["lots", index, "id"],
        });
      }
      if (!instrumentIds.has(lot.instrumentId)) {
        context.addIssue({
          code: "custom",
          message: `Unknown instrument id: ${lot.instrumentId}`,
          path: ["lots", index, "instrumentId"],
        });
      }
      lotIds.add(lot.id);
    });
  });

export function parsePortfolioDocument(value: unknown): PortfolioDocument {
  return portfolioDocumentSchema.parse(value) as PortfolioDocument;
}

export function emptyPortfolio(): PortfolioDocument {
  return {
    schemaVersion: 1,
    baseCurrency: "EUR",
    instruments: [],
    lots: [],
  };
}
