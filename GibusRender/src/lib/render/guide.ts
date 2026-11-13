// Immagine-guida del volume: la foto con il volume disegnato sopra, inviata al modello
// come immagine separata (la foto principale resta pulita). Solo lato server (sharp).
import sharp from "sharp";
import type { ProjectedVolume } from "./volume";

/** Colori del volume, gli stessi dell'interfaccia e della legenda nel prompt. */
export const GUIDE_COLORS = { wall: "#ff3b30", post: "#2f7bff", edge: "#ffffff" } as const;

/** Spigoli del volume come coppie di indici dei vertici: a terra, in alto, verticali. */
export const VOLUME_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Spessore dei tratti: 0,6% della diagonale, minimo 3 px. */
export function guideStroke(width: number, height: number): number {
  return Math.max(3, Math.round(0.006 * Math.hypot(width, height)));
}

/** SVG del volume (senza maniglie né etichette), grande quanto la foto. */
export function guideSvg(pv: ProjectedVolume, width: number, height: number): string {
  const sw = guideStroke(width, height);
  const n = (v: number) => Math.round(v * 10) / 10;
  const xy = (i: number) => ({ x: n(pv.vertices[i].x * width), y: n(pv.vertices[i].y * height) });
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, attrs: string) =>
    `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" ${attrs} stroke-linecap="round"/>`;
  const px = (p: { x: number; y: number }) => ({ x: n(p.x * width), y: n(p.y * height) });

  const roof = [4, 5, 6, 7].map((i) => `${xy(i).x},${xy(i).y}`).join(" ");
  const parts = [
    `<polygon points="${roof}" fill="${GUIDE_COLORS.edge}" fill-opacity="0.18"/>`,
    ...VOLUME_EDGES.map(([a, b]) =>
      line(xy(a), xy(b), `stroke="${GUIDE_COLORS.edge}" stroke-width="${sw}" stroke-dasharray="${sw * 3} ${sw * 2}"`),
    ),
    ...pv.posts.map((p) => line(px(p.foot), px(p.head), `stroke="${GUIDE_COLORS.post}" stroke-width="${sw * 2}"`)),
  ];
  if (pv.wallLine) {
    parts.push(line(px(pv.wallLine[0]), px(pv.wallLine[1]), `stroke="${GUIDE_COLORS.wall}" stroke-width="${sw * 2}"`));
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    parts.join("") +
    "</svg>"
  );
}

/** PNG della foto con il volume disegnato sopra, alle stesse dimensioni. */
export async function renderGuide(photo: Buffer, pv: ProjectedVolume, width: number, height: number): Promise<Buffer> {
  return sharp(photo)
    .resize(width, height, { fit: "fill" })
    .composite([{ input: Buffer.from(guideSvg(pv, width, height)), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
