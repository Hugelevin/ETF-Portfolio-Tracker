import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PurchaseDialog } from "./PurchaseDialog";

describe("PurchaseDialog", () => {
  it("reveals order fields only after deliberate instrument selection", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PurchaseDialog onClose={vi.fn()} onSave={onSave} />);
    await user.type(screen.getByLabelText("Find an Instrument"), "VWCE");
    expect(screen.getByRole("radio", { name: /VWCE/ })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: /ANAU/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Shares")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Purchase" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /VWCE/ }));
    expect(screen.getByText("Selected Instrument")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change" })).toHaveFocus();
    expect(screen.getByLabelText("Shares")).not.toHaveFocus();
    await user.type(screen.getByLabelText("Shares"), "1");
    await user.type(screen.getByLabelText("Purchase Price per Share"), "100");
    await user.type(screen.getByLabelText("Purchase Date"), "2026-07-14");
    await user.click(screen.getByRole("button", { name: "Add Purchase" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
