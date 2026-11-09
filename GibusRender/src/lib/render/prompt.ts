// Costruzione del prompt inviato ai modelli immagine.
// Usato anche lato browser (anteprima del prompt): importa solo i tipi del
// catalogo, mai Prisma, @/lib/db o moduli che usano sharp.
// Il prompt è in inglese (i modelli lo seguono meglio); il testo libero
// dell'utente è riportato tra virgolette così com'è.

import type { CoverType, MountType } from "@/lib/catalog/types";

export type PromptInput = {
  product: { name: string; mountType: MountType; coverType: CoverType; aiDescription: string };
  dims: { widthMm: number; depthMm: number; clearHeightMm: number; totalHeightMm: number };
  color?: { name: string; code: string };
  fabric?: { name: string; code: string };
  positionText: string;
  hasMask: boolean;
  scale?: { lengthMm: number; pixelLength: number; photoWidth: number };
  referenceCount: number;
};

const MOUNT_TEXT: Record<MountType, string> = {
  ADDOSSATA:
    "a wall-mounted pergola: its rear side is fixed to the wall of the building, the front rests on posts",
  AUTOPORTANTE: "a freestanding pergola standing on its own posts, not attached to the building",
};

// Nota: niente parola "fabric" qui, così compare solo se c'è un tessuto scelto.
const COVER_TEXT: Record<CoverType, string> = {
  TELO: "a tensioned textile canopy roof",
  LAMELLE_ORIENTABILI: "a roof of adjustable aluminium louvres",
  LAMELLE_IMPACCHETTAMENTO: "a roof of adjustable aluminium louvres that can be packed together",
};

const mm = (n: number) => `${Math.round(n)} mm`;

export function buildPrompt(input: PromptInput): string {
  const { product, dims, color, fabric, positionText, hasMask, scale, referenceCount } = input;
  const sections: string[] = [];

  // 1. Compito
  sections.push(
    hasMask
      ? "Task: edit this photo of a real house by inserting a Gibus pergola inside the masked area, as a photorealistic architectural visualisation."
      : "Task: edit this photo of a real house by adding a Gibus pergola, as a photorealistic architectural visualisation.",
  );

  // 2. Prodotto e descrizione
  sections.push(
    `Product: "${product.name}", ${MOUNT_TEXT[product.mountType]}, with ${COVER_TEXT[product.coverType]}. ` +
      `Description: ${product.aiDescription}`,
  );

  // 3. Misure
  sections.push(
    `Real dimensions: width ${mm(dims.widthMm)}, depth (projection) ${mm(dims.depthMm)}, ` +
      `clear height under the beams ${mm(dims.clearHeightMm)}, total height ${mm(dims.totalHeightMm)}. ` +
      "Keep these proportions consistent with the building and the people-scale elements in the photo (doors are about 2100 mm high).",
  );

  // 4. Finiture
  const finishes: string[] = [];
  if (color) finishes.push(`structure colour ${color.name} (${color.code}), matt textured powder coating`);
  if (fabric) finishes.push(`canopy fabric ${fabric.name} (${fabric.code})`);
  if (finishes.length) sections.push(`Finishes: ${finishes.join("; ")}.`);

  // 5. Posizione (testo dell'utente, così com'è)
  sections.push(`Position, as described by the customer (in Italian): "${positionText}".`);

  // 6. Scala
  if (scale && scale.pixelLength > 0 && scale.photoWidth > 0) {
    const refPct = (scale.pixelLength / scale.photoWidth) * 100;
    const pergolaPct = (dims.widthMm / scale.lengthMm) * refPct;
    sections.push(
      `Reference for scale: an element in the photo with a known length of ${mm(scale.lengthMm)} spans about ` +
        `${Math.round(scale.pixelLength)} px of the ${Math.round(scale.photoWidth)} px photo width (${refPct.toFixed(1)}%). ` +
        `At the same distance from the camera, the ${mm(dims.widthMm)} pergola width would span about ${pergolaPct.toFixed(0)}% of the photo width.`,
    );
  }

  // 7. Fedeltà al prodotto
  sections.push(
    `Reproduce the product exactly as shown in the reference images (${referenceCount} reference images follow the photo): ` +
      "same structure, number and position of posts, beam profiles, roof type and proportions. " +
      "Do not invent extra elements such as side walls, curtains, lights, gutters, decorations or furniture.",
  );

  // 8. Vincoli sulla casa
  sections.push(
    hasMask
      ? "Do not change anything outside the masked area: the building, windows, ground, vegetation, sky and objects must stay exactly as they are."
      : "Do not change the existing building, ground, vegetation or objects; only add the pergola.",
  );

  // 9. Fotorealismo
  sections.push(
    "Photorealism: match the lighting, sun direction, colour temperature and exposure of the photo, " +
      "cast realistic shadows from the pergola onto the ground and walls, follow the camera perspective and lens of the photo, " +
      "and keep the same image framing and resolution.",
  );

  return sections.join("\n\n");
}
