import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isStale } from "@/lib/render/generate";
import { disabledProviderMessage, listProviders } from "@/lib/providers/registry";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/render/format";
import type { VariantInfo } from "@/lib/render/variant-list";
import { DeleteRenderButton } from "@/components/DeleteRenderButton";
import { VariantsView } from "./VariantsView";

export const dynamic = "force-dynamic";

const QUALITY_LABELS: Record<string, string> = { low: "Bassa", medium: "Media", high: "Alta" };

export default async function RenderPage({ params }: { params: Promise<{ id: string }> }) {
  // ?avvia=1 lo legge il client (VariantsView), che lo toglie dall'indirizzo dopo il lancio.
  const { id } = await params;
  const render = await db.render.findUnique({
    where: { id },
    include: {
      color: true,
      fabric: true,
      variants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!render) notFound();

  const now = new Date();
  // isStale è solo lato server: al client arriva un flag già calcolato.
  const variants: VariantInfo[] = render.variants.map((v) => ({
    id: v.id,
    status: v.status,
    imageUrl: v.imageUrl,
    protected: v.protected,
    error: v.error,
    driftScore: v.driftScore,
    truncated: v.truncated,
    stale: isStale(v, now),
    createdAt: v.createdAt.toISOString(),
  }));
  // Stesso controllo della route delle varianti, mostrato prima di premere i pulsanti.
  const providerDisabled = disabledProviderMessage(render.providerId, (await getSettings()).enabledProviders);
  const providerLabel = listProviders().find((p) => p.id === render.providerId)?.label ?? render.providerId;
  const finishes = [render.color, render.fabric]
    .filter((f) => f != null)
    .map((f) => `${f.name} (${f.code})`);

  return (
    <main className="page">
      <Link href="/" className="back">← Archivio</Link>
      <div className="page-head">
        <div>
          <h1>{render.clientRef}</h1>
          <p className="muted">
            {render.productName} · {formatDate(render.createdAt)}
          </p>
        </div>
        <div className="row">
          <Link href={`/nuovo?da=${render.id}`} className="btn">Duplica e modifica</Link>
          <DeleteRenderButton renderId={render.id} clientRef={render.clientRef} redirectTo="/" />
        </div>
      </div>

      <div className="stack">
        <VariantsView
          renderId={render.id}
          photoUrl={render.photoUrl}
          photoWidth={render.photoWidth}
          photoHeight={render.photoHeight}
          initialVariants={variants}
          initialChosenId={render.chosenVariantId}
          requested={render.variantsRequested}
          defaultMore={Math.min(6, Math.max(1, render.variantsRequested))}
          providerDisabled={providerDisabled}
        />

        <section className="card">
          <h2>Riepilogo</h2>
          <dl className="summary">
            <dt>Prodotto</dt>
            <dd>{render.productName}</dd>
            <dt>Misure</dt>
            <dd>
              {render.widthMm} × {render.depthMm} mm · altezza libera {render.clearHeightMm} mm · altezza totale{" "}
              {render.totalHeightMm} mm
            </dd>
            <dt>Finiture</dt>
            <dd>{finishes.length ? finishes.join(", ") : "Nessuna"}</dd>
            <dt>Posizione</dt>
            <dd>{render.positionText || "—"}</dd>
            <dt>Sagoma</dt>
            <dd>{render.polygon ? "Disegnata (casa protetta)" : "Nessuna (casa non protetta)"}</dd>
            <dt>Fornitore</dt>
            <dd>{providerLabel}</dd>
            <dt>Modello</dt>
            <dd>{render.model}</dd>
            <dt>Qualità</dt>
            <dd>{QUALITY_LABELS[render.quality] ?? render.quality}</dd>
            <dt>Foto</dt>
            <dd>
              {render.photoWidth} × {render.photoHeight} px
            </dd>
          </dl>
          <details className="prompt-details">
            <summary>Prompt usato</summary>
            <pre className="prompt-text">{render.prompt}</pre>
          </details>
        </section>
      </div>
    </main>
  );
}
