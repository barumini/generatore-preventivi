import { describe, expect, it } from 'vitest'
import { messaggioAssistente, testoCumulativo, type Messaggio } from './conversazione-apertura'

describe('testoCumulativo', () => {
  it('concatena solo i messaggi utente, in ordine, ignorando quelli assistente', () => {
    const cronologia: Messaggio[] = [
      { ruolo: 'utente', testo: 'casa per Rossi' },
      { ruolo: 'assistente', testo: 'Ho capito quasi tutto — mi manca ancora: progettista.' },
      { ruolo: 'utente', testo: 'il progettista è Mario Rossi' },
    ]

    expect(testoCumulativo(cronologia)).toBe('casa per Rossi\nil progettista è Mario Rossi')
  })

  it('restituisce stringa vuota su cronologia vuota', () => {
    expect(testoCumulativo([])).toBe('')
  })
})

describe('messaggioAssistente', () => {
  it('elenca i campi mancanti con etichette leggibili, nell\'ordine ricevuto', () => {
    expect(messaggioAssistente(['cliente.comune', 'progettista', 'tipoCopertura', 'spessoreCappotto'])).toBe(
      'Ho capito quasi tutto — mi manca ancora: comune, progettista, tipo di copertura, spessore cappotto.',
    )
  })

  it('ha un\'etichetta leggibile per ogni campo che l\'estrazione può segnalare', () => {
    const tutti = [
      'cliente.nome',
      'cliente.comune',
      'cliente.provincia',
      'protocollo',
      'progettista',
      'tipoCopertura',
      'finituraEsterna',
      'pacchetto',
      'spessoreEsterno',
      'spessoreInterno',
      'spessoreCoibente',
      'spessoreCappotto',
      'superfici',
    ]

    expect(messaggioAssistente(tutti)).toBe(
      'Ho capito quasi tutto — mi manca ancora: nome del cliente, comune, provincia, protocollo, progettista, ' +
        'tipo di copertura, finitura esterna, pacchetto, spessore esterno, spessore interno, spessore coibente, ' +
        'spessore cappotto, superfici dei piani.',
    )
  })

  it('tratta un id non riconosciuto come un piano da correggere', () => {
    expect(messaggioAssistente(['protocollo', 'Cantina'])).toBe(
      'Ho capito quasi tutto — mi manca ancora: protocollo, piano "Cantina" da correggere.',
    )
  })

  it('non chiede mai il luogo: si deduce dal comune del cliente', () => {
    expect(messaggioAssistente(['luogo', 'protocollo'])).toBe('Ho capito quasi tutto — mi manca ancora: protocollo.')
    expect(messaggioAssistente(['luogo'])).toBe('Perfetto, ho tutto quello che serve.')
  })

  it('conferma il completamento quando non manca nulla', () => {
    expect(messaggioAssistente([])).toBe('Perfetto, ho tutto quello che serve.')
  })
})
