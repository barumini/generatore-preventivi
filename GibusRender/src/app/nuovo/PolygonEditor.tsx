"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/render/geometry";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Posizione del puntatore in coordinate normalizzate 0..1 rispetto all'SVG (che copre la foto). */
export function pointerToNormalized(e: { clientX: number; clientY: number }, svg: SVGSVGElement): Point {
  const r = svg.getBoundingClientRect();
  return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
}

/**
 * Unità SVG per pixel a schermo: l'SVG usa le dimensioni della foto come viewBox
 * e si adatta all'immagine mostrata, così maniglie e testi restano di misura costante.
 */
export function useUnitsPerPx(svgRef: React.RefObject<SVGSVGElement | null>, photoWidth: number): number {
  const [unitsPerPx, setUnitsPerPx] = useState(1);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () => {
      const w = svg.getBoundingClientRect().width;
      if (w > 0) setUnitsPerPx(photoWidth / w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [svgRef, photoWidth]);
  return unitsPerPx;
}

/** Trascinamento di una maniglia; restituisce i gestori da collegare all'SVG e alle maniglie. */
export function useHandleDrag(
  svgRef: React.RefObject<SVGSVGElement | null>,
  onMove: (index: number, p: Point) => void,
) {
  const drag = useRef<number | null>(null);
  return {
    handleProps: (index: number) => ({
      "data-handle": "",
      onPointerDown: (e: React.PointerEvent<SVGElement>) => {
        e.stopPropagation();
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = index;
      },
      onPointerMove: (e: React.PointerEvent<SVGElement>) => {
        if (drag.current !== index || !svgRef.current) return;
        onMove(index, pointerToNormalized(e, svgRef.current));
      },
      onPointerUp: () => {
        drag.current = null;
      },
      onPointerCancel: () => {
        drag.current = null;
      },
    }),
  };
}

/** true se il clic è partito da una maniglia (che non deve aggiungere punti). */
export function fromHandle(e: React.MouseEvent): boolean {
  return e.target instanceof Element && e.target.closest("[data-handle]") !== null;
}

/**
 * Sagoma della pergola disegnata sulla foto. Clic: aggiunge un punto;
 * trascinamento: sposta un punto; doppio clic su un punto: lo elimina.
 * Coordinate normalizzate 0..1.
 */
export function PolygonEditor({
  points,
  onChange,
  active,
  width,
  height,
}: {
  points: Point[];
  onChange: (points: Point[]) => void;
  active: boolean;
  width: number;
  height: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const u = useUnitsPerPx(svgRef, width);
  const { handleProps } = useHandleDrag(svgRef, (i, p) =>
    onChange(points.map((q, j) => (j === i ? p : q))),
  );

  const px = points.map((p) => `${p.x * width},${p.y * height}`).join(" ");

  return (
    <svg
      ref={svgRef}
      className={`overlay${active ? " overlay-active" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role={active ? "application" : undefined}
      aria-label={active ? "Sagoma della pergola: clic per aggiungere punti" : undefined}
      onClick={(e) => {
        if (!active || fromHandle(e) || !svgRef.current) return;
        onChange([...points, pointerToNormalized(e, svgRef.current)]);
      }}
    >
      {points.length >= 3 ? (
        <polygon
          points={px}
          fill="rgba(215, 38, 46, 0.28)"
          stroke="#d7262e"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
      ) : (
        points.length === 2 && (
          <polyline points={px} fill="none" stroke="#d7262e" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        )
      )}
      {active &&
        points.map((p, i) => (
          <circle
            key={i}
            {...handleProps(i)}
            cx={p.x * width}
            cy={p.y * height}
            r={(i === 0 ? 9 : 7) * u}
            fill="#fff"
            stroke="#d7262e"
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
            className="handle"
            onDoubleClick={(e) => {
              e.stopPropagation();
              onChange(points.filter((_, j) => j !== i));
            }}
          >
            <title>{`Punto ${i + 1}: trascina per spostarlo, doppio clic per eliminarlo`}</title>
          </circle>
        ))}
    </svg>
  );
}
