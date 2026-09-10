import { CATALOGO_VOCI, voceInclusa, type ConfigurazioneVoci } from '@/domain/voci'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'
import type { StatoForm } from '../nuovo/stato-form'

const CATALOGO_PER_ID = new Map(CATALOGO_VOCI.map((voce) => [voce.id, voce]))

export interface EsitoMappaConteggio {
  overrides: StatoForm['overrides']
  vociScartate: string[]
  vociEscluseDallaConfigurazione: string[]
}

/**
 * Traduce il risultato del conteggio in override del wizard. Il merge parte sempre da
 * `overridesAttuali`: una voce del conteggio non prevale mai su un override esistente
 * per una voce diversa (es. `garage`, digitato a mano in StepPrezzi), e un conteggio
 * più recente sovrascrive solo le chiavi che tocca lui stesso.
 *
 * Una voce del catalogo esclusa dalla configurazione corrente (es. cappotto con
 * involucro "impoverito") non entra in `overrides`: scriverla comunque farebbe
 * apparire, nella somma di controllo di questo step, un importo che eseguiCalcolo non
 * mostrerebbe comunque — disallineando in silenzio i due numeri.
 * `vociEscluseDallaConfigurazione` esiste perché l'utente deve saperlo.
 */
export function mappaConteggioAOverride(
  voci: VoceConteggiata[],
  overridesAttuali: StatoForm['overrides'],
  configurazione: ConfigurazioneVoci,
): EsitoMappaConteggio {
  const overrides = { ...overridesAttuali }
  const vociScartate: string[] = []
  const vociEscluseDallaConfigurazione: string[] = []

  for (const voce of voci) {
    const voceCatalogo = CATALOGO_PER_ID.get(voce.idMaster)
    if (!voceCatalogo) {
      vociScartate.push(voce.idMaster)
      continue
    }
    if (!voceInclusa(voceCatalogo, configurazione)) {
      vociEscluseDallaConfigurazione.push(voce.idMaster)
      continue
    }
    overrides[voce.idMaster] = voce.importo === 'compresa' ? 'comprese' : voce.importo
  }

  return { overrides, vociScartate, vociEscluseDallaConfigurazione }
}
