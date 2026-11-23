"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/render/geometry";
import { VOLUME_COLORS, alongAxis, project, roundMm, type ProjectedVolume, type Vec3 } from "@/lib/render/volume";
import { VolumeShape } from "@/components/VolumeOverlay";
import { fromHandle, pointerToNormalized, useHandleDrag, useUnitsPerPx } from "../PolygonEditor";
import { Loupe } from "./Loupe";
import type { VolumeAction, VolumeDraft } from "./state";

export type VolumeTool = "riquadro" | "volume" | "ritocco";
export type DimsPatch = Partial<{ widthMm: number; depthMm: number; totalHeightMm: number }>;

const REF = "#34c759";
const HANDLE = "#ffd60a";
const OUTLINE = "#1c1c1e";
/** Limiti delle misure del prodotto, gli stessi del modulo e del server. */
const MIN_MM = 500;
const MAX_MM = 15000;
const clampMm = (v: number) => Math.min(MAX_MM, Math.max(MIN_MM, roundMm(v)));

type Handle = {
  key: string;
  at: Point;
  title: string;
  color: string;
  label?: string;
  /** Dove sta l'etichetta rispetto alla maniglia (per non sovrapporsi alle altre). */
  place?: "above" | "below" | "left";
  onDrag: (p: Point) => void;
};

/**
 * Editor del volume 3D sulla foto: riquadro di facciata (quattro clic), maniglie
 * vincolate agli assi del mondo per ingombro e montanti, ritocco fine dei vertici.
 * Durante ogni trascinamento compare la lente d'ingrandimento.
 */
export function VolumeEditor({
  draft,
  dispatch,
  pv,
  tool,
  dims,
  onDims,
  freestanding,
  photoUrl,
  width,
  height,
}: {
  draft: VolumeDraft;
  dispatch: (a: VolumeAction) => void;
  /** Volume proiettato; null se manca o non è valido. */
  pv: ProjectedVolume | null;
  tool: VolumeTool;
  dims: { widthMm: number; depthMm: number };
  onDims: (patch: DimsPatch) => void;
  freestanding: boolean;
  photoUrl: string;
  width: number;
  height: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const u = useUnitsPerPx(svgRef, width);
  const dragging = useRef(false);
  const [loupe, setLoupe] = useState<Point | null>(null);
  const active = loupe !== null;
  // Il rilascio può avvenire fuori dall'SVG (o non arrivarci): la lente si chiude comunque.
  useEffect(() => {
    if (!active) return;
    const end = () => {
      dragging.current = false;
      setLoupe(null);
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [active]);

  const v = draft.volume;
  const handles: Handle[] = [];

  if (tool === "riquadro") {
    const names = ["basso a sinistra", "basso a destra", "alto a destra", "alto a sinistra"];
    draft.corners.forEach((c, i) =>
      handles.push({
        key: `c${i}`,
        at: c,
        title: `Angolo ${draft.corners.length === 4 ? names[i] : i + 1} del riquadro: trascina per spostarlo`,
        color: REF,
        onDrag: (p) => dispatch({ type: "moveCorner", i, p }),
      }),
    );
  } else if (v && pv && tool === "volume") {
    const { pose } = pv;
    const W = dims.widthMm;
    const D = dims.depthMm;
    const x0 = v.box.offsetXMm;
    const z0 = v.box.distanceMm;
    const z1 = z0 + D;
    const mid = x0 + W / 2;
    const X: Vec3 = [1, 0, 0];
    const Y: Vec3 = [0, 1, 0];
    const Z: Vec3 = [0, 0, 1];
    const add = (
      key: string,
      world: Vec3,
      title: string,
      onDrag: (p: Point) => void,
      label?: string,
      color = HANDLE,
      place: Handle["place"] = "above",
    ) => {
      const at = project(pose, world);
      if (at) handles.push({ key, at, title, onDrag, label, color, place });
    };

    add("move", [mid, 0, z0], "Sposta il volume lungo il muro", (p) =>
      dispatch({ type: "setBox", patch: { offsetXMm: alongAxis(pose, [0, 0, z0], X, p) - W / 2 } }),
    );
    add("left", [x0, v.box.wallHeightMm / 2, z0], "Estremo sinistro: cambia la larghezza", (p) => {
      const right = x0 + W;
      const width = clampMm(right - alongAxis(pose, [0, v.box.wallHeightMm / 2, z0], X, p));
      onDims({ widthMm: width });
      dispatch({ type: "setBox", patch: { offsetXMm: right - width } });
    });
    add(
      "right",
      [x0 + W, v.box.wallHeightMm / 2, z0],
      "Estremo destro: cambia la larghezza",
      (p) => onDims({ widthMm: clampMm(alongAxis(pose, [0, v.box.wallHeightMm / 2, z0], X, p) - x0) }),
      `larghezza ${W}`,
    );
    add(
      "depth",
      [mid, 0, z1],
      "Bordo anteriore: cambia la sporgenza",
      (p) => onDims({ depthMm: clampMm(alongAxis(pose, [mid, 0, 0], Z, p) - z0) }),
      `sporgenza ${D}`,
    );
    add(
      "wallH",
      [mid, v.box.wallHeightMm, z0],
      freestanding ? "Altezza sul retro" : "Altezza dell'attacco a muro",
      (p) => {
        const h = clampMm(alongAxis(pose, [mid, 0, z0], Y, p));
        dispatch({ type: "setBox", patch: { wallHeightMm: h } });
        onDims({ totalHeightMm: h });
      },
      `${freestanding ? "h retro" : "h muro"} ${v.box.wallHeightMm}`,
      VOLUME_COLORS.wall,
      "left",
    );
    add(
      "frontH",
      [mid, v.box.frontHeightMm, z1],
      "Altezza sul fronte",
      (p) => dispatch({ type: "setBox", patch: { frontHeightMm: clampMm(alongAxis(pose, [mid, 0, z1], Y, p)) } }),
      `h fronte ${v.box.frontHeightMm}`,
    );
    if (freestanding) {
      add(
        "distance",
        [x0 + W * 0.2, 0, z0],
        "Distanza dal muro",
        (p) => dispatch({ type: "setBox", patch: { distanceMm: alongAxis(pose, [x0 + W * 0.2, 0, 0], Z, p) } }),
        `dal muro ${z0}`,
      );
    }
    const posts = (ts: number[], rear: boolean, z: number) =>
      ts.forEach((t, i) =>
        add(
          `${rear ? "r" : "f"}${i}`,
          [x0 + t * W, 0, z],
          `Montante ${rear ? "posteriore" : "anteriore"} ${i + 1}: trascina lungo il bordo`,
          (p) => dispatch({ type: "movePost", rear, i, t: roundMm(alongAxis(pose, [0, 0, z], X, p) - x0) / W }),
          String(Math.round(t * W)),
          VOLUME_COLORS.post,
          "below",
        ),
      );
    posts(v.frontPosts, false, z1);
    if (z0 > 0) posts(v.rearPosts, true, z0);
  } else if (v && pv && tool === "ritocco") {
    pv.vertices.forEach((at, i) => {
      const n = v.nudges?.[i] ?? { x: 0, y: 0 };
      const base = { x: at.x - n.x, y: at.y - n.y };
      handles.push({
        key: `n${i}`,
        at,
        title: "Ritocco fine: trascina l'angolo per correggerlo di poco",
        color: HANDLE,
        onDrag: (p) => dispatch({ type: "nudge", i, d: { x: p.x - base.x, y: p.y - base.y } }),
      });
    });
  }

  const { handleProps } = useHandleDrag(svgRef, (i, p) => handles[i]?.onDrag(p));
  const picking = tool === "riquadro" && draft.corners.length < 4;
  const quad = draft.corners.map((c) => `${c.x * width},${c.y * height}`).join(" ");

  return (
    <>
      <svg
        ref={svgRef}
        className="overlay overlay-active"
        style={picking ? undefined : { cursor: "default" }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="application"
        aria-label="Volume 3D: riquadro di facciata, ingombro e montanti sulla foto"
        onClick={(e) => {
          if (!picking || fromHandle(e) || !svgRef.current) return;
          dispatch({ type: "addCorner", p: pointerToNormalized(e, svgRef.current) });
        }}
        onPointerDownCapture={(e) => {
          if (!fromHandle(e) || !svgRef.current) return;
          dragging.current = true;
          setLoupe(pointerToNormalized(e, svgRef.current));
        }}
        onPointerMoveCapture={(e) => {
          if (dragging.current && svgRef.current) setLoupe(pointerToNormalized(e, svgRef.current));
        }}
        onPointerUpCapture={() => {
          dragging.current = false;
          setLoupe(null);
        }}
        onPointerCancelCapture={() => {
          dragging.current = false;
          setLoupe(null);
        }}
      >
        {draft.corners.length >= 2 && (
          <polygon
            points={quad}
            fill={tool === "riquadro" ? "rgba(52, 199, 89, 0.12)" : "none"}
            stroke={REF}
            strokeWidth={tool === "riquadro" ? 2.5 : 1.5}
            strokeDasharray="10 6"
            opacity={tool === "riquadro" ? 1 : 0.6}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        {pv && <VolumeShape pv={pv} width={width} height={height} faint={tool === "riquadro"} />}
        {handles.map((h, i) => (
          <g key={h.key}>
            {h.label && (
              <text
                x={h.at.x * width + (h.place === "below" ? -10 : h.place === "left" ? -12 : 12) * u}
                y={h.at.y * height + (h.place === "below" ? 24 : -10) * u}
                textAnchor={h.place === "left" ? "end" : "start"}
                fontSize={12 * u}
                fontWeight={700}
                fill="#fff"
                stroke={OUTLINE}
                strokeWidth={3 * u}
                paintOrder="stroke"
                pointerEvents="none"
              >
                {h.label}
              </text>
            )}
            <circle
              {...handleProps(i)}
              cx={h.at.x * width}
              cy={h.at.y * height}
              r={8 * u}
              fill={h.color}
              stroke={OUTLINE}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="handle"
            >
              <title>{h.title}</title>
            </circle>
          </g>
        ))}
      </svg>
      {loupe && <Loupe at={loupe} photoUrl={photoUrl} stageWidth={width / u} stageHeight={height / u} />}
    </>
  );
}
