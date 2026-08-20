import { describe, expect, it } from 'vitest'
import type { RisultatoImportazioneExcel } from '@/domain/importazione-excel'
import { statoFormDaImportazione } from './mappatura-importazione'

const RISULTATO_MINIMO: RisultatoImportazioneExcel = {
  serramenti: [{ n: 1, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 1, h: 1 }],
  pareti: [{ n: 1, tipo: 'E', b: 12.5, h: 2.7, spessore: 20 }],
  falde: [{ etichetta: 'Una falda', notazione: '5,8x16,5' }],
  travi: [{ etichetta: 'Colmo', notazione: '16,5x0,2x0,32' }],
  avvisi: ['un avviso'],
}

describe('statoFormDaImportazione', () => {
  it('riporta i serramenti importati nel parziale di StatoForm', () => {
    const parziale = statoFormDaImportazione(RISULTATO_MINIMO)
    expect(parziale.serramenti).toEqual(RISULTATO_MINIMO.serramenti)
  })

  it('riporta pareti, falde e travi come dati informativi non prezzati', () => {
    const parziale = statoFormDaImportazione(RISULTATO_MINIMO)
    expect(parziale.pareti).toEqual(RISULTATO_MINIMO.pareti)
    expect(parziale.falde).toEqual(RISULTATO_MINIMO.falde)
    expect(parziale.travi).toEqual(RISULTATO_MINIMO.travi)
  })

  it('non riporta gli avvisi nello StatoForm — restano transitori, mostrati solo nella schermata di import', () => {
    const parziale = statoFormDaImportazione(RISULTATO_MINIMO)
    expect(parziale).not.toHaveProperty('avvisi')
  })
})
