import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { listProviders } from "@/lib/providers/registry";
import { getRenderDraft, type RenderDraft } from "@/lib/render/draft";
import type { CoverType, FinishKind, MountType } from "@/lib/catalog/types";
import { NewRenderForm, type FinishInfo, type ProductInfo, type ProviderOption } from "./NewRenderForm";

export const dynamic = "force-dynamic";

export default async function NuovoRenderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { da } = await searchParams;
  const sourceId = typeof da === "string" && da.trim() ? da.trim() : null;

  const [settings, productRows, finishRows, draft] = await Promise.all([
    getSettings(),
    db.product.findMany({
      orderBy: { name: "asc" },
      include: {
        finishes: true,
        references: { orderBy: { sortOrder: "asc" }, take: 1 },
        _count: { select: { references: true } },
      },
    }),
    db.finish.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    sourceId ? getRenderDraft(sourceId) : Promise.resolve<RenderDraft | null>(null),
  ]);

  // Solo dati semplici verso il componente client: Prisma e i fornitori restano sul server.
  const products: ProductInfo[] = productRows.map((p) => ({
    id: p.id,
    name: p.name,
    mountType: p.mountType as MountType,
    coverType: p.coverType as CoverType,
    aiDescription: p.aiDescription,
    widthMm: p.widthMm,
    depthMm: p.depthMm,
    clearHeightMm: p.clearHeightMm,
    totalHeightMm: p.totalHeightMm,
    defaultColorId: p.defaultColorId,
    defaultFabricId: p.defaultFabricId,
    finishIds: p.finishes.map((f) => f.finishId),
    referenceCount: p._count.references,
    thumbUrl: p.references[0]?.url ?? null,
  }));
  const finishes: FinishInfo[] = finishRows.map((f) => ({
    id: f.id,
    kind: f.kind as FinishKind,
    name: f.name,
    code: f.code,
    swatchHex: f.swatchHex,
  }));
  const providers: ProviderOption[] = listProviders()
    .filter((p) => settings.enabledProviders.includes(p.id))
    .map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.isConfigured(),
      suggestedModels: p.suggestedModels,
      supportsMask: p.supportsMask,
    }));

  return (
    <main className="page page-narrow">
      <h1>{draft ? "Nuovo render da uno esistente" : "Nuovo render"}</h1>
      <p className="muted">
        Carica la foto del sopralluogo, scegli il prodotto e indica dove va la pergola. Poi genera le varianti.
      </p>
      {sourceId && !draft && (
        <div className="banner-error" role="alert">
          Render di partenza non trovato: compila il modulo da zero.
        </div>
      )}
      <NewRenderForm
        products={products}
        finishes={finishes}
        providers={providers}
        defaults={{
          providerId: settings.activeProviderId,
          model: settings.activeModel,
          quality: settings.quality,
          variants: settings.defaultVariants,
          maxPhotoSide: settings.maxPhotoSide,
        }}
        draft={draft}
      />
    </main>
  );
}
