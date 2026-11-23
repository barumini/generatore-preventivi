// Costruzione del prompt inviato ai modelli immagine.
// Usato anche lato browser (anteprima del prompt): importa solo i tipi del
// catalogo, mai Prisma, @/lib/db o moduli che usano sharp.
// Il prompt è in inglese (i modelli lo seguono meglio); il testo libero
// dell'utente è riportato tra virgolette così com'è.

import type { CoverType, MountType } from "@/lib/catalog/types";
import { colourName, normalizeHex } from "./colourName";
import type { Point } from "./geometry";
import type { Post, ProjectedVolume, VolumeBox } from "./volume";

/** Dati del volume 3D che servono al prompt (posizioni in coordinate 0..1 della foto). */
export type PromptVolume = {
  wallHeightMm: number;
  frontHeightMm: number;
  /** Distanza dal muro; 0 = addossato. */
  distanceMm: number;
  /** Linea di attacco a muro; null se il volume è staccato dal muro. */
  wallLine: [Point, Point] | null;
  /** Bordo anteriore della copertura, da sinistra a destra. */
  frontEdge: [Point, Point];
  posts: Post[];
  /** La guida disegnata arriva al modello come immagine: il prompt ne spiega i colori. */
  guideImage: boolean;
};

/** Dati del prompt dal volume proiettato (stesso calcolo nel modulo e sul server). */
export function promptVolume(
  box: VolumeBox,
  pv: Pick<ProjectedVolume, "vertices" | "posts" | "wallLine">,
  guideImage = true,
): PromptVolume {
  return {
    wallHeightMm: box.wallHeightMm,
    frontHeightMm: box.frontHeightMm,
    distanceMm: box.distanceMm,
    wallLine: pv.wallLine,
    frontEdge: [pv.vertices[7], pv.vertices[6]],
    posts: pv.posts,
    guideImage,
  };
}

export type PromptInput = {
  product: { name: string; mountType: MountType; coverType: CoverType; aiDescription: string };
  dims: { widthMm: number; depthMm: number; clearHeightMm: number; totalHeightMm: number };
  /** swatchHex: "Colore di anteprima" del catalogo; se valido il colore è descritto anche in inglese. */
  color?: { name: string; code: string; swatchHex?: string | null };
  fabric?: { name: string; code: string };
  positionText: string;
  /** La maschera arriva al modello e il modello la applica (supportsMask). */
  hasMask: boolean;
  /**
   * La maschera arriva al modello solo come immagine indicativa (fornitore che
   * non la applica): il prompt chiede di posizionare la pergola nell'area bianca.
   */
  maskHint: boolean;
  scale?: { lengthMm: number; pixelLength: number; photoWidth: number };
  /** Volume 3D: se presente sostituisce l'indicazione generica di posizione e la scala. */
  volume?: PromptVolume;
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
const ratio = (a: number, b: number) => (a / b).toFixed(2);

/** Frase di posizione per i modelli che ricevono la maschera solo come immagine-guida. */
export const PLACEMENT_HINT =
  "Placement: The pergola must be placed exactly inside the white area of the mask image provided. " +
  "The mask is only a placement guide: do not draw it in the result.";

/**
 * Legenda dell'immagine-guida del volume. È un paragrafo a sé: i fornitori che non
 * inviano la guida a un modello lo tolgono dal prompt, come per PLACEMENT_HINT.
 */
export const GUIDE_LEGEND =
  "Placement guide: one of the attached images is this same photo with a schematic drawing of the pergola volume. " +
  "The red line is the beam fixed to the wall, the blue lines are the posts (exact number and position), " +
  "the white dashed lines are the outer edges of the structure and roof. " +
  "Build the pergola exactly inside this volume, with its edges on those lines. " +
  "The guide lines are annotations: never draw them in the result.";

/**
 * Legenda per la pergola staccata dal muro: la guida non ha la linea rossa
 * (si disegna solo con l'attacco a muro), quindi non la si nomina.
 */
export const GUIDE_LEGEND_FREESTANDING =
  "Placement guide: one of the attached images is this same photo with a schematic drawing of the pergola volume. " +
  "The blue lines are the posts (exact number and position), " +
  "the white dashed lines are the outer edges of the structure and roof; the pergola is not attached to the wall. " +
  "Build the pergola exactly inside this volume, with its edges on those lines. " +
  "The guide lines are annotations: never draw them in the result.";

const pct = (p: Point) => `(${Math.round(p.x * 100)}%, ${Math.round(p.y * 100)}%)`;
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** Sezione di posizione esatta ricavata dal volume. */
function placementSection(v: PromptVolume): string {
  const lines = [
    "Placement (exact): positions are given as (x%, y%) of the photo, measured from its top-left corner.",
  ];
  if (v.wallLine) {
    lines.push(
      `- Wall attachment: the rear beam is fixed to the wall along the straight line from ${pct(v.wallLine[0])} to ${pct(v.wallLine[1])}, ` +
        `${mm(v.wallHeightMm)} above the ground.`,
    );
  } else {
    lines.push(
      `- The pergola is freestanding, not attached to the wall: its rear side is ${mm(v.distanceMm)} away from the wall and parallel to it.`,
    );
  }
  lines.push(
    `- The front edge of the roof runs from ${pct(v.frontEdge[0])} to ${pct(v.frontEdge[1])}, ${mm(v.frontHeightMm)} above the ground.`,
  );
  const describe = (posts: Post[], noun: string) => {
    if (!posts.length) return;
    lines.push(`- ${count(posts.length, noun)}, vertical, standing on the ground:`);
    posts.forEach((p, i) =>
      lines.push(`  ${i + 1}. foot at ${pct(p.foot)}, top at ${pct(p.head)}, ${mm(p.xMm)} from the left end`),
    );
  };
  const front = v.posts.filter((p) => !p.rear);
  const rear = v.posts.filter((p) => p.rear);
  if (!v.posts.length) lines.push("- The structure has no posts: do not add any.");
  describe(front, "front post");
  describe(rear, "rear post");
  lines.push("These positions are exact: do not move, resize or re-proportion the pergola, and do not add or remove posts.");
  return lines.join("\n");
}

export function buildPrompt(input: PromptInput): string {
  const { product, dims, color, fabric, positionText, hasMask, maskHint, scale, volume, referenceCount } = input;
  const sections: string[] = [];

  // 1. Compito
  sections.push(
    hasMask
      ? "Task: edit this photo of a real house by inserting a Gibus pergola inside the masked area, as a photorealistic architectural visualisation."
      : "Task: edit this photo of a real house by adding a Gibus pergola, as a photorealistic architectural visualisation.",
  );

  // 1b. Regole critiche (in apertura: i modelli pesano di più l'inizio e la fine del testo)
  sections.push(
    "Critical rules: keep the camera framing, perspective and aspect ratio of the photo exactly: " +
      "do not zoom, crop, shift or rescale the scene. " +
      "The whole pergola, every post and the entire roof, must be completely visible and not cut off.",
  );

  // 2. Prodotto e descrizione
  sections.push(
    `Product: "${product.name}", ${MOUNT_TEXT[product.mountType]}, with ${COVER_TEXT[product.coverType]}. ` +
      `Description: ${product.aiDescription}`,
  );

  // 3. Misure (con il volume: altezza al muro e sul fronte al posto della sola altezza totale)
  // Staccata dal muro, l'altezza "al muro" è quella del lato posteriore.
  const heights = volume
    ? `height at the ${volume.wallLine ? "wall" : "rear"} ${mm(volume.wallHeightMm)}, height at the front ${mm(volume.frontHeightMm)}, ` +
      `clear height under the beams ${mm(dims.clearHeightMm)}`
    : `clear height under the beams ${mm(dims.clearHeightMm)}, total height ${mm(dims.totalHeightMm)}`;
  sections.push(
    `Real dimensions: width ${mm(dims.widthMm)}, depth (projection) ${mm(dims.depthMm)}, ${heights}. ` +
      `Proportions, width : depth : clear height = ${Math.round(dims.widthMm)} : ${Math.round(dims.depthMm)} : ${Math.round(dims.clearHeightMm)} ` +
      `(about ${ratio(dims.widthMm, dims.clearHeightMm)} : ${ratio(dims.depthMm, dims.clearHeightMm)} : 1). ` +
      "Keep these proportions consistent with the building and the people-scale elements in the photo (doors are about 2100 mm high).",
  );

  // 4. Finiture
  const finishes: string[] = [];
  if (color) {
    const parts = product.coverType === "TELO" ? "posts, beams and frame" : "posts, beams and louvres";
    const hex = normalizeHex(color.swatchHex);
    const word = colourName(hex);
    if (hex && word) {
      // Bianchi e neri vengono spesso resi grigi (riferimenti antracite): lo si esclude.
      const notGrey = word === "white" || word === "black" ? ", not grey" : "";
      finishes.push(
        `structure colour ${word}, ${color.name} (${color.code}, approximately ${hex}), matt textured powder coating: ` +
          `${parts} all in this ${word} colour${notGrey}`,
      );
    } else {
      finishes.push(
        `structure colour ${color.name} (${color.code}), matt textured powder coating: ${parts} all in this colour`,
      );
    }
  }
  if (fabric) finishes.push(`canopy fabric ${fabric.name} (${fabric.code})`);
  if (finishes.length) sections.push(`Finishes: ${finishes.join("; ")}.`);

  // 5. Posizione: sagoma indicativa e/o testo dell'utente (così com'è)
  if (volume) {
    if (volume.guideImage) sections.push(volume.wallLine ? GUIDE_LEGEND : GUIDE_LEGEND_FREESTANDING);
    sections.push(placementSection(volume));
  } else if (maskHint && !hasMask) sections.push(PLACEMENT_HINT);
  if (positionText.trim()) {
    sections.push(`Position, as described by the sales staff (in Italian): "${positionText}".`);
  }

  // 6. Scala
  if (!volume && scale && scale.pixelLength > 0 && scale.photoWidth > 0) {
    const refPct = (scale.pixelLength / scale.photoWidth) * 100;
    const pergolaPct = (dims.widthMm / scale.lengthMm) * refPct;
    sections.push(
      `Reference for scale: an element in the photo with a known length of ${mm(scale.lengthMm)} spans about ` +
        `${Math.round(scale.pixelLength)} px of the ${Math.round(scale.photoWidth)} px photo width (${refPct.toFixed(1)}%). ` +
        `At the same distance from the camera, the ${mm(dims.widthMm)} pergola width would span about ${pergolaPct.toFixed(0)}% of the photo width.`,
    );
  }

  // 7. Fedeltà al prodotto
  const details = "same structure, number and position of posts, beam profiles, roof type and proportions. ";
  const noExtras = "Do not invent extra elements such as side walls, curtains, lights, gutters, decorations or furniture.";
  if (referenceCount >= 1) {
    const follow =
      referenceCount === 1 ? "1 reference image follows the photo" : `${referenceCount} reference images follow the photo`;
    sections.push(
      `Reproduce the product exactly as shown in the reference images (${follow}): ` +
        details +
        noExtras +
        // Con una finitura scelta il colore non va preso dai riferimenti: nelle prove
        // del confronto un Bianco RAL 9010 usciva grigio come i riferimenti antracite.
        (finishes.length
          ? " Use the reference images only for the design of the pergola (posts, beams, louvres): " +
            "the colours are the ones given under Finishes, even where the reference images show a different colour; " +
            "do not copy any building, furniture, people or background from them."
          : " Use the reference images only for the design of the pergola (posts, beams, louvres, colour): " +
            "do not copy any building, furniture, people or background from them."),
    );
  } else {
    sections.push(
      "Reproduce the product faithfully according to the product and technical description above: " + details + noExtras,
    );
  }

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
