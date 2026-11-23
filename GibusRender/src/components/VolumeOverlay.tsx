import { VOLUME_COLORS, VOLUME_EDGES, type ProjectedVolume } from "@/lib/render/volume";

/**
 * Disegno del volume 3D (copertura velata, spigoli tratteggiati, montanti blu, attacco a
 * muro rosso) come gruppo SVG, in unità della foto. `u` = unità SVG per pixel a schermo.
 */
export function VolumeShape({
  pv,
  width,
  height,
  faint = false,
}: {
  pv: ProjectedVolume;
  width: number;
  height: number;
  faint?: boolean;
}) {
  const X = (i: number) => pv.vertices[i].x * width;
  const Y = (i: number) => pv.vertices[i].y * height;
  const roof = [4, 5, 6, 7].map((i) => `${X(i)},${Y(i)}`).join(" ");
  const floor = [0, 1, 2, 3].map((i) => `${X(i)},${Y(i)}`).join(" ");
  return (
    <g opacity={faint ? 0.45 : 1} pointerEvents="none">
      <polygon points={floor} fill="rgba(255,255,255,0.10)" />
      <polygon points={roof} fill="rgba(255,255,255,0.20)" />
      {VOLUME_EDGES.map(([a, b]) => (
        <g key={`${a}-${b}`}>
          <line x1={X(a)} y1={Y(a)} x2={X(b)} y2={Y(b)} stroke="rgba(0,0,0,0.55)" strokeWidth={4} vectorEffect="non-scaling-stroke" />
          <line
            x1={X(a)}
            y1={Y(a)}
            x2={X(b)}
            y2={Y(b)}
            stroke={VOLUME_COLORS.edge}
            strokeWidth={2}
            strokeDasharray="7 5"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
      {pv.posts.map((p, i) => (
        <line
          key={i}
          x1={p.foot.x * width}
          y1={p.foot.y * height}
          x2={p.head.x * width}
          y2={p.head.y * height}
          stroke={VOLUME_COLORS.post}
          strokeWidth={5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {pv.wallLine && (
        <line
          x1={pv.wallLine[0].x * width}
          y1={pv.wallLine[0].y * height}
          x2={pv.wallLine[1].x * width}
          y2={pv.wallLine[1].y * height}
          stroke={VOLUME_COLORS.wall}
          strokeWidth={5}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
}

/**
 * Volume sovrapposto a un'immagine (sola lettura): va dentro un contenitore con position: relative.
 * `fit="contain"` per le immagini mostrate con object-fit: contain (miniature), altrimenti
 * il contenitore ha già le proporzioni della foto.
 */
export function VolumeOverlay({
  pv,
  width,
  height,
  fit = "fill",
}: {
  pv: ProjectedVolume;
  width: number;
  height: number;
  fit?: "fill" | "contain";
}) {
  return (
    <svg
      className="overlay"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={fit === "contain" ? "xMidYMid meet" : "none"}
      aria-hidden="true"
    >
      <VolumeShape pv={pv} width={width} height={height} />
    </svg>
  );
}
