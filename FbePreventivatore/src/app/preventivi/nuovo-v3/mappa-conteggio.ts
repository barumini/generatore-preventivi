import { CATALOGO_VOCI } from '@/domain/voci'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'
import type { StatoForm } from '../nuovo/stato-form'

const ID_CATALOGO = new Set(CATALOGO_VOCI.map((voce) => voce.id))

export interface EsitoMappaConteggio {
  overrides: StatoForm['overrides']
  vociScartate: string[]
}

/**
 * Traduce il risultato del conteggio in override del wizard. Il merge parte sempre da
 * `overridesAttuali`: una voce del conteggio non prevale mai su un override esistente
 * per una voce diversa (es. `garage`, digitato a mano in StepPrezzi), e un conteggio
 * più recente sovrascrive solo le chiavi che tocca lui stesso.
 */
export function mappaConteggioAOverride(
  voci: VoceConteggiata[],
  overridesAttuali: StatoForm['overrides'],
): EsitoMappaConteggio {
  const overrides = { ...overridesAttuali }
  const vociScartate: string[] = []

  for (const voce of voci) {
    if (!ID_CATALOGO.has(voce.idMaster)) {
      vociScartate.push(voce.idMaster)
      continue
    }
    overrides[voce.idMaster] = voce.importo === 'compresa' ? 'comprese' : voce.importo
  }

  return { overrides, vociScartate }
}
