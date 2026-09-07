import { describe, expect, it } from 'vitest'
import { pulisciDescrizione } from './pulisci-descrizione'

describe('pulisciDescrizione', () => {
  it('taglia alla prima quantità con virgola decimale, anche sotto la lunghezza massima', () => {
    // 106.01.02 in Dacroce: la quantità di riga è appesa direttamente alla
    // descrizione, senza "Vedi voce". A 46 caratteri non scatterebbe mai il
    // troncamento a lunghezza fissa: senza taglio al marcatore la cifra di
    // misura resterebbe nell'etichetta.
    expect(pulisciDescrizione('GUAINA TAGLIAMURO H 28 - Parete da 20.5 82,20')).toBe(
      'GUAINA TAGLIAMURO H 28 - Parete da 20.5',
    )
  })

  it('non scambia un codice parete ("20.5", punto) per una misura di riga (virgola)', () => {
    expect(pulisciDescrizione('GUAINA TAGLIAMURO H 28 - Parte da 25.0')).toBe(
      'GUAINA TAGLIAMURO H 28 - Parte da 25.0',
    )
  })

  it('taglia a "Vedi voce", che introduce sempre un riporto di quantità da un\'altra riga', () => {
    // 104.01.021 in Dacroce: senza taglio al marcatore, slice(0, 60) tronca a
    // metà della prima ripetizione ("...Vedi voce n° 5 [m 0.00] 1,0").
    expect(
      pulisciDescrizione(
        'Ferramenta per fissaggio cordoli Vedi voce n° 5 [m 0.00] 1,00 Vedi voce n° 6 [m 82.20] 1,00 82,20',
      ),
    ).toBe('Ferramenta per fissaggio cordoli')
  })

  it('dopo il taglio al marcatore, accorcia su un confine di parola se resta troppo lunga', () => {
    // 109.04.13 in Dacroce: senza il taglio a confine di parola, slice(0, 60)
    // spezzerebbe "Hella" a metà.
    const risultato = pulisciDescrizione(
      'Monoblocchi 4 lati, lisci per posa portefinestre - CADAUNO ditta Hella ' +
        'Vedi voce n° 147 [cadauno 2.00] 1,00 2,00',
    )
    expect(risultato).toBe('Monoblocchi 4 lati, lisci per posa portefinestre - CADAUNO')
    expect(risultato.length).toBeLessThanOrEqual(60)
    expect(risultato.endsWith('Hella')).toBe(false)
  })

  it('non tronca mai a metà parola, con o senza marcatore', () => {
    // 104.01.023 in Dacroce: slice(0, 60) grezzo taglierebbe "Vedi voce" in
    // "Vedi voc". Il taglio al marcatore la rimuove per intero, ben sotto 60.
    expect(
      pulisciDescrizione(
        'Utilità SPESSORI DI PLASTICA (3 piastre ogni 60 cm) Vedi voce n° 10 [m 149.30] 1,00 149,30',
      ),
    ).toBe('Utilità SPESSORI DI PLASTICA (3 piastre ogni 60 cm)')
  })

  it('lascia intatta una descrizione senza marcatori e sotto la lunghezza massima', () => {
    expect(pulisciDescrizione('Cartongesso interno a placcatura diretta')).toBe(
      'Cartongesso interno a placcatura diretta',
    )
  })

  it('rispetta una lunghezza massima diversa dal default', () => {
    expect(pulisciDescrizione('Ferramenta per fissaggio cordoli', 20)).toBe('Ferramenta per')
  })

  it('non va in negativo su una singola parola più lunga della lunghezza massima', () => {
    expect(pulisciDescrizione('Supercalifragilistichespiralidoso', 10)).toBe('Supercalif')
  })
})
