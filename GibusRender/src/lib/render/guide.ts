// Immagine-guida del volume: la foto con il volume disegnato sopra, inviata al modello
// come immagine separata (la foto principale resta pulita). Solo lato server (sharp).
import sharp from "sharp";
import { VOLUME_COLORS, VOLUME_EDGES, type ProjectedVolume } from "./volume";

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
    `<polygon points="${roof}" fill="${VOLUME_COLORS.edge}" fill-opacity="0.18"/>`,
    ...VOLUME_EDGES.map(([a, b]) =>
      line(xy(a), xy(b), `stroke="${VOLUME_COLORS.edge}" stroke-width="${sw}" stroke-dasharray="${sw * 3} ${sw * 2}"`),
    ),
    ...pv.posts.map((p) => line(px(p.foot), px(p.head), `stroke="${VOLUME_COLORS.post}" stroke-width="${sw * 2}"`)),
  ];
  if (pv.wallLine) {
    parts.push(line(px(pv.wallLine[0]), px(pv.wallLine[1]), `stroke="${VOLUME_COLORS.wall}" stroke-width="${sw * 2}"`));
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
