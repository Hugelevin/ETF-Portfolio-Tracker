import type { Instrument } from "../types";

const issuerByIsin: Record<string, { key: string; label: string; source: string }> = {
  IE000QDFFK00: { key: "axa", label: "AXA", source: "brands/axa.svg" },
  IE00BWWCR731: { key: "ubs", label: "UBS", source: "brands/ubs.svg" },
  IE00B44Z5B48: { key: "spdr", label: "State Street", source: "brands/state-street.svg" },
  IE00BMC38736: { key: "vaneck", label: "VanEck", source: "brands/vaneck.svg" },
  IE000YU9K6K2: { key: "vaneck", label: "VanEck", source: "brands/vaneck.svg" },
  IE0007Y8Y157: { key: "vaneck", label: "VanEck", source: "brands/vaneck.svg" },
  IE00BK5BQT80: { key: "vanguard", label: "Vanguard", source: "brands/vanguard.svg" },
  IE00BFMXXD54: { key: "vanguard", label: "Vanguard", source: "brands/vanguard.svg" },
};

export function InstrumentLogo({ instrument, large = false }: { instrument: Instrument; large?: boolean }) {
  const issuer = issuerByIsin[instrument.isin];
  const fallback = issuer?.label ?? instrument.ticker.slice(0, 4);
  return <span className={`instrument-logo logo-${issuer?.key ?? "generic"}${large ? " large" : ""}`} aria-hidden="true">
    {issuer && <img src={`${import.meta.env.BASE_URL}${issuer.source}`} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />}
    <span className="logo-fallback">{fallback}</span>
  </span>;
}
