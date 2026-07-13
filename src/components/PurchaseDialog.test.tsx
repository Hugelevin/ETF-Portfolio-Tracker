import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PurchaseDialog } from "./PurchaseDialog";

describe("PurchaseDialog", () => {
  it("moves selection to the visible exact instrument when filtering", async () => {
    const user = userEvent.setup();
    render(<PurchaseDialog onClose={vi.fn()} onSave={vi.fn()} />);
    await user.type(screen.getByLabelText("Find an instrument"), "VWCE");
    expect(screen.getByRole("radio", { name: /VWCE/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /ANAU/ })).not.toBeInTheDocument();
  });
});
