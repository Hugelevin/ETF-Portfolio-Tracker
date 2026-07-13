import type { Instrument } from "../types";

const issuerByIsin: Record<string, { key: string; label: string }> = {
  IE000QDFFK00: { key: "axa", label: "AXA" },
  IE00BWWCR731: { key: "ubs", label: "UBS" },
  IE00B44Z5B48: { key: "spdr", label: "SPDR" },
  IE00BMC38736: { key: "vaneck", label: "VanEck" },
  IE000YU9K6K2: { key: "vaneck", label: "VanEck" },
  IE0007Y8Y157: { key: "vaneck", label: "VanEck" },
  IE00BK5BQT80: { key: "vanguard", label: "V" },
  IE00BFMXXD54: { key: "vanguard", label: "V" },
};

export function InstrumentLogo({ instrument, large = false }: { instrument: Instrument; large?: boolean }) {
  const issuer = issuerByIsin[instrument.isin] ?? { key: "generic", label: instrument.ticker.slice(0, 4) };
  return <span className={`instrument-logo logo-${issuer.key}${large ? " large" : ""}`} aria-hidden="true"><span>{issuer.label}</span></span>;
}
