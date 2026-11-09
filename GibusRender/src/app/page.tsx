import Link from "next/link";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatDate } from "@/lib/render/format";
import { archiveThumbnail, clampPage } from "@/lib/render/variant-list";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

function one(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function ArchivioPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100);
  const where: Prisma.RenderWhereInput = q ? { clientRef: { contains: q, mode: "insensitive" } } : {};
  const total = await db.render.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageN = clampPage(sp.pagina, pages);
  const renders = await db.render.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (pageN - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      variants: {
        where: { status: "DONE", imageUrl: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, imageUrl: true, createdAt: true },
      },
    },
  });

  const pageHref = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (n > 1) p.set("pagina", String(n));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Archivio render</h1>
          <p className="muted">I render generati, dal più recente.</p>
        </div>
        <Link href="/nuovo" className="btn btn-primary">Nuovo render</Link>
      </div>

      <form className="row search-bar" action="/" method="get" role="search">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Cerca per riferimento cliente"
          aria-label="Cerca per riferimento cliente"
        />
        <button type="submit" className="btn">Cerca</button>
        {q && <Link href="/" className="btn">Azzera</Link>}
      </form>

      {renders.length === 0 ? (
        <p className="muted">
          {q ? `Nessun render trovato per “${q}”.` : "Nessun render ancora. Crea il primo con “Nuovo render”."}
        </p>
      ) : (
        <div className="grid">
          {renders.map((r) => {
            const chosen = r.variants.some((v) => v.id === r.chosenVariantId);
            const thumb = archiveThumbnail(r);
            return (
              <Link key={r.id} href={`/render/${r.id}`} className="card card-link">
                <div className="thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb} alt={`Render per ${r.clientRef}`} loading="lazy" />
                </div>
                <div className="card-body">
                  <h2>{r.clientRef}</h2>
                  <p className="muted small">{r.productName}</p>
                  <p className="small">
                    {formatDate(r.createdAt)}
                    {chosen && <span className="badge badge-ok" style={{ marginLeft: "0.5rem" }}>Scelta</span>}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <nav className="row pager" aria-label="Pagine">
          {pageN > 1 && <Link href={pageHref(pageN - 1)} className="btn btn-small">← Precedenti</Link>}
          <span className="muted small">Pagina {pageN} di {pages}</span>
          {pageN < pages && <Link href={pageHref(pageN + 1)} className="btn btn-small">Successivi →</Link>}
        </nav>
      )}
    </main>
  );
}
