// Preparazione della foto nel browser prima dell'invio a POST /api/renders:
// HEIC → JPEG, orientamento EXIF applicato, lato lungo max 3000 px, JPEG < 3,8 MB
// (il server accetta al massimo 4 MB).

export const UPLOAD_MAX_SIDE = 3000;
/** Obiettivo di dimensione del file inviato: sotto i 4 MB del server, con margine. */
export const UPLOAD_TARGET_BYTES = Math.floor(3.8 * 1024 * 1024);
/** Qualità JPEG provate in ordine, finché il file non scende sotto l'obiettivo. */
export const JPEG_QUALITY_STEPS = [0.9, 0.85, 0.8, 0.75] as const;

/** Dimensioni ridotte con il lato lungo al massimo `maxSide`, proporzioni mantenute. */
export function computeUploadSize(w: number, h: number, maxSide = UPLOAD_MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * Qualità JPEG del prossimo tentativo: null se `size` è già sotto l'obiettivo
 * o se non ci sono gradini più bassi di `quality`.
 */
export function nextJpegQuality(size: number, quality: number): number | null {
  if (size < UPLOAD_TARGET_BYTES) return null;
  return JPEG_QUALITY_STEPS.find((q) => q < quality - 1e-9) ?? null;
}

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

function toJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversione della foto fallita"))), "image/jpeg", quality),
  );
}

/** Converte (se HEIC), raddrizza, ridimensiona e comprime la foto. Solo nel browser. */
export async function prepareUpload(file: File): Promise<Blob> {
  let source: Blob = file;
  if (isHeic(file)) {
    const { default: heic2any } = await import("heic2any");
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.95 });
    source = Array.isArray(out) ? out[0] : out;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Foto non leggibile: usa un file JPEG, PNG, WebP o HEIC");
  }
  const { width, height } = computeUploadSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Il browser non riesce a elaborare la foto");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality: number = JPEG_QUALITY_STEPS[0];
  let blob = await toJpegBlob(canvas, quality);
  for (let next = nextJpegQuality(blob.size, quality); next !== null; next = nextJpegQuality(blob.size, quality)) {
    quality = next;
    blob = await toJpegBlob(canvas, quality);
  }
  return blob;
}
