"use client";

import type { FinishInfo } from "./NewRenderForm";

/** Elenco a caselle di finiture con il campione di colore; nessuna casella = «Nessuno». */
export function FinishChecklist({
  label,
  finishes,
  selected,
  onChange,
}: {
  label: string;
  finishes: FinishInfo[];
  selected: string[];
  onChange(ids: string[]): void;
}) {
  const toggle = (id: string, on: boolean) => {
    const rest = selected.filter((s) => s !== id);
    onChange(on ? [...rest, id] : rest);
  };
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="label" style={{ padding: 0 }}>{label}</legend>
      <div className="checks">
        {finishes.map((f) => (
          <label key={f.id} className="check">
            <input type="checkbox" checked={selected.includes(f.id)} onChange={(e) => toggle(f.id, e.target.checked)} />
            {f.swatchHex && <span className="swatch" style={{ background: f.swatchHex }} aria-hidden="true" />}
            {f.name} ({f.code})
          </label>
        ))}
      </div>
      <span className="hint">Nessuna casella: «Nessuno (non indicato all&apos;IA)».</span>
    </fieldset>
  );
}
