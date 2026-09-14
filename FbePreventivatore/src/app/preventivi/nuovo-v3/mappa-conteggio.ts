import { CATALOGO_VOCI, voceInclusa, type ConfigurazioneVoci } from '@/domain/voci'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'
import type { StatoForm } from '../nuovo/stato-form'

const CATALOGO_PER_ID = new Map(CATALOGO_VOCI.map((voce) => [voce.id, voce]))

/**
 * Deriva `numeroPianiAbitativi` — il gate 'piani-abitativi-maggiore-di' di
 * src/domain/voci.ts (usato oggi solo da 'solaio-interpiano') — dal computo caricato,
 * non da un campo Geometria: nuovo-v3 non ne ha, i conteggi si ricavano esclusivamente
 * dal computo metrico. Se la categoria SOLAIO del Primus è valorizzata (l'importo della
 * voce 'solaio-interpiano' non è 'compresa'/zero), il fabbricato ha più di un piano
 * abitativo. Il computo non dice QUANTI piani in più, solo "più di uno": 2 è il valore
 * minimo che soddisfa `numeroPianiAbitativi > 1`, e nient'altro in questo wizard usa il
 * numero esatto (niente tabella superfici da mostrare in v3).
 *
 * `superficieGarage` non ha un equivalente: il Primus non ha una categoria "garage"
 * distinta da cui dedurne la presenza (voceInclusa la gate solo se
 * `superficieGarage > 0` — impossibile da derivare qui, resta sempre 0 in questo wizard).
 */
export function numeroPianiAbitativiDalComputo(voci: VoceConteggiata[]): number {
  const solaio = voci.find((v) => v.idMaster === 'solaio-interpiano')
  return solaio && typeof solaio.importo === 'number' && solaio.importo > 0 ? 2 : 1
}

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
