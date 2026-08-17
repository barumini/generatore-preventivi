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
  it('elenca i campi mancanti separati da virgola quando ce ne sono', () => {
    expect(messaggioAssistente(['progettista', 'comune'])).toBe(
      'Ho capito quasi tutto — mi manca ancora: progettista, comune.',
    )
  })

  it('conferma il completamento quando non manca nulla', () => {
    expect(messaggioAssistente([])).toBe('Perfetto, ho tutto quello che serve.')
  })
})
