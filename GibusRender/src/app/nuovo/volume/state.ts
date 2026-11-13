// Stato dell'editor del volume 3D: riduttore puro, senza React, così è testabile da solo.
import type { Point } from "@/lib/render/geometry";
import {
  FOCAL_RATIO_MAX,
  FOCAL_RATIO_MIN,
  defaultVolume,
  evenPosts,
  orderCorners,
  roundMm,
  type RefRect,
  type Volume,
  type VolumeBox,
  type VolumeDims,
} from "@/lib/render/volume";

export type VolumeDraft = {
  /** Angoli del riquadro di facciata cliccati finora (0..4; a quattro sono già ordinati). */
  corners: Point[];
  refWidthMm: string;
  refHeightMm: string;
  refBaseMm: string;
  /** Creato quando il riquadro è completo e le sue misure sono valide. */
  volume: Volume | null;
};

export type RefField = "refWidthMm" | "refHeightMm" | "refBaseMm";

export type VolumeAction =
  | { type: "addCorner"; p: Point }
  | { type: "moveCorner"; i: number; p: Point }
  | { type: "resetRef" }
  | { type: "setRef"; field: RefField; value: string }
  | { type: "setBox"; patch: Partial<VolumeBox> }
  | { type: "setFocal"; ratio: number | null }
  | { type: "setPostCount"; rear: boolean; count: number }
  | { type: "movePost"; rear: boolean; i: number; t: number }
  | { type: "nudge"; i: number; d: Point }
  | { type: "clearNudges" }
  /** Il prodotto è passato da addossato ad autoportante (o viceversa): volume da capo, stesso riquadro. */
  | { type: "remount" };

export type VolumeContext = { dims: VolumeDims; totalHeightMm: number; freestanding: boolean };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Intero non negativo dal campo; null se non valido. */
function mm(v: string): number | null {
  const t = v.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** Riquadro completo (quattro angoli e misure valide), altrimenti null. */
function refOf(s: VolumeDraft): RefRect | null {
  const widthMm = mm(s.refWidthMm);
  const heightMm = mm(s.refHeightMm);
  const baseMm = s.refBaseMm.trim() === "" ? 0 : mm(s.refBaseMm);
  if (s.corners.length !== 4 || !widthMm || !heightMm || baseMm === null) return null;
  return { corners: s.corners as RefRect["corners"], widthMm, heightMm, baseMm };
}

/** Allinea il volume al riquadro: lo crea se manca, altrimenti ne aggiorna solo il riquadro. */
function syncRef(s: VolumeDraft, ctx: VolumeContext): VolumeDraft {
  const ref = refOf(s);
  if (!ref) return s; // misure incomplete: il volume, se c'è, resta com'era
  return {
    ...s,
    volume: s.volume ? { ...s.volume, ref } : defaultVolume(ref, ctx.dims, ctx.totalHeightMm, ctx.freestanding),
  };
}

export function draftFromVolume(v: Volume | null): VolumeDraft {
  if (!v) return { corners: [], refWidthMm: "", refHeightMm: "", refBaseMm: "0", volume: null };
  return {
    corners: v.ref.corners,
    refWidthMm: String(v.ref.widthMm),
    refHeightMm: String(v.ref.heightMm),
    refBaseMm: String(v.ref.baseMm),
    volume: v,
  };
}

export function volumeReducer(s: VolumeDraft, a: VolumeAction, ctx: VolumeContext): VolumeDraft {
  switch (a.type) {
    case "addCorner": {
      if (s.corners.length >= 4) return s;
      const corners = [...s.corners, a.p];
      return syncRef({ ...s, corners: corners.length === 4 ? orderCorners(corners) : corners }, ctx);
    }
    case "moveCorner": {
      if (!s.corners[a.i]) return s;
      return syncRef({ ...s, corners: s.corners.map((p, i) => (i === a.i ? a.p : p)) }, ctx);
    }
    case "resetRef":
      return { ...s, corners: [], volume: null };
    case "setRef":
      return syncRef({ ...s, [a.field]: a.value }, ctx);
  }

  // Da qui in poi le azioni modificano un volume esistente.
  const v = s.volume;
  if (!v) return s;
  const set = (patch: Partial<Volume>): VolumeDraft => ({ ...s, volume: { ...v, ...patch } });

  switch (a.type) {
    case "setBox": {
      const box = { ...v.box };
      const p = a.patch;
      if (p.offsetXMm !== undefined && Number.isFinite(p.offsetXMm)) box.offsetXMm = roundMm(p.offsetXMm);
      if (p.distanceMm !== undefined && Number.isFinite(p.distanceMm)) {
        box.distanceMm = ctx.freestanding ? Math.max(0, roundMm(p.distanceMm)) : 0;
      }
      for (const key of ["wallHeightMm", "frontHeightMm"] as const) {
        const value = p[key];
        if (value !== undefined && Number.isFinite(value) && roundMm(value) > 0) box[key] = roundMm(value);
      }
      return set({ box });
    }
    case "setFocal":
      return set({ focalRatio: a.ratio === null ? null : clamp(a.ratio, FOCAL_RATIO_MIN, FOCAL_RATIO_MAX) });
    case "setPostCount": {
      if (a.rear && !ctx.freestanding) return s;
      const posts = evenPosts(a.count);
      return set(a.rear ? { rearPosts: posts } : { frontPosts: posts });
    }
    case "movePost": {
      const posts = a.rear ? v.rearPosts : v.frontPosts;
      if (posts[a.i] === undefined) return s;
      // Resta sul bordo e tra i due vicini, così l'ordine da sinistra a destra non cambia.
      const t = clamp(a.t, posts[a.i - 1] ?? 0, posts[a.i + 1] ?? 1);
      const next = posts.map((q, i) => (i === a.i ? t : q));
      return set(a.rear ? { rearPosts: next } : { frontPosts: next });
    }
    case "nudge": {
      if (a.i < 0 || a.i > 7) return s;
      const nudges = v.nudges ? [...v.nudges] : Array.from({ length: 8 }, () => ({ x: 0, y: 0 }));
      nudges[a.i] = a.d;
      return set({ nudges });
    }
    case "clearNudges":
      return set({ nudges: null });
    case "remount":
      return { ...s, volume: defaultVolume(v.ref, ctx.dims, ctx.totalHeightMm, ctx.freestanding) };
  }
}
