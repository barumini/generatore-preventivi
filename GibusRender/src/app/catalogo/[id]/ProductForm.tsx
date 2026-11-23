"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProduct } from "@/lib/catalog/actions";
import { COVER_LABELS, MOUNT_LABELS, type CoverType, type FinishKind, type MountType } from "@/lib/catalog/types";
import { ErrorBanner } from "@/components/ErrorBanner";

export interface FinishOption {
  id: string;
  kind: FinishKind;
  name: string;
  code: string;
  swatchHex: string | null;
}

export interface ProductValues {
  id: string;
  name: string;
  mountType: MountType;
  coverType: CoverType;
  aiDescription: string;
  widthMm: number;
  depthMm: number;
  clearHeightMm: number;
  totalHeightMm: number;
  defaultColorId: string | null;
  defaultFabricId: string | null;
  finishIds: string[];
}

const MEASURES = [
  ["widthMm", "Larghezza (mm)"],
  ["depthMm", "Profondità (mm)"],
  ["clearHeightMm", "Altezza libera (mm)"],
  ["totalHeightMm", "Altezza totale (mm)"],
] as const;

export function ProductForm({ product, finishes }: { product: ProductValues | null; finishes: FinishOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<string[]>(product?.finishIds ?? []);
  const [defaultColor, setDefaultColor] = useState(product?.defaultColorId ?? "");
  const [defaultFabric, setDefaultFabric] = useState(product?.defaultFabricId ?? "");

  const colors = finishes.filter((f) => f.kind === "COLORE");
  const fabrics = finishes.filter((f) => f.kind === "TESSUTO");

  function toggle(id: string, on: boolean) {
    setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
    if (!on) {
      if (defaultColor === id) setDefaultColor("");
      if (defaultFabric === id) setDefaultFabric("");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaved(false);
    start(async () => {
      const res = await saveProduct(fd);
      if (!res.ok) return setError(res.error);
      setError(null);
      if (!product) router.push(`/catalogo/${res.id}`);
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const finishGroup = (title: string, list: FinishOption[]) => (
    <div className="field">
      <span className="label">{title}</span>
      {list.length === 0 && <span className="hint">Nessuna finitura: aggiungila dalla pagina Finiture.</span>}
      <div className="checks">
        {list.map((f) => (
          <label key={f.id} className="check">
            <input
              type="checkbox"
              name="finishIds"
              value={f.id}
              checked={selected.includes(f.id)}
              onChange={(e) => toggle(f.id, e.target.checked)}
            />
            {f.swatchHex && <span className="swatch" style={{ background: f.swatchHex }} />}
            {f.name} <span className="muted small">({f.code})</span>
          </label>
        ))}
      </div>
    </div>
  );

  const defaultSelect = (name: string, label: string, list: FinishOption[], value: string, set: (v: string) => void) => (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Nessuno</option>
        {list
          .filter((f) => selected.includes(f.id))
          .map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} ({f.code})
            </option>
          ))}
      </select>
    </div>
  );

  return (
    <form className="card" onSubmit={onSubmit}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <ErrorBanner message={error} />
      {saved && <div className="banner-ok" role="status">Modifiche salvate.</div>}

      <div className="field">
        <label htmlFor="name">Nome</label>
        <input id="name" name="name" type="text" required defaultValue={product?.name ?? ""} />
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="mountType">Installazione</label>
          <select id="mountType" name="mountType" defaultValue={product?.mountType ?? "AUTOPORTANTE"}>
            {(Object.keys(MOUNT_LABELS) as MountType[]).map((k) => (
              <option key={k} value={k}>{MOUNT_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="coverType">Copertura</label>
          <select id="coverType" name="coverType" defaultValue={product?.coverType ?? "LAMELLE_ORIENTABILI"}>
            {(Object.keys(COVER_LABELS) as CoverType[]).map((k) => (
              <option key={k} value={k}>{COVER_LABELS[k]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        {MEASURES.map(([key, label]) => (
          <div className="field" key={key}>
            <label htmlFor={key}>{label}</label>
            <input id={key} name={key} type="number" inputMode="numeric" min={500} max={15000} step={1} required defaultValue={product?.[key] ?? ""} />
          </div>
        ))}
      </div>

      <div className="field">
        <label htmlFor="aiDescription">Descrizione per l&apos;IA</label>
        <textarea id="aiDescription" name="aiDescription" required minLength={50} defaultValue={product?.aiDescription ?? ""} />
        <span className="hint">In inglese, almeno 50 caratteri: descrive struttura, montanti e copertura al modello di immagini.</span>
      </div>

      {finishGroup("Colori compatibili", colors)}
      {finishGroup("Tessuti compatibili", fabrics)}

      <div className="grid-2">
        {defaultSelect("defaultColorId", "Colore predefinito", colors, defaultColor, setDefaultColor)}
        {defaultSelect("defaultFabricId", "Tessuto predefinito", fabrics, defaultFabric, setDefaultFabric)}
      </div>

      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Salvataggio…" : product ? "Salva modifiche" : "Crea prodotto"}
      </button>
    </form>
  );
}
