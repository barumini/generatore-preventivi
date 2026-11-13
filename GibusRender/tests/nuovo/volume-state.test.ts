import { describe, expect, it } from "vitest";
import { draftFromVolume, volumeReducer, type VolumeAction, type VolumeDraft } from "@/app/nuovo/volume/state";

const ctx = { dims: { widthMm: 4000, depthMm: 3000 }, totalHeightMm: 2600, freestanding: false };
const free = { ...ctx, freestanding: true };
const CLICKS = [
  { x: 0.7, y: 0.35 }, // alto-dx
  { x: 0.2, y: 0.8 }, // basso-sx
  { x: 0.2, y: 0.3 }, // alto-sx
  { x: 0.7, y: 0.75 }, // basso-dx
];
const ORDERED = [CLICKS[1], CLICKS[3], CLICKS[0], CLICKS[2]];

const run = (s: VolumeDraft, actions: VolumeAction[], c = ctx) => actions.reduce((acc, a) => volumeReducer(acc, a, c), s);
const empty = () => draftFromVolume(null);

/** Bozza con riquadro completo (5000 × 2400 mm) e quindi volume creato. */
function ready(c = ctx): VolumeDraft {
  return run(
    empty(),
    [
      { type: "setRef", field: "refWidthMm", value: "5000" },
      { type: "setRef", field: "refHeightMm", value: "2400" },
      ...CLICKS.map((p) => ({ type: "addCorner", p }) as VolumeAction),
    ],
    c,
  );
}

describe("riquadro di facciata", () => {
  it("parte vuoto, con quota da terra 0", () => {
    expect(empty()).toEqual({ corners: [], refWidthMm: "", refHeightMm: "", refBaseMm: "0", volume: null });
  });

  it("al quarto clic riordina gli angoli e, con le misure, crea il volume predefinito", () => {
    const s = ready();
    expect(s.corners).toEqual(ORDERED);
    expect(s.volume?.ref).toEqual({ corners: ORDERED, widthMm: 5000, heightMm: 2400, baseMm: 0 });
    expect(s.volume?.box).toEqual({ offsetXMm: 500, distanceMm: 0, wallHeightMm: 2600, frontHeightMm: 2600 });
    expect(s.volume?.frontPosts).toEqual([0, 1]);
  });

  it("un quinto clic non aggiunge angoli", () => {
    expect(volumeReducer(ready(), { type: "addCorner", p: { x: 0.5, y: 0.5 } }, ctx).corners).toHaveLength(4);
  });

  it("senza misure i quattro angoli non bastano; il volume nasce quando arrivano", () => {
    const s = run(empty(), CLICKS.map((p) => ({ type: "addCorner", p }) as VolumeAction));
    expect(s.volume).toBeNull();
    const withW = volumeReducer(s, { type: "setRef", field: "refWidthMm", value: "5000" }, ctx);
    expect(withW.volume).toBeNull();
    expect(volumeReducer(withW, { type: "setRef", field: "refHeightMm", value: "2400" }, ctx).volume).not.toBeNull();
  });

  it("spostare un angolo aggiorna il riquadro senza toccare l'ingombro", () => {
    const s = ready();
    const moved = volumeReducer(s, { type: "moveCorner", i: 2, p: { x: 0.72, y: 0.33 } }, ctx);
    expect(moved.volume?.ref.corners[2]).toEqual({ x: 0.72, y: 0.33 });
    expect(moved.corners[2]).toEqual({ x: 0.72, y: 0.33 });
    expect(moved.volume?.box).toEqual(s.volume?.box);
  });

  it("cambiare una misura del riquadro aggiorna il volume; una misura vuota lo lascia com'era", () => {
    const s = ready();
    const wider = volumeReducer(s, { type: "setRef", field: "refWidthMm", value: "5200" }, ctx);
    expect(wider.volume?.ref.widthMm).toBe(5200);
    expect(wider.volume?.box).toEqual(s.volume?.box);
    const blank = volumeReducer(wider, { type: "setRef", field: "refWidthMm", value: "" }, ctx);
    expect(blank.refWidthMm).toBe("");
    expect(blank.volume?.ref.widthMm).toBe(5200);
    const base = volumeReducer(s, { type: "setRef", field: "refBaseMm", value: "150" }, ctx);
    expect(base.volume?.ref.baseMm).toBe(150);
  });

  it("resetRef toglie angoli e volume ma tiene le misure", () => {
    const s = volumeReducer(ready(), { type: "resetRef" }, ctx);
    expect(s).toMatchObject({ corners: [], volume: null, refWidthMm: "5000", refHeightMm: "2400" });
  });
});

describe("ingombro", () => {
  it("setBox arrotonda ai 10 mm e rifiuta altezze non positive", () => {
    const s = volumeReducer(ready(), { type: "setBox", patch: { offsetXMm: 1234, wallHeightMm: 2857, frontHeightMm: -50 } }, ctx);
    expect(s.volume?.box).toEqual({ offsetXMm: 1230, distanceMm: 0, wallHeightMm: 2860, frontHeightMm: 2600 });
  });

  it("la distanza dal muro vale solo per gli autoportanti e non scende sotto zero", () => {
    expect(volumeReducer(ready(), { type: "setBox", patch: { distanceMm: 700 } }, ctx).volume?.box.distanceMm).toBe(0);
    expect(volumeReducer(ready(free), { type: "setBox", patch: { distanceMm: 704 } }, free).volume?.box.distanceMm).toBe(700);
    expect(volumeReducer(ready(free), { type: "setBox", patch: { distanceMm: -300 } }, free).volume?.box.distanceMm).toBe(0);
  });

  it("setFocal limita il rapporto all'intervallo ammesso; null torna ad automatica", () => {
    expect(volumeReducer(ready(), { type: "setFocal", ratio: 9 }, ctx).volume?.focalRatio).toBe(2.5);
    expect(volumeReducer(ready(), { type: "setFocal", ratio: 0.1 }, ctx).volume?.focalRatio).toBe(0.3);
    const manual = volumeReducer(ready(), { type: "setFocal", ratio: 1 }, ctx);
    expect(volumeReducer(manual, { type: "setFocal", ratio: null }, ctx).volume?.focalRatio).toBeNull();
  });

  it("remount ricrea il volume per il nuovo tipo di prodotto tenendo il riquadro", () => {
    const s = ready();
    const r = volumeReducer(s, { type: "remount" }, free);
    expect(r.volume?.ref).toEqual(s.volume?.ref);
    expect(r.volume?.box.distanceMm).toBe(1000);
    expect(r.volume?.rearPosts).toEqual([0, 1]);
  });
});

describe("montanti", () => {
  it("setPostCount distribuisce i montanti, da 0 a 6", () => {
    expect(volumeReducer(ready(), { type: "setPostCount", rear: false, count: 3 }, ctx).volume?.frontPosts).toEqual([0, 0.5, 1]);
    expect(volumeReducer(ready(), { type: "setPostCount", rear: false, count: 0 }, ctx).volume?.frontPosts).toEqual([]);
    expect(volumeReducer(ready(), { type: "setPostCount", rear: false, count: 9 }, ctx).volume?.frontPosts).toHaveLength(6);
  });

  it("i montanti posteriori esistono solo per gli autoportanti", () => {
    expect(volumeReducer(ready(), { type: "setPostCount", rear: true, count: 2 }, ctx).volume?.rearPosts).toEqual([]);
    expect(volumeReducer(ready(free), { type: "setPostCount", rear: true, count: 3 }, free).volume?.rearPosts).toEqual([0, 0.5, 1]);
  });

  it("movePost resta sul bordo e non scavalca i vicini", () => {
    const three = volumeReducer(ready(), { type: "setPostCount", rear: false, count: 3 }, ctx);
    expect(volumeReducer(three, { type: "movePost", rear: false, i: 1, t: 0.3 }, ctx).volume?.frontPosts).toEqual([0, 0.3, 1]);
    expect(volumeReducer(three, { type: "movePost", rear: false, i: 2, t: 1.4 }, ctx).volume?.frontPosts).toEqual([0, 0.5, 1]);
    expect(volumeReducer(three, { type: "movePost", rear: false, i: 0, t: 0.8 }, ctx).volume?.frontPosts).toEqual([0.5, 0.5, 1]);
  });
});

describe("ritocco fine", () => {
  it("nudge imposta lo scostamento di un vertice; clearNudges li azzera", () => {
    const s = volumeReducer(ready(), { type: "nudge", i: 3, d: { x: 0.01, y: -0.02 } }, ctx);
    expect(s.volume?.nudges).toHaveLength(8);
    expect(s.volume?.nudges?.[3]).toEqual({ x: 0.01, y: -0.02 });
    expect(s.volume?.nudges?.[0]).toEqual({ x: 0, y: 0 });
    expect(volumeReducer(s, { type: "clearNudges" }, ctx).volume?.nudges).toBeNull();
  });
});

describe("draftFromVolume", () => {
  it("ricostruisce la bozza da un volume salvato (Duplica e modifica)", () => {
    const v = ready().volume!;
    expect(draftFromVolume(v)).toEqual({
      corners: v.ref.corners,
      refWidthMm: "5000",
      refHeightMm: "2400",
      refBaseMm: "0",
      volume: v,
    });
  });

  it("le azioni sul volume non fanno nulla finché il volume non c'è", () => {
    const s = empty();
    expect(volumeReducer(s, { type: "setBox", patch: { offsetXMm: 10 } }, ctx)).toEqual(s);
    expect(volumeReducer(s, { type: "setPostCount", rear: false, count: 3 }, ctx)).toEqual(s);
  });
});
