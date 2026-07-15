import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("shows why cached data was used", () => {
    render(<StatusBadge quote={{ instrumentId: "jedi", price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-13T10:00:00Z", fetchedAt: "2026-07-13T10:01:00Z", source: "cache", label: "Previous update", stale: true }} error="Rate limit reached" />);
    expect(screen.getByText("Cached")).toBeInTheDocument();
    expect(screen.getByText("Rate limit reached")).toBeInTheDocument();
  });

  it("uses Yahoo session state and data freshness for concise statuses", () => {
    const baseQuote = { instrumentId: "jedi", price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-15T09:00:00Z", fetchedAt: "2026-07-15T09:18:00Z", source: "yahoo" as const, label: "Market Price", stale: false };
    const { rerender } = render(<StatusBadge quote={{ ...baseQuote, marketSession: "open" } as never} />);
    expect(screen.getByText("Updated")).toBeInTheDocument();

    rerender(<StatusBadge quote={{ ...baseQuote, marketSession: "open", stale: true } as never} />);
    expect(screen.getByText("Stale")).toBeInTheDocument();

    rerender(<StatusBadge quote={{ ...baseQuote, marketSession: "closed" } as never} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("can hide routine updated status while preserving exceptions", () => {
    const quote = { instrumentId: "jedi", price: 80, previousClose: 79, currency: "EUR", exchange: "XETRA", asOf: "2026-07-15T09:00:00Z", fetchedAt: "2026-07-15T09:18:00Z", source: "yahoo" as const, label: "Market Price", stale: false, marketSession: "open" as const };
    const { rerender } = render(<StatusBadge quote={quote} hideUpdated />);
    expect(screen.queryByText("Updated")).not.toBeInTheDocument();

    rerender(<StatusBadge quote={{ ...quote, stale: true }} hideUpdated />);
    expect(screen.getByText("Stale")).toBeInTheDocument();
  });
});
