import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isStale } from "@/lib/render/generate";
import { disabledProviderMessage } from "@/lib/providers/registry";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/render/format";
import type { VariantInfo } from "@/lib/render/variant-list";
import { DeleteComparisonButton } from "@/components/DeleteComparisonButton";
import { ComparisonView, type ComparisonColumn, type FinishInfo } from "./ComparisonView";

export const dynamic = "force-dynamic";

const finishInfo = (f: { name: string; code: string; swatchHex: string | null } | null): FinishInfo | null =>
  f ? { name: f.name, code: f.code, swatchHex: f.swatchHex } : null;

export default async function ComparisonPage({ params }: { params: Promise<{ id: string }> }) {
  // ?avvia=1 lo legge il client (ComparisonView), che lo toglie dall'indirizzo dopo il lancio.
  const { id } = await params;
  const comparison = await db.comparison.findUnique({
    where: { id },
    include: {
      renders: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          color: true,
          fabric: true,
          variants: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!comparison || comparison.renders.length === 0) notFound();

  const now = new Date();
  // isStale è solo lato server: al client arrivano dati semplici con il flag già calcolato.
  const columns: ComparisonColumn[] = comparison.renders.map((r) => ({
    renderId: r.id,
    color: finishInfo(r.color),
    fabric: finishInfo(r.fabric),
    requested: r.variantsRequested,
    hasVolume: r.volume != null,
    providerId: r.providerId,
    model: r.model,
    quality: r.quality,
    variants: r.variants.map(
      (v): VariantInfo => ({
        id: v.id,
        status: v.status,
        imageUrl: v.imageUrl,
        protected: v.protected,
        error: v.error,
        driftScore: v.driftScore,
        truncated: v.truncated,
        placementOffset: v.placementOffset,
        stale: isStale(v, now),
        createdAt: v.createdAt.toISOString(),
      }),
    ),
  }));
  const first = comparison.renders[0];
  // I render di un confronto nascono con lo stesso fornitore: basta il primo.
  const providerDisabled = disabledProviderMessage(first.providerId, (await getSettings()).enabledProviders);
  // Al massimo un render del confronto ha una variante scelta.
  const chosenId = comparison.renders.find((r) => r.chosenVariantId)?.chosenVariantId ?? null;
  const count = comparison.renders.length;

  return (
    <main className="page page-wide">
      <Link href="/" className="back">← Archivio</Link>
      <div className="page-head">
        <div>
          <h1>{comparison.clientRef}</h1>
          <p className="muted">
            {first.productName} · {count} finiture · {formatDate(comparison.createdAt)}
          </p>
        </div>
        <div className="row">
          {chosenId ? (
            <a className="btn" href={`/api/variants/${chosenId}/download`} download>
              Scarica la scelta
            </a>
          ) : (
            <button type="button" className="btn" disabled title="Scegli prima una variante">
              Scarica la scelta
            </button>
          )}
          <DeleteComparisonButton
            comparisonId={comparison.id}
            clientRef={comparison.clientRef}
            count={count}
            redirectTo="/"
          />
        </div>
      </div>

      <ComparisonView
        comparisonId={comparison.id}
        columns={columns}
        initialChosenId={chosenId}
        providerDisabled={providerDisabled}
      />
    </main>
  );
}
