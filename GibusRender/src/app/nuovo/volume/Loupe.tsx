import type { Point } from "@/lib/render/geometry";

const SIZE = 140;
const ZOOM = 3;

/**
 * Lente d'ingrandimento accanto al puntatore durante il trascinamento di una maniglia:
 * mostra la foto ingrandita con una crocetta sul punto esatto.
 */
export function Loupe({
  at,
  photoUrl,
  stageWidth,
  stageHeight,
}: {
  /** Punto sotto il puntatore, in coordinate 0..1 della foto. */
  at: Point;
  photoUrl: string;
  /** Dimensioni a schermo della foto, in pixel. */
  stageWidth: number;
  stageHeight: number;
}) {
  const x = at.x * stageWidth;
  const y = at.y * stageHeight;
  // Di norma in alto a destra del puntatore; si sposta se uscirebbe dalla foto.
  const left = x + 24 + SIZE > stageWidth ? x - 24 - SIZE : x + 24;
  const top = y - 24 - SIZE < 0 ? y + 24 : y - 24 - SIZE;
  return (
    <div
      className="loupe"
      aria-hidden="true"
      style={{
        left,
        top,
        width: SIZE,
        height: SIZE,
        backgroundImage: `url("${photoUrl}")`,
        backgroundSize: `${stageWidth * ZOOM}px ${stageHeight * ZOOM}px`,
        backgroundPosition: `${SIZE / 2 - x * ZOOM}px ${SIZE / 2 - y * ZOOM}px`,
      }}
    />
  );
}
