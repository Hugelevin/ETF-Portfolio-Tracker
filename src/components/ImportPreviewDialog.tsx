import type { PortfolioDocument } from "../types";
import { useDialogKeyboard } from "./useDialogKeyboard";

export function ImportPreviewDialog({ portfolio, onCancel, onApply }: { portfolio: PortfolioDocument; onCancel: () => void; onApply: () => void }) {
  const keyboard = useDialogKeyboard(onCancel, "[data-primary-action]");
  return <div className="modal-backdrop" role="presentation"><section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="import-title"><header><div><p className="eyebrow">Review before replacement</p><h2 id="import-title">Import this portfolio?</h2></div></header><p>The file is valid and contains <strong>{portfolio.instruments.length} instruments</strong> and <strong>{portfolio.lots.length} purchase lots</strong>. Importing replaces the current portfolio. Your API key is not changed.</p><footer><button className="button secondary" onClick={onCancel}>Cancel</button><button data-primary-action className="button primary" onClick={onApply}>Replace portfolio</button></footer></section></div>;
}
