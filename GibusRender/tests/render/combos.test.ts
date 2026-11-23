import { describe, expect, it } from "vitest";
import { MAX_COMBOS, MIN_COMBOS, checkCombos, finishCombos, parseCombos, type FinishCombo } from "@/lib/render/combos";

describe("finishCombos", () => {
  it("2 colori × 2 tessuti: 4 combinazioni nell'ordine colori × tessuti", () => {
    expect(finishCombos(["c1", "c2"], ["f1", "f2"])).toEqual([
      { colorId: "c1", fabricId: "f1" },
      { colorId: "c1", fabricId: "f2" },
      { colorId: "c2", fabricId: "f1" },
      { colorId: "c2", fabricId: "f2" },
    ]);
  });

  it("3 colori senza tessuti: 3 combinazioni con fabricId null", () => {
    expect(finishCombos(["c1", "c2", "c3"], [])).toEqual([
      { colorId: "c1", fabricId: null },
      { colorId: "c2", fabricId: null },
      { colorId: "c3", fabricId: null },
    ]);
  });

  it("nessun colore e 2 tessuti: 2 combinazioni con colorId null", () => {
    expect(finishCombos([], ["f1", "f2"])).toEqual([
      { colorId: null, fabricId: "f1" },
      { colorId: null, fabricId: "f2" },
    ]);
  });

  it("nessuna scelta: una sola combinazione vuota", () => {
    expect(finishCombos([], [])).toEqual([{ colorId: null, fabricId: null }]);
  });
});

describe("checkCombos", () => {
  const combo = (colorId: string | null, fabricId: string | null = null): FinishCombo => ({ colorId, fabricId });
  const many = (n: number) => Array.from({ length: n }, (_, i) => combo(`c${i}`));

  it("costanti dei limiti", () => {
    expect(MIN_COMBOS).toBe(2);
    expect(MAX_COMBOS).toBe(6);
  });

  it("1 combinazione: messaggio di minimo", () => {
    expect(checkCombos([combo("c1")])).toBe(
      "Scegli almeno due finiture da confrontare, oppure spegni «Confronta più finiture»",
    );
  });

  it("nessuna combinazione: messaggio di minimo", () => {
    expect(checkCombos([])).toBe(
      "Scegli almeno due finiture da confrontare, oppure spegni «Confronta più finiture»",
    );
  });

  it("7 combinazioni: messaggio di massimo con il conteggio", () => {
    expect(checkCombos(many(7))).toBe("Al massimo 6 finiture per confronto: ne hai scelte 7");
  });

  it("duplicati: messaggio di ripetizione", () => {
    expect(checkCombos([combo("c1", "f1"), combo("c1", "f1")])).toBe("Finiture ripetute nel confronto");
  });

  it("i duplicati vincono sul conteggio: anche con 1 o con 7 combinazioni", () => {
    expect(checkCombos([combo("c1"), combo("c1")])).toBe("Finiture ripetute nel confronto");
    const seven = [...many(6), combo("c0")];
    expect(checkCombos(seven)).toBe("Finiture ripetute nel confronto");
  });

  it("2 e 6 combinazioni distinte: null", () => {
    expect(checkCombos(many(2))).toBeNull();
    expect(checkCombos(many(6))).toBeNull();
  });
});

describe("parseCombos", () => {
  it("accetta una combinazione valida", () => {
    expect(parseCombos([{ colorId: "a", fabricId: null }])).toEqual([{ colorId: "a", fabricId: null }]);
  });

  it("rifiuta un valore che non è un elenco", () => {
    expect(() => parseCombos("x")).toThrow("Finiture del confronto non valide");
  });

  it("rifiuta un identificativo di tipo errato", () => {
    expect(() => parseCombos([{ colorId: 1 }])).toThrow("Finiture del confronto non valide");
  });
});
