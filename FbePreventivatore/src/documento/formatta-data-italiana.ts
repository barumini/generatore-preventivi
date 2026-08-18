const MESI_ITALIANI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
] as const

/**
 * Split manuale invece di `new Date(dataIso)`: un ISO date-only interpretato come
 * UTC e poi letto con getDate()/getMonth() in un fuso orario diverso da UTC può
 * restituire il giorno prima — un bug di fuso invisibile finché qualcuno non lo
 * genera vicino a mezzanotte in un fuso a ovest di Greenwich.
 */
export function formattaDataItaliana(dataIso: string, luogo: string): string {
  const [anno, mese, giorno] = dataIso.split('-').map(Number)
  return `${luogo}, ${giorno} ${MESI_ITALIANI[mese - 1]} ${anno}`
}
