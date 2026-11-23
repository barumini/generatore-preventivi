"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteFinish, saveFinish } from "@/lib/catalog/actions";
import type { FinishKind } from "@/lib/catalog/types";
import { DeleteButton } from "@/components/DeleteButton";
import { ErrorBanner } from "@/components/ErrorBanner";

interface FinishItem {
  id: string;
  kind: FinishKind;
  name: string;
  code: string;
  swatchHex: string | null;
}

const KIND_LABELS: Record<FinishKind, string> = { COLORE: "Colore", TESSUTO: "Tessuto" };

function FinishForm({ finish, onDone }: { finish: FinishItem | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await saveFinish(fd);
      if (!res.ok) return setError(res.error);
      setError(null);
      if (!finish) form.reset();
      onDone();
      router.refresh();
    });
  }

  const p = finish?.id ?? "new";
  return (
    <form onSubmit={onSubmit}>
      {finish && <input type="hidden" name="id" value={finish.id} />}
      <ErrorBanner message={error} />
      <div className="grid-2">
        <div className="field">
          <label htmlFor={`kind-${p}`}>Tipo</label>
          <select id={`kind-${p}`} name="kind" defaultValue={finish?.kind ?? "COLORE"}>
            <option value="COLORE">Colore</option>
            <option value="TESSUTO">Tessuto</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`code-${p}`}>Codice</label>
          <input id={`code-${p}`} name="code" type="text" required defaultValue={finish?.code ?? ""} placeholder="RAL 7016" />
        </div>
      </div>
      <div className="field">
        <label htmlFor={`name-${p}`}>Nome</label>
        <input id={`name-${p}`} name="name" type="text" required defaultValue={finish?.name ?? ""} />
      </div>
      <div className="field">
        <label htmlFor={`hex-${p}`}>Colore di anteprima (facoltativo)</label>
        <input id={`hex-${p}`} name="swatchHex" type="text" defaultValue={finish?.swatchHex ?? ""} placeholder="#383E42" />
        <span className="hint">Formato #RRGGBB.</span>
      </div>
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Salvataggio…" : finish ? "Salva" : "Aggiungi finitura"}
        </button>
        {finish && <button type="button" className="btn" onClick={onDone}>Annulla</button>}
      </div>
    </form>
  );
}

export function FinishesManager({ finishes }: { finishes: FinishItem[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="stack" style={{ marginTop: "1.5rem" }}>
      <section className="card">
        <h2>Elenco</h2>
        {finishes.length === 0 ? (
          <p className="muted">Nessuna finitura.</p>
        ) : (
          <ul className="list">
            {finishes.map((f) => (
              <li key={f.id} style={{ flexWrap: "wrap" }}>
                {editing === f.id ? (
                  <div style={{ width: "100%" }}>
                    <FinishForm finish={f} onDone={() => setEditing(null)} />
                  </div>
                ) : (
                  <>
                    {f.swatchHex ? <span className="swatch" style={{ background: f.swatchHex }} /> : <span className="swatch" />}
                    <div className="grow">
                      {f.name} <span className="muted small">({f.code})</span>
                    </div>
                    <span className="badge">{KIND_LABELS[f.kind]}</span>
                    <div className="row">
                      <button type="button" className="btn btn-small" onClick={() => setEditing(f.id)}>Modifica</button>
                      <DeleteButton small confirmText={`Eliminare la finitura "${f.name}"?`} action={() => deleteFinish(f.id)} />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2>Nuova finitura</h2>
        <FinishForm finish={null} onDone={() => {}} />
      </section>
    </div>
  );
}
