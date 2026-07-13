import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("shows why cached data was used", () => {
    render(<StatusBadge quote={{ instrumentId: "jedi", price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-13T10:00:00Z", fetchedAt: "2026-07-13T10:01:00Z", source: "cache", label: "Cached price — last successful update", stale: true }} error="Rate limit reached" />);
    expect(screen.getByText(/Stale/)).toBeInTheDocument();
    expect(screen.getByText("Fallback reason: Rate limit reached")).toBeInTheDocument();
  });
});
