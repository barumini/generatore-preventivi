// Genera un codice provvisorio per il campo Protocollo quando il wizard v3 parte senza un
// protocollo FBE reale già noto. Il formato (BOZZA-<anno>-<5 cifre>) è riconosciuto da
// isProtocolloPlaceholder (src/ai/coerenza.ts): finché il codice resta in questo formato,
// l'avviso "placeholder di protocollo non sostituito" continua a comparire, esattamente come
// per il campo lasciato vuoto — nessun documento reale esce con un numero inventato.
export function generaProtocolloBozza(data: Date = new Date()): string {
  const anno = data.getFullYear()
  const progressivo = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, '0')
  return `BOZZA-${anno}-${progressivo}`
}
