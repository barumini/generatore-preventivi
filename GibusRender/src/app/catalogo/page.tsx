import Link from "next/link";
import { db } from "@/lib/db";
import { COVER_LABELS, MOUNT_LABELS } from "@/lib/catalog/types";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const products = await db.product.findMany({
    orderBy: { name: "asc" },
    include: { references: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Catalogo</h1>
          <p className="muted">I prodotti Gibus disponibili per i render.</p>
        </div>
        <div className="row">
          <Link href="/catalogo/finiture" className="btn">Finiture</Link>
          <Link href="/catalogo/nuovo" className="btn btn-primary">Nuovo prodotto</Link>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="muted">Nessun prodotto in catalogo.</p>
      ) : (
        <div className="grid">
          {products.map((p) => {
            const thumb = p.references[0];
            return (
              <Link key={p.id} href={`/catalogo/${p.id}`} className="card card-link">
                <div className="thumb">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.url} alt={`${p.name}: ${thumb.label}`} />
                  ) : (
                    "Nessun riferimento"
                  )}
                </div>
                <div className="card-body">
                  <h2>{p.name}</h2>
                  <p className="muted small">
                    {MOUNT_LABELS[p.mountType]} · {COVER_LABELS[p.coverType]}
                  </p>
                  <p className="small">
                    {p.widthMm} × {p.depthMm} mm, altezza {p.totalHeightMm} mm
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
