import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductForm, type FinishOption, type ProductValues } from "./ProductForm";
import { ReferencesPanel } from "./ReferencesPanel";
import { DeleteProduct } from "./DeleteProduct";

export const dynamic = "force-dynamic";

export default async function ProdottoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const finishRows = await db.finish.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });
  const finishes: FinishOption[] = finishRows.map((f) => ({ id: f.id, kind: f.kind, name: f.name, code: f.code, swatchHex: f.swatchHex }));

  if (id === "nuovo") {
    return (
      <main className="page page-narrow">
        <Link href="/catalogo" className="back">← Catalogo</Link>
        <h1>Nuovo prodotto</h1>
        <p className="muted">Dopo il salvataggio potrai caricare le immagini di riferimento.</p>
        <ProductForm product={null} finishes={finishes} />
      </main>
    );
  }

  const p = await db.product.findUnique({
    where: { id },
    include: { references: { orderBy: { sortOrder: "asc" } }, finishes: true },
  });
  if (!p) notFound();

  const values: ProductValues = {
    id: p.id,
    name: p.name,
    mountType: p.mountType,
    coverType: p.coverType,
    aiDescription: p.aiDescription,
    widthMm: p.widthMm,
    depthMm: p.depthMm,
    clearHeightMm: p.clearHeightMm,
    totalHeightMm: p.totalHeightMm,
    defaultColorId: p.defaultColorId,
    defaultFabricId: p.defaultFabricId,
    finishIds: p.finishes.map((f) => f.finishId),
  };

  return (
    <main className="page page-narrow">
      <Link href="/catalogo" className="back">← Catalogo</Link>
      <div className="page-head">
        <h1>{p.name}</h1>
        <DeleteProduct id={p.id} name={p.name} />
      </div>
      <div className="stack">
        <ProductForm product={values} finishes={finishes} />
        <ReferencesPanel
          productId={p.id}
          references={p.references.map((r) => ({ id: r.id, url: r.url, label: r.label }))}
        />
      </div>
    </main>
  );
}
