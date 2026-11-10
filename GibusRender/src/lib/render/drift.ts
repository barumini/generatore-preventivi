import sharp from "sharp";

/** Larghezza di lavoro: basta per vedere spostamenti e ridisegni, ed è molto più veloce. */
const WORK_WIDTH = 192;

/**
 * Quanto l'immagine generata si discosta dall'originale FUORI dalla sagoma, dove
 * dovrebbe essere uguale: differenza media assoluta RGB (0–255) su pixel con alfa 0.
 * Un modello che ha spostato, ingrandito o ridisegnato la scena dà valori alti.
 *
 * @param original foto normalizzata (JPEG/PNG)
 * @param generated immagine del fornitore già riportata alle dimensioni della foto
 * @param alpha alfa grezzo a 1 canale (width*height) di `featheredAlpha`
 */
export async function sceneDrift(
  original: Buffer,
  generated: Buffer,
  alpha: Buffer,
  width: number,
  height: number,
): Promise<number> {
  const w = Math.min(WORK_WIDTH, width);
  const h = Math.max(1, Math.round((height / width) * w));
  const rgb = (img: Buffer) =>
    sharp(img).removeAlpha().resize(w, h, { fit: "fill", kernel: "linear" }).raw().toBuffer();
  const [a, b, mask] = await Promise.all([
    rgb(original),
    rgb(generated),
    // sharp restituisce l'alfa a 3 canali dopo il resize: si tiene un solo canale.
    sharp(alpha, { raw: { width, height, channels: 1 } })
      .resize(w, h, { fit: "fill", kernel: "nearest" })
      .extractChannel(0)
      .raw()
      .toBuffer(),
  ]);

  let sum = 0;
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (mask[i] !== 0) continue; // dentro la sagoma allargata (o nella sfumatura): non si confronta
    const o = i * 3;
    sum += Math.abs(a[o] - b[o]) + Math.abs(a[o + 1] - b[o + 1]) + Math.abs(a[o + 2] - b[o + 2]);
    n += 3;
  }
  return n ? sum / n : 0;
}
