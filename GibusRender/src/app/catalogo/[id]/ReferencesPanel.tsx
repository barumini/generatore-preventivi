"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addReferenceImage, moveReferenceImage, removeReferenceImage } from "@/lib/catalog/actions";
import { DeleteButton } from "@/components/DeleteButton";
import { ErrorBanner } from "@/components/ErrorBanner";

export interface ReferenceItem {
  id: string;
  url: string;
  label: string;
}

export function ReferencesPanel({ productId, references }: { productId: string; references: ReferenceItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Scegliere un file immagine");
    // Controllo anticipato per non caricare file inutilmente grandi.
    if (file.size > 4 * 1024 * 1024) return setError("Il file supera il limite di 4 MB");
    start(async () => {
      const res = await addReferenceImage(productId, file, String(fd.get("label") ?? ""));
      if (!res.ok) return setError(res.error);
      setError(null);
      formRef.current?.reset();
      router.refresh();
    });
  }

  function move(id: string, direction: "up" | "down") {
    start(async () => {
      const res = await moveReferenceImage(id, direction);
      if (!res.ok) return setError(res.error);
      setError(null);
      router.refresh();
    });
  }

  return (
    <section className="card">
      <h2>Immagini di riferimento</h2>
      <p className="muted small">
        Vengono inviate al modello insieme alla foto. La prima è la miniatura nel catalogo. Massimo 4 MB per file.
      </p>
      <ErrorBanner message={error} />

      {references.length === 0 ? (
        <p className="muted">Nessuna immagine di riferimento.</p>
      ) : (
        <ul className="list">
          {references.map((r, i) => (
            <li key={r.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ref-thumb" src={r.url} alt={r.label} />
              <div className="grow">{r.label}</div>
              <div className="row">
                <button type="button" className="btn btn-small" disabled={pending || i === 0} onClick={() => move(r.id, "up")} aria-label={`Sposta in alto: ${r.label}`}>↑</button>
                <button type="button" className="btn btn-small" disabled={pending || i === references.length - 1} onClick={() => move(r.id, "down")} aria-label={`Sposta in basso: ${r.label}`}>↓</button>
                <DeleteButton small confirmText={`Eliminare l'immagine "${r.label}"?`} action={() => removeReferenceImage(r.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={onUpload} style={{ marginTop: "1.5rem" }}>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="ref-file">Nuova immagine</label>
            <input id="ref-file" name="file" type="file" accept="image/*" required />
          </div>
          <div className="field">
            <label htmlFor="ref-label">Etichetta</label>
            <input id="ref-label" name="label" type="text" placeholder="Vista frontale" />
          </div>
        </div>
        <button type="submit" className="btn" disabled={pending}>{pending ? "Caricamento…" : "Carica immagine"}</button>
      </form>
    </section>
  );
}
