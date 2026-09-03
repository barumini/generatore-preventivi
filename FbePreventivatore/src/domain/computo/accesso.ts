import type { Computo, VoceComputo } from './estrai-voci'

/**
 * Una tariffa non identifica una voce sola. In entrambi i computi analizzati
 * sette tariffe compaiono due volte, perché il computista apre più righe di
 * misurazione sullo stesso articolo di prezzario quando vuole tenere separate
 * quantità con destinazioni diverse — la falda dallo sporto, le pareti dalle
 * velette. Nemmeno la categoria disambigua: `104.02.021` ha una riga in
 * PARETI IN LEGNO e una in COPERTURA, entrambe con quantità.
 *
 * Perciò l'accesso restituisce sempre una lista, e ogni regola dichiara se
 * somma le occorrenze o ne vuole una precisa.
 */
export function vociPerTariffa(computo: Computo, tariffa: string): VoceComputo[] {
  return computo.voci.filter((voce) => voce.tariffa === tariffa)
}

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100
}

export function sommaTotali(computo: Computo, ...tariffe: string[]): number {
  const cercate = new Set(tariffe)
  return arrotonda(
    computo.voci
      .filter((voce) => voce.tariffa !== null && cercate.has(voce.tariffa))
      .reduce((somma, voce) => somma + (voce.totale ?? 0), 0),
  )
}

export function sommaQuantita(computo: Computo, ...tariffe: string[]): number {
  const cercate = new Set(tariffe)
  return arrotonda(
    computo.voci
      .filter((voce) => voce.tariffa !== null && cercate.has(voce.tariffa))
      .reduce((somma, voce) => somma + (voce.quantita ?? 0), 0),
  )
}

export class VoceNonUnivocaError extends Error {
  constructor(tariffa: string, filtro: RegExp | undefined, trovate: number) {
    const conFiltro = filtro ? ` con descrizione ${filtro}` : ''
    super(
      `Attesa una sola voce per la tariffa ${tariffa}${conFiltro}, trovate ${trovate} voci. ` +
        'Il computo non segue il template FBE atteso: verificarlo prima di fidarsi del conteggio.',
    )
    this.name = 'VoceNonUnivocaError'
  }
}

/**
 * Per le regole che puntano a una lavorazione precisa e non all'aggregato.
 * Solleva invece di scegliere: su un computo fuori standard è meglio fermarsi
 * che produrre in silenzio un importo sbagliato.
 */
export function voceUnica(
  computo: Computo,
  tariffa: string,
  filtroDescrizione?: RegExp,
): VoceComputo {
  const candidate = vociPerTariffa(computo, tariffa).filter(
    (voce) => !filtroDescrizione || filtroDescrizione.test(voce.descrizione),
  )
  if (candidate.length !== 1) {
    throw new VoceNonUnivocaError(tariffa, filtroDescrizione, candidate.length)
  }
  return candidate[0]
}
