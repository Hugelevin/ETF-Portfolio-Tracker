import type { PortfolioDocument } from "../types";
import { useDialogKeyboard } from "./useDialogKeyboard";

export function ImportPreviewDialog({ portfolio, onCancel, onApply }: { portfolio: PortfolioDocument; onCancel: () => void; onApply: () => void }) {
  const keyboard = useDialogKeyboard(onCancel, "[data-primary-action]");
  return <div className="modal-backdrop" role="presentation"><section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="import-title"><header><div><p className="eyebrow">Review Before Replacement</p><h2 id="import-title">Import This Portfolio?</h2></div></header><p>The file is valid and contains <strong>{portfolio.instruments.length} instruments</strong> and <strong>{portfolio.lots.length} orders</strong>. Importing replaces the current portfolio. Your Worker setting is not changed.</p><footer><button className="button secondary" onClick={onCancel}>Cancel</button><button data-primary-action className="button primary" onClick={onApply}>Replace Portfolio</button></footer></section></div>;
}
