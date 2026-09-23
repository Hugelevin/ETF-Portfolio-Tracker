import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { PortfolioHistoryChart } from "./PortfolioHistoryChart";

it("provides portfolio history as a paginated table without hidden rows", async () => {
  const user = userEvent.setup();
  const points = Array.from({ length: 60 }, (_, index) => ({
    timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    marketValue: 1_000 + index, investedValue: 1_000, pricedPositions: 1,
  }));
  render(<PortfolioHistoryChart points={points} />);
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  // Native summary keyboard behavior is checked in real-browser tests.
  await user.click(screen.getByText("View Portfolio Data as a Table"));
  const table = screen.getByRole("table", { name: "Portfolio history data" });
  expect(within(table).getAllByRole("row")).toHaveLength(51);
  await user.click(screen.getByRole("button", { name: "Show 50 More Rows" }));
  expect(within(table).getAllByRole("row")).toHaveLength(61);
  expect(within(table).getByText("€1,059.00")).toBeInTheDocument();
});
