import Link from "next/link";
import { db } from "@/lib/db";
import { FinishesManager } from "./FinishesManager";

export const dynamic = "force-dynamic";

export default async function FinitureCatalogoPage() {
  const finishes = await db.finish.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });
  return (
    <main className="page page-narrow">
      <Link href="/catalogo" className="back">← Catalogo</Link>
      <h1>Finiture</h1>
      <p className="muted">Colori delle strutture e tessuti delle coperture. Si assegnano ai prodotti dalla loro pagina.</p>
      <FinishesManager
        finishes={finishes.map((f) => ({ id: f.id, kind: f.kind, name: f.name, code: f.code, swatchHex: f.swatchHex }))}
      />
    </main>
  );
}
