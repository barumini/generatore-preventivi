// Seed del catalogo iniziale (idempotente: upsert per nome/codice).
// Uso: npm run db:seed
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { putFile } from "../src/lib/storage";
import { SEED_FINISHES, SEED_PRODUCTS } from "../src/lib/catalog/types";

const IMAGES_DIR = path.join(process.cwd(), "seed", "images");

async function main() {
  const finishIds = new Map<string, string>();
  for (const f of SEED_FINISHES) {
    const data = { kind: f.kind, name: f.name, swatchHex: f.swatchHex ?? null };
    const finish = await db.finish.upsert({ where: { code: f.code }, update: data, create: { ...data, code: f.code } });
    finishIds.set(f.code, finish.id);
  }
  const idOf = (code: string | null) => {
    if (code === null) return null;
    const id = finishIds.get(code);
    if (!id) throw new Error(`Finitura sconosciuta: ${code}`);
    return id;
  };

  for (const p of SEED_PRODUCTS) {
    const data = {
      mountType: p.mountType,
      coverType: p.coverType,
      aiDescription: p.aiDescription,
      widthMm: p.widthMm,
      depthMm: p.depthMm,
      clearHeightMm: p.clearHeightMm,
      totalHeightMm: p.totalHeightMm,
      defaultColorId: idOf(p.defaultColorCode),
      defaultFabricId: idOf(p.defaultFabricCode),
    };
    const product = await db.product.upsert({ where: { name: p.name }, update: data, create: { ...data, name: p.name } });

    const wanted = p.finishCodes.map((c) => idOf(c)!);
    await db.productFinish.deleteMany({ where: { productId: product.id, finishId: { notIn: wanted } } });
    await db.productFinish.createMany({
      data: wanted.map((finishId) => ({ productId: product.id, finishId })),
      skipDuplicates: true,
    });

    // Le immagini di riferimento vengono ricaricate e sostituite a ogni esecuzione.
    const refs = [];
    for (const [sortOrder, r] of p.references.entries()) {
      const buf = await fs.readFile(path.join(IMAGES_DIR, r.file));
      const url = await putFile(`references/${r.file}`, buf, "image/png");
      refs.push({ productId: product.id, url, label: r.label, sortOrder });
    }
    await db.$transaction([
      db.referenceImage.deleteMany({ where: { productId: product.id } }),
      db.referenceImage.createMany({ data: refs }),
    ]);
    console.log(`Prodotto pronto: ${p.name} (${refs.length} riferimenti)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
