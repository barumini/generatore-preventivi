import { describe, expect, it } from "vitest";
import { MAX_PARALLEL, planLaunch, runLimited, type ColumnState } from "@/lib/render/queue";

const cols: ColumnState[] = [
  { renderId: "a", requested: 3, existing: 3 },
  { renderId: "b", requested: 2, existing: 0 },
];

describe("planLaunch", () => {
  it("in avvio lancia le varianti richieste alternando le colonne", () => {
    expect(planLaunch(cols, { providerDisabled: false, mode: "start" })).toEqual(["a", "b", "a", "b", "a"]);
  });

  it("per le mancanti lancia solo la differenza tra richieste e presenti", () => {
    expect(planLaunch(cols, { providerDisabled: false, mode: "missing" })).toEqual(["b", "b"]);
  });

  it("non lancia mai più delle richieste, anche con più varianti presenti", () => {
    expect(
      planLaunch([{ renderId: "a", requested: 2, existing: 5 }], { providerDisabled: false, mode: "missing" }),
    ).toEqual([]);
  });

  it("con il fornitore disabilitato non lancia nulla", () => {
    expect(planLaunch(cols, { providerDisabled: true, mode: "start" })).toEqual([]);
    expect(planLaunch(cols, { providerDisabled: true, mode: "missing" })).toEqual([]);
  });

  it("senza colonne non lancia nulla", () => {
    expect(planLaunch([], { providerDisabled: false, mode: "start" })).toEqual([]);
  });
});

describe("runLimited", () => {
  it("il limite predefinito è 4", () => {
    expect(MAX_PARALLEL).toBe(4);
  });

  it("non tiene mai più di `limit` compiti in corso e restituisce i risultati in ordine", async () => {
    let running = 0;
    let peak = 0;
    const tasks = Array.from({ length: 10 }, (_, i) => async () => {
      running++;
      peak = Math.max(peak, running);
      // Durate diverse: i compiti finiscono in un ordine diverso da quello di partenza.
      await new Promise((r) => setTimeout(r, ((i * 7) % 5) + 1));
      running--;
      return i;
    });
    const out = await runLimited(tasks, 4);
    expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(peak).toBe(4);
    expect(running).toBe(0);
  });

  it("un compito che rifiuta non ferma gli altri; alla fine si riporta il primo errore", async () => {
    const finished: number[] = [];
    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      await new Promise((r) => setTimeout(r, 1));
      if (i === 1 || i === 4) throw new Error(`rete ${i}`);
      finished.push(i);
      return i;
    });
    await expect(runLimited(tasks, 2)).rejects.toThrow("rete 1");
    expect(finished.sort()).toEqual([0, 2, 3, 5]);
  });

  it("senza compiti risolve con un elenco vuoto", async () => {
    expect(await runLimited([], 4)).toEqual([]);
  });
});
