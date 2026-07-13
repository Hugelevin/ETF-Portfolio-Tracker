import type { Instrument } from "../types";

export const VERIFIED_INSTRUMENTS: Instrument[] = [
  { id: "anau-milan-eur", name: "AXA IM Nasdaq 100 UCITS ETF - Accumulating", ticker: "ANAU", isin: "IE000QDFFK00", exchange: "Milan", micCode: "XMIL", currency: "EUR", assetType: "ETF", yahooSymbol: "ANAU-ETFP.MI" },
  { id: "ummepsa-nav-eur", name: "UBS (Irl) Select Money Market Fund - EUR P Acc", ticker: "UMMEPSA", isin: "IE00BWWCR731", exchange: "Moneybase Cash Fund", currency: "EUR", assetType: "FUND", yahooSymbol: "0P0001CD0Q.F" },
  { id: "spyy-xetra-eur", name: "State Street SPDR MSCI All Country World UCITS ETF - Accumulating", ticker: "SPYY", isin: "IE00B44Z5B48", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "SPYY.DE" },
  { id: "vvsm-xetra-eur", name: "VanEck Semiconductor UCITS ETF", ticker: "VVSM", isin: "IE00BMC38736", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "VVSM.DE" },
  { id: "jedi-xetra-eur", name: "VanEck Space Innovators UCITS ETF", ticker: "JEDI", isin: "IE000YU9K6K2", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "JEDI.DE" },
  { id: "vwce-xetra-eur", name: "Vanguard FTSE All-World UCITS ETF", ticker: "VWCE", isin: "IE00BK5BQT80", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "VWCE.DE" },
  { id: "qutm-xetra-eur", name: "VanEck Quantum Computing UCITS ETF", ticker: "QUTM", isin: "IE0007Y8Y157", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "QUTM.DE" },
  { id: "vuaa-xetra-eur", name: "Vanguard S&P 500 UCITS ETF", ticker: "VUAA", isin: "IE00BFMXXD54", exchange: "Xetra", micCode: "XETR", currency: "EUR", assetType: "ETF", yahooSymbol: "VUAA.DE" },
];
