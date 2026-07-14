import { useRef, useState } from "react";
import { Download, Trash2, Upload, X } from "lucide-react";
import type { AppSettings } from "../types";
import { useDialogKeyboard } from "./useDialogKeyboard";

interface Props {
  value: AppSettings;
  hasPortfolio: boolean;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
  onImport: (file: File) => void;
  onExport: () => void;
  onClear: () => void;
}

export function SettingsDialog({ value, hasPortfolio, onClose, onSave, onImport, onExport, onClear }: Props) {
  const [settings, setSettings] = useState(value);
  const importRef = useRef<HTMLInputElement>(null);
  const keyboard = useDialogKeyboard(onClose, "[aria-label='Close settings']");

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={keyboard.dialogRef} onKeyDown={keyboard.onKeyDown} className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <header><div><p className="eyebrow">Preferences and Local Data</p><h2 id="settings-title">Settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={onClose}><X /></button></header>
    <form onSubmit={(event) => { event.preventDefault(); onSave(settings); }}>
      <section className="settings-section" aria-labelledby="market-settings-title"><h3 id="market-settings-title">Market Data</h3><label>Cloudflare Worker URL<input type="url" placeholder="https://your-worker.workers.dev" value={settings.proxyUrl} onChange={(event) => setSettings({ ...settings, proxyUrl: event.target.value })} /><small>Required for Yahoo Finance browser requests. The Worker receives instrument symbols only.</small></label></section>
      <section className="settings-section local-data-settings" aria-labelledby="local-data-title"><h3 id="local-data-title">Import, Export and Recovery</h3><p>Exports contain instruments and orders only. Settings and cached prices are excluded.</p><div className="settings-data-actions">
        <input ref={importRef} className="sr-only" id="portfolio-import" type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file); if (importRef.current) importRef.current.value = ""; }} />
        <label className="button secondary" htmlFor="portfolio-import"><Upload /> Import JSON</label>
        <button type="button" className="button secondary" onClick={onExport} disabled={!hasPortfolio}><Download /> Export JSON</button>
        <button type="button" className="button danger-button" onClick={onClear} disabled={!hasPortfolio}><Trash2 /> Clear Portfolio</button>
      </div></section>
      <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" type="submit">Save Settings</button></footer>
    </form>
  </section></div>;
}
