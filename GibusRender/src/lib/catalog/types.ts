// Tipi di dominio del catalogo. Questo file è importato anche lato browser
// (anteprima del prompt): NON importare @prisma/client né @/lib/db.

export type MountType = "ADDOSSATA" | "AUTOPORTANTE";
export type CoverType = "TELO" | "LAMELLE_ORIENTABILI" | "LAMELLE_IMPACCHETTAMENTO";
export type FinishKind = "COLORE" | "TESSUTO";

export const MOUNT_LABELS: Record<MountType, string> = {
  ADDOSSATA: "Addossata a parete",
  AUTOPORTANTE: "Autoportante",
};

export const COVER_LABELS: Record<CoverType, string> = {
  TELO: "Telo",
  LAMELLE_ORIENTABILI: "Lamelle orientabili",
  LAMELLE_IMPACCHETTAMENTO: "Lamelle orientabili e impacchettabili",
};

export interface SeedFinish {
  kind: FinishKind;
  name: string;
  /** Codice univoco della finitura, usato come chiave negli upsert. */
  code: string;
  swatchHex?: string;
}

export interface SeedReference {
  /** Nome del file in seed/images/. */
  file: string;
  label: string;
}

export interface SeedProduct {
  name: string;
  mountType: MountType;
  coverType: CoverType;
  aiDescription: string;
  widthMm: number;
  depthMm: number;
  clearHeightMm: number;
  totalHeightMm: number;
  references: SeedReference[];
  /** Codici delle finiture disponibili per il prodotto. */
  finishCodes: string[];
  defaultColorCode: string | null;
  defaultFabricCode: string | null;
}

export const SEED_FINISHES: SeedFinish[] = [
  { kind: "COLORE", name: "Antracite RAL 7016 sablé", code: "RAL 7016", swatchHex: "#383E42" },
  { kind: "TESSUTO", name: "Opatex Pro/Opatex Decò OP 272", code: "OP 272" },
];

function refs(prefix: string): SeedReference[] {
  return [
    { file: `${prefix}-3d.png`, label: "Vista 3D" },
    { file: `${prefix}-frontale.png`, label: "Vista frontale" },
    { file: `${prefix}-pianta.png`, label: "Vista in pianta" },
  ];
}

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: "ZENIT – Addossata frontale",
    mountType: "ADDOSSATA",
    coverType: "TELO",
    aiDescription:
      "Wall-mounted aluminium pergola: the rear side is fixed to the house wall, the front rests on two square-section posts, one at each front corner. " +
      "A flat, smooth rectangular front beam spans the full width between the posts, with matching flat side beams running back to the wall. " +
      "The roof is a single taut fabric canopy stretched flat between the side beams, kept straight by thin transverse tension bars (frangitratta). " +
      "Clean, smooth profiles with no decorations, gutters or visible screws; open sides and front.",
    widthMm: 4200,
    depthMm: 3800,
    clearHeightMm: 2400,
    totalHeightMm: 2746,
    references: refs("p1"),
    finishCodes: ["RAL 7016", "OP 272"],
    defaultColorCode: "RAL 7016",
    defaultFabricCode: "OP 272",
  },
  {
    name: "Lamella Compact",
    mountType: "AUTOPORTANTE",
    coverType: "LAMELLE_ORIENTABILI",
    aiDescription:
      "Freestanding aluminium bioclimatic pergola standing on four slim square-section posts, one at each corner. " +
      "A flat rectangular perimeter frame of smooth beams sits on top of the posts. " +
      "The roof is filled by a row of adjustable aluminium louvres (blades) running parallel to the short side, closely spaced and covering the whole frame. " +
      "Minimal, clean lines with no decorations; all four sides open.",
    widthMm: 3000,
    depthMm: 3080,
    clearHeightMm: 2400,
    totalHeightMm: 2550,
    references: refs("p2"),
    finishCodes: ["RAL 7016"],
    defaultColorCode: "RAL 7016",
    defaultFabricCode: null,
  },
  {
    name: "Bioclima Orient",
    mountType: "AUTOPORTANTE",
    coverType: "LAMELLE_ORIENTABILI",
    aiDescription:
      "Freestanding aluminium bioclimatic pergola standing on four square-section posts, one at each corner. " +
      "A deep, flat rectangular perimeter frame of smooth beams sits on top of the posts. " +
      "The roof is entirely covered by adjustable (tilting) aluminium louvres running across the width, evenly spaced over the full depth of the structure from front to back. " +
      "Minimal, clean lines with no decorations; all four sides open.",
    widthMm: 4000,
    depthMm: 5000,
    clearHeightMm: 2400,
    totalHeightMm: 2650,
    references: refs("p3"),
    finishCodes: ["RAL 7016"],
    defaultColorCode: "RAL 7016",
    defaultFabricCode: null,
  },
  {
    name: "Bioclima Pack",
    mountType: "AUTOPORTANTE",
    coverType: "LAMELLE_IMPACCHETTAMENTO",
    aiDescription:
      "Freestanding aluminium bioclimatic pergola standing on four square-section posts, one at each corner. " +
      "A flat rectangular perimeter frame of smooth beams sits on top of the posts. " +
      "The roof has retractable aluminium louvres running across the width, shown fully packed together into a compact stack at one end of the frame (about a quarter of the depth); " +
      "the rest of the roof is open sky, showing only the empty perimeter frame. Minimal, clean lines; all four sides open.",
    widthMm: 4000,
    depthMm: 4900,
    clearHeightMm: 2400,
    totalHeightMm: 2650,
    references: refs("p4"),
    finishCodes: ["RAL 7016"],
    defaultColorCode: "RAL 7016",
    defaultFabricCode: null,
  },
];
