// src/app/preventivi/nuovo/conversazione-apertura.ts
export interface Messaggio {
  ruolo: 'utente' | 'assistente'
  testo: string
  errore?: boolean
}

// Solo i turni utente alimentano l'estrazione: i messaggi assistente sono feedback
// sintetizzato in locale (non generato dal modello) — rimandarli come input
// confonderebbe l'estrazione con la sua stessa risposta precedente.
export function testoCumulativo(cronologia: Messaggio[]): string {
  return cronologia
    .filter((messaggio) => messaggio.ruolo === 'utente')
    .map((messaggio) => messaggio.testo)
    .join('\n')
}

export function messaggioAssistente(campiMancanti: string[]): string {
  return campiMancanti.length > 0
    ? `Ho capito quasi tutto — mi manca ancora: ${campiMancanti.join(', ')}.`
    : 'Perfetto, ho tutto quello che serve.'
}
