import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PurchaseDialog } from "./PurchaseDialog";

describe("PurchaseDialog", () => {
  it("requires deliberate selection even when filtering to one exact instrument", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<PurchaseDialog onClose={vi.fn()} onSave={onSave} />);
    await user.type(screen.getByLabelText("Find an Instrument"), "VWCE");
    expect(screen.getByRole("radio", { name: /VWCE/ })).not.toBeChecked();
    expect(screen.queryByRole("radio", { name: /ANAU/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Shares"), "1");
    await user.type(screen.getByLabelText("Purchase Price per Share"), "100");
    await user.type(screen.getByLabelText("Purchase Date"), "2026-07-14");
    await user.click(screen.getByRole("button", { name: "Add Purchase" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/select the exact instrument/i);
    expect(onSave).not.toHaveBeenCalled();
  });
});
