"use client";

import { useRef, useState } from "react";

/** Confronto prima/dopo con cursore: a sinistra la foto originale, a destra la variante. */
export function BeforeAfter({
  beforeUrl,
  afterUrl,
  width,
  height,
}: {
  beforeUrl: string;
  afterUrl: string;
  width: number;
  height: number;
}) {
  const [pos, setPos] = useState(50);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function moveTo(clientX: number) {
    const box = stage.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const p = ((clientX - box.left) / box.width) * 100;
    setPos(Math.min(100, Math.max(0, p)));
  }

  return (
    <div className="ba">
      <div
        ref={stage}
        className="ba-stage"
        style={{ aspectRatio: `${width} / ${height}`, maxWidth: `calc(75vh * ${width} / ${height})` }}
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) moveTo(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt="Dopo: variante generata" draggable={false} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt="Prima: foto originale"
          draggable={false}
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <div className="ba-divider" style={{ left: `${pos}%` }} aria-hidden="true" />
        <span className="ba-label ba-label-left">Prima</span>
        <span className="ba-label ba-label-right">Dopo</span>
      </div>
      <input
        type="range"
        className="ba-range"
        min={0}
        max={100}
        step={1}
        value={Math.round(pos)}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Cursore prima/dopo"
      />
    </div>
  );
}
