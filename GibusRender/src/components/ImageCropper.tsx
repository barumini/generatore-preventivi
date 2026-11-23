"use client";

import { useEffect, useRef, useState } from "react";
import { cropOutputSize, cropRectFromPoints, type CropRect, type Pt } from "@/lib/catalog/crop";

/**
 * Ritaglio di un'immagine nel browser: si trascina un rettangolo sulla foto
 * (es. per tenere solo la pergola e lasciare fuori logo, arredi e sfondo).
 */
export function ImageCropper({
  file,
  onCropped,
  onCancel,
}: {
  file: File;
  onCropped: (cropped: File) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  /** Dimensioni originali, note solo a immagine caricata. */
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<CropRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const start = useRef<Pt | null>(null);
  const [live, setLive] = useState<CropRect | null>(null);

  // Il componente si rimonta per ogni file (key del genitore): stato iniziale sempre pulito.
  useEffect(() => {
    let cancelled = false;
    const reader = new FileReader();
    reader.onload = () => {
      if (!cancelled) setUrl(String(reader.result));
    };
    reader.readAsDataURL(file);
    return () => {
      cancelled = true;
    };
  }, [file]);

  /** Punto del puntatore in pixel dell'immagine originale. */
  function toImagePoint(e: React.PointerEvent): Pt | null {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return null;
    const box = img.getBoundingClientRect();
    return {
      x: ((e.clientX - box.left) / box.width) * img.naturalWidth,
      y: ((e.clientY - box.top) / box.height) * img.naturalHeight,
    };
  }

  function rectFor(a: Pt, b: Pt): CropRect | null {
    const img = imgRef.current;
    return img ? cropRectFromPoints(a, b, img.naturalWidth, img.naturalHeight) : null;
  }

  function onDown(e: React.PointerEvent) {
    const p = toImagePoint(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = p;
    setRect(null);
    setLive(null);
  }
  function onMove(e: React.PointerEvent) {
    const p = toImagePoint(e);
    if (start.current && p) setLive(rectFor(start.current, p));
  }
  function onUp(e: React.PointerEvent) {
    const p = toImagePoint(e);
    if (start.current && p) setRect(rectFor(start.current, p));
    start.current = null;
    setLive(null);
  }

  function crop() {
    const img = imgRef.current;
    if (!img || !rect) return;
    const out = cropOutputSize(rect.width, rect.height);
    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return setError("Il browser non riesce a ritagliare l'immagine");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height, 0, 0, out.width, out.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError("Ritaglio non riuscito: riprova");
        const base = file.name.replace(/\.[^.]+$/, "") || "riferimento";
        onCropped(new File([blob], `${base}-ritaglio.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  const shown = live ?? rect;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className="card" role="group" aria-label="Ritaglio dell'immagine">
      <p className="muted small">
        Trascina un rettangolo sull&apos;immagine per tenere solo la pergola (senza logo, arredi o sfondo), poi
        &quot;Ritaglia e usa&quot;. Oppure usa l&apos;immagine intera.
      </p>
      {error && <div className="banner-error" role="alert">{error}</div>}
      {url && (
        <div
          className="cropper-stage"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={url}
            alt="Immagine da ritagliare"
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          />
          {shown && natural && (
            <div
              className="cropper-rect"
              style={{
                left: pct(shown.left, natural.w),
                top: pct(shown.top, natural.h),
                width: pct(shown.width, natural.w),
                height: pct(shown.height, natural.h),
              }}
            />
          )}
        </div>
      )}
      <div className="row" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn btn-primary" disabled={!rect} onClick={crop}>Ritaglia e usa</button>
        <button type="button" className="btn" onClick={() => onCropped(file)}>Usa l&apos;immagine intera</button>
        <button type="button" className="btn" onClick={onCancel}>Annulla</button>
      </div>
    </div>
  );
}
