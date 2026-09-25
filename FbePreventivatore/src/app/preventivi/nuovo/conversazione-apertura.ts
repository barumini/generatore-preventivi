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

// Gli id di campiMancanti sono quelli calcolati da normalizzaEstrazione
// (src/ai/normalizzazione-estrazione.ts). Ogni altro valore è il nome di un piano che non
// corrisponde a nessun piano canonico: va corretto a mano nel form.
const ETICHETTE_CAMPI: Record<string, string> = {
  'cliente.nome': 'nome del cliente',
  'cliente.comune': 'comune',
  'cliente.provincia': 'provincia',
  protocollo: 'protocollo',
  progettista: 'progettista',
  tipoCopertura: 'tipo di copertura',
  finituraEsterna: 'finitura esterna',
  pacchetto: 'pacchetto',
  spessoreEsterno: 'spessore esterno',
  spessoreInterno: 'spessore interno',
  spessoreCoibente: 'spessore coibente',
  spessoreCappotto: 'spessore cappotto',
  superfici: 'superfici dei piani',
}

function etichetta(campo: string): string {
  return Object.hasOwn(ETICHETTE_CAMPI, campo) ? ETICHETTE_CAMPI[campo] : `piano "${campo}" da correggere`
}

// "luogo" non si chiede mai: si deduce dal comune del cliente (mappatura-estrazione.ts).
export function messaggioAssistente(campiMancanti: string[]): string {
  const daChiedere = campiMancanti.filter((campo) => campo !== 'luogo').map(etichetta)
  return daChiedere.length > 0
    ? `Ho capito quasi tutto — mi manca ancora: ${daChiedere.join(', ')}.`
    : 'Perfetto, ho tutto quello che serve.'
}
