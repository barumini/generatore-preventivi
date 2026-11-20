import { db } from "@/lib/db";
import { deleteRender } from "@/lib/render/actions";
import { checkCombos, type FinishCombo } from "@/lib/render/combos";
import { createRender, RenderInputError, type CreateRenderInput } from "@/lib/render/generate";

/**
 * Crea un confronto di finiture: un `Comparison` e un render normale per combinazione,
 * tutti sulla stessa foto. Tutto o niente: se un render non si crea, si eliminano quelli
 * già creati (con i loro file) e il confronto, poi si rilancia l'errore originale.
 *
 * Il testo per l'IA lo costruisce `createRender` per ogni finitura (un `prompt` in input
 * è ignorato). Il primo render usa la foto dell'input (caricata, o quella del suo
 * `sourceRenderId`); gli altri copiano la foto già salvata del primo.
 */
export async function createComparison(
  input: CreateRenderInput,
  combos: readonly FinishCombo[],
): Promise<{ id: string; renderIds: string[] }> {
  const problem = checkCombos(combos);
  if (problem) throw new RenderInputError(problem);

  const comparison = await db.comparison.create({ data: { clientRef: input.clientRef.trim() } });
  const renderIds: string[] = [];
  try {
    for (const combo of combos) {
      const first = renderIds[0];
      const render = await createRender({
        ...input,
        ...(first ? { photo: undefined, sourceRenderId: first } : {}),
        prompt: undefined,
        colorId: combo.colorId ?? undefined,
        fabricId: combo.fabricId ?? undefined,
        comparisonId: comparison.id,
      });
      renderIds.push(render.id);
    }
  } catch (err) {
    for (const id of renderIds) {
      try {
        await deleteRender(id);
      } catch (cleanupErr) {
        console.error(`Pulizia del render ${id} non riuscita:`, cleanupErr);
      }
    }
    // Dopo la pulizia il confronto può essere già sparito: deleteMany non lancia se manca.
    await db.comparison.deleteMany({ where: { id: comparison.id } }).catch((e: unknown) => {
      console.error(`Pulizia del confronto ${comparison.id} non riuscita:`, e);
    });
    throw err;
  }
  return { id: comparison.id, renderIds };
}
