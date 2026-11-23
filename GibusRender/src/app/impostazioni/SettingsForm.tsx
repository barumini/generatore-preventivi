"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSettings } from "@/lib/settings-actions";
import { ErrorBanner } from "@/components/ErrorBanner";
import { estimateCost } from "@/lib/render/cost";

export interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  suggestedModels: string[];
  supportsMask: boolean;
}

export interface SettingsValues {
  activeProviderId: string;
  activeModel: string;
  quality: string;
  enabledProviders: string[];
  defaultVariants: number;
  maxPhotoSide: number;
}

const QUALITY_LABELS: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta" };

/** " — circa 0,01 € a immagine" dalla tabella prezzi; vuoto se il modello non è in tabella. */
function priceLabel(providerId: string, model: string, quality: string): string {
  const c = estimateCost(providerId, model, quality, 1);
  return c ? ` — circa ${c.eur.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} € a immagine` : "";
}

export function SettingsForm({ providers, initial }: { providers: ProviderInfo[]; initial: SettingsValues }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [enabled, setEnabled] = useState<string[]>(initial.enabledProviders);
  const [active, setActive] = useState(initial.activeProviderId);
  const [model, setModel] = useState(initial.activeModel);
  const [quality, setQuality] = useState(initial.quality);

  const activeInfo = providers.find((p) => p.id === active);
  const suggested = activeInfo?.suggestedModels ?? [];
  const activeProviders = providers.filter((p) => enabled.includes(p.id));

  function toggle(id: string, on: boolean) {
    const next = on ? [...enabled, id] : enabled.filter((x) => x !== id);
    setEnabled(next);
    // Il fornitore attivo deve restare tra gli abilitati.
    if (!on && active === id && next.length > 0) setActive(next[0]);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaved(false);
    start(async () => {
      const res = await saveSettings(fd);
      if (!res.ok) return setError(res.error);
      setError(null);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form className="card" style={{ marginTop: "1.5rem" }} onSubmit={onSubmit}>
      <ErrorBanner message={error} />
      {saved && <div className="banner-ok" role="status">Impostazioni salvate.</div>}

      <div className="field">
        <span className="label">Fornitori abilitati</span>
        <div className="checks">
          {providers.map((p) => (
            <label key={p.id} className="check">
              <input type="checkbox" name="enabledProviders" value={p.id} checked={enabled.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
              {p.label}
              <span className={`badge ${p.configured ? "badge-ok" : "badge-warn"}`}>{p.configured ? "configurato" : "chiave mancante"}</span>
              {!p.supportsMask && <span className="muted small">(senza sagoma)</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="activeProviderId">Fornitore attivo</label>
        <select id="activeProviderId" name="activeProviderId" value={active} onChange={(e) => setActive(e.target.value)}>
          {activeProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} ({p.configured ? "configurato" : "chiave mancante"})
            </option>
          ))}
        </select>
        {activeInfo && !activeInfo.configured && (
          <span className="hint">La chiave API di questo fornitore non è impostata: la generazione non partirà.</span>
        )}
      </div>

      <div className="field">
        <label htmlFor="activeModel">Modello</label>
        <select
          aria-label="Modelli suggeriti"
          value={suggested.includes(model) ? model : ""}
          onChange={(e) => e.target.value && setModel(e.target.value)}
        >
          <option value="">Altro modello (scrivere sotto)</option>
          {suggested.map((m) => (
            <option key={m} value={m}>{m}{priceLabel(active, m, quality)}</option>
          ))}
        </select>
        <input id="activeModel" name="activeModel" type="text" value={model} onChange={(e) => setModel(e.target.value)} required />
        <span className="hint">Scegliere tra i modelli suggeriti o scrivere un altro identificativo.</span>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="quality">Qualità</label>
          <select id="quality" name="quality" value={quality} onChange={(e) => setQuality(e.target.value)}>
            {Object.entries(QUALITY_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="defaultVariants">Varianti predefinite</label>
          <input id="defaultVariants" name="defaultVariants" type="number" min={1} max={6} step={1} defaultValue={initial.defaultVariants} required />
        </div>
      </div>

      <div className="field">
        <label htmlFor="maxPhotoSide">Risoluzione della foto (lato lungo, px)</label>
        <input id="maxPhotoSide" name="maxPhotoSide" type="number" min={640} max={3000} step={10} defaultValue={initial.maxPhotoSide} required />
        <span className="hint">
          Da 640 a 3000. Le foto si riducono a questo lato lungo prima dell&apos;uso, e l&apos;immagine finale ha la stessa risoluzione.
          I modelli lavorano comunque a circa 1 megapixel: un tetto basso rende l&apos;invio più rapido senza perdere dettaglio utile.
        </span>
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Salvataggio…" : "Salva impostazioni"}</button>
    </form>
  );
}
