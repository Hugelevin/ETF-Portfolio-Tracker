import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { AppSettings } from "../types";
import { useDialogKeyboard } from "./useDialogKeyboard";

export function SettingsDialog({ value, onClose, onSave }: { value: AppSettings; onClose: () => void; onSave: (settings: AppSettings) => void }) {
  const [settings, setSettings] = useState(value);
  const keyboard = useDialogKeyboard(onClose, "input");
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><div><p className="eyebrow">Market data</p><h2 id="settings-title">Settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={onClose}><X /></button></header><form onSubmit={(event) => { event.preventDefault(); onSave(settings); }}>
    <label>Cloudflare Worker URL<input type="url" placeholder="https://your-worker.workers.dev" value={settings.proxyUrl} onChange={(event) => setSettings({ ...settings, proxyUrl: event.target.value })} /><small>Required for Yahoo Finance browser requests. The Worker receives instrument symbols only.</small></label>
    <div className="privacy-note"><ShieldCheck aria-hidden="true" /><p><strong>Your portfolio stays here.</strong><br />Shares, prices paid, dates and fees are never sent to the Worker or a database.</p></div>
    <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save settings</button></footer>
  </form></section></div>;
}
