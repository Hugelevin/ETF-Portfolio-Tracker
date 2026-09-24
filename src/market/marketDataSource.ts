import type { Instrument } from "../types";

/** User-approved quote/chart source for this exact fund; preserve the owned listing. */
export function marketDataSourceInstrument(instrument: Instrument): Instrument {
  if (instrument.isin !== "IE000QDFFK00" || instrument.currency !== "EUR" ||
    instrument.assetType !== "ETF" || instrument.yahooSymbol !== "ANAU-ETFP.MI" ||
    instrument.exchange !== "Milan" || (instrument.micCode !== undefined && instrument.micCode !== "XMIL")) return instrument;
  return { ...instrument, ticker: "ANAV", yahooSymbol: "ANAV.DE", exchange: "Xetra", micCode: "XETR" };
}
