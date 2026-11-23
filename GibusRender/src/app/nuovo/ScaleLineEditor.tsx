"use client";

import { useRef } from "react";
import type { Point } from "@/lib/render/geometry";
import { fromHandle, pointerToNormalized, useHandleDrag, useUnitsPerPx } from "./PolygonEditor";

/** Linea di scala in costruzione: zero, uno o due punti. */
export type ScaleDraft = { a?: Point; b?: Point };

const LINE = "#ffd23f";
const OUTLINE = "#2b2a28";

/**
 * Linea di riferimento per la scala, tracciata su un elemento di misura nota.
 * Clic: primo e secondo punto (un terzo clic ricomincia la linea);
 * trascinamento: sposta un estremo; doppio clic su un estremo: lo elimina.
 */
export function ScaleLineEditor({
  line,
  lengthMm,
  onChange,
  active,
  width,
  height,
}: {
  line: ScaleDraft;
  lengthMm: number | null;
  onChange: (line: ScaleDraft) => void;
  active: boolean;
  width: number;
  height: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const u = useUnitsPerPx(svgRef, width);
  const ends = [line.a, line.b];
  const { handleProps } = useHandleDrag(svgRef, (i, p) => onChange(i === 0 ? { ...line, a: p } : { ...line, b: p }));

  const { a, b } = line;
  // Etichetta a lato della linea (lungo la normale), così non la copre.
  let label: { x: number; y: number; anchor: "start" | "middle" | "end" } | null = null;
  if (a && b) {
    const dx = (b.x - a.x) * width;
    const dy = (b.y - a.y) * height;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0 || (ny === 0 && nx > 0)) [nx, ny] = [-nx, -ny]; // verso l'alto/sinistra
    const off = 16 * u;
    label = {
      x: ((a.x + b.x) / 2) * width + nx * off,
      y: ((a.y + b.y) / 2) * height + ny * off,
      anchor: nx < -0.5 ? "end" : nx > 0.5 ? "start" : "middle",
    };
  }
  return (
    <svg
      ref={svgRef}
      className={`overlay${active ? " overlay-active" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role={active ? "application" : undefined}
      aria-label={active ? "Linea di scala: clic sui due estremi di un elemento di misura nota" : undefined}
      onClick={(e) => {
        if (!active || fromHandle(e) || !svgRef.current) return;
        const p = pointerToNormalized(e, svgRef.current);
        if (!a) onChange({ a: p });
        else if (!b) onChange({ a, b: p });
        else onChange({ a: p });
      }}
    >
      {a && b && (
        <>
          <line
            x1={a.x * width}
            y1={a.y * height}
            x2={b.x * width}
            y2={b.y * height}
            stroke={OUTLINE}
            strokeWidth={6}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          <line
            x1={a.x * width}
            y1={a.y * height}
            x2={b.x * width}
            y2={b.y * height}
            stroke={LINE}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
          {lengthMm !== null && label && (
            <text
              x={label.x}
              y={label.y}
              fontSize={14 * u}
              fontWeight={700}
              textAnchor={label.anchor}
              dominantBaseline="middle"
              fill={LINE}
              stroke={OUTLINE}
              strokeWidth={3 * u}
              paintOrder="stroke"
            >
              {lengthMm.toLocaleString("it-IT")} mm
            </text>
          )}
        </>
      )}
      {ends.map((p, i) =>
        p ? (
          <circle
            key={i}
            {...(active ? handleProps(i) : {})}
            cx={p.x * width}
            cy={p.y * height}
            r={(active ? 7 : 4) * u}
            fill={LINE}
            stroke={OUTLINE}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            className={active ? "handle" : undefined}
            onDoubleClick={(e) => {
              if (!active) return;
              e.stopPropagation();
              // Elimina l'estremo; quello rimasto diventa il primo punto.
              const other = i === 0 ? b : a;
              onChange(other ? { a: other } : {});
            }}
          >
            {active && <title>{`Estremo ${i + 1}: trascina per spostarlo, doppio clic per eliminarlo`}</title>}
          </circle>
        ) : null,
      )}
    </svg>
  );
}
