import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { calculatePriceDomain } from "./chartDomain";
import { MarketChart } from "./MarketChart";

describe("calculatePriceDomain", () => {
  it("keeps intraday movement readable when the average purchase price is far away", () => {
    const domain = calculatePriceDomain([
      { price: 100 },
      { price: 100.5 },
      { price: 101 },
    ]);
    expect(domain[0]).toBeGreaterThan(99);
    expect(domain[1]).toBeLessThan(102);
  });
});

describe("MarketChart data table", () => {
  it("does not build collapsed rows and reveals large histories in batches", async () => {
    const user = userEvent.setup();
    const history = Array.from({ length: 60 }, (_, index) => ({
      timestamp: new Date(Date.UTC(2026, 0, index + 1, 16)).toISOString(),
      close: 100 + index,
    }));
    render(<MarketChart history={history} lots={[]} mode="price" currency="EUR" averagePurchasePrice={0} />);
    expect(screen.queryByRole("table", { name: "Historical market prices" })).not.toBeInTheDocument();
    await user.click(screen.getByText("View Chart Data as a Table"));
    const table = screen.getByRole("table", { name: "Historical market prices" });
    expect(within(table).getAllByRole("row")).toHaveLength(51);
    await user.click(screen.getByRole("button", { name: "Show 50 More Rows" }));
    expect(within(table).getAllByRole("row")).toHaveLength(61);
  });
});
