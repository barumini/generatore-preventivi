/**
 * Un marcatore di misurazione segna il punto da cui, in una descrizione letta
 * dal computo, comincia rumore invece di testo descrittivo: o "Vedi voce",
 * che Primus usa per riportare la quantità di un'altra riga, o un numero con
 * la virgola decimale — la quantità della riga stessa (es. "82,20"). Da lì in
 * poi la descrizione porta cifre di misurazione: troncarle a metà le fa
 * sembrare dati letti apposta, quando sono un artefatto del formato del
 * computo. Solo la virgola conta: "20.5" (un diametro, un codice parete) non
 * è una misura di riga e resta nell'etichetta.
 */
const MARCATORE_MISURAZIONE = /\bVedi voce\b|\d+,\d+/

const LUNGHEZZA_MASSIMA_DEFAULT = 60

/**
 * Riduce la descrizione di una voce del computo a un'etichetta leggibile per
 * la scheda dei passaggi: taglia via tutto da un marcatore di misurazione in
 * poi, poi — se resta comunque troppo lunga — accorcia su un confine di
 * parola invece che a metà.
 */
export function pulisciDescrizione(
  descrizione: string,
  lunghezzaMassima = LUNGHEZZA_MASSIMA_DEFAULT,
): string {
  const marcatore = descrizione.match(MARCATORE_MISURAZIONE)
  const senzaMisure = (marcatore ? descrizione.slice(0, marcatore.index) : descrizione).trim()
  if (senzaMisure.length <= lunghezzaMassima) return senzaMisure

  const troncata = senzaMisure.slice(0, lunghezzaMassima)
  const confine = troncata.lastIndexOf(' ')
  return (confine > 0 ? troncata.slice(0, confine) : troncata).trim()
}
