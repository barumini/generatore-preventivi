import { numeroIt, quantitaIt } from '@/domain/computo/formatta-numero'

/** Formato importi FBE: spazio per le migliaia, virgola decimale (CLAUDE.md). */
export function formattaEuro(valore: number): string {
  return `${numeroIt(valore)} €`
}

export function formattaQuantita(valore: number, unita: string): string {
  return `${quantitaIt(valore)} ${unita}`
}

/**
 * Legge un importo scritto a mano nella convenzione italiana: la virgola è il
 * separatore decimale, punti e spazi separano le migliaia. Restituisce `null`
 * per tutto ciò che non riconosce, invece di indovinare.
 *
 * Indovinare è il difetto che questa funzione sostituisce: `parseFloat` su
 * "13.200,00" si fermava al secondo punto e restituiva 13,2 — tredicimiladuecento
 * che diventa tredici euro e venti, senza che nulla lo segnalasse.
 */
export function importoDaTesto(testo: string): number | null {
  // Normalizza gli spazi che un copia-incolla può portare: spazio normale,
  // U+00A0 (non-breaking) e U+202F (narrow no-break) diventano lo spazio semplice
  // che le regex sotto riconoscono come separatore delle migliaia. Scritti come
  // escape \u, non come caratteri invisibili in sorgente.
  const pulito = testo.replace(/[ \u00a0\u202f]/g, ' ').trim()
  if (pulito === '') return null

  const raggruppato = /^-?\d{1,3}(?:[ .]\d{3})*(?:,\d{1,2})?$/
  const semplice = /^-?\d+(?:,\d{1,2})?$/
  if (!raggruppato.test(pulito) && !semplice.test(pulito)) return null

  const normalizzato = pulito.replace(/[ .]/g, '').replace(',', '.')
  const valore = Number.parseFloat(normalizzato)
  return Number.isFinite(valore) ? valore : null
}
