import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { creaClientDiTest, applicaMigrazioni } from './test-db'
import {
  creaPreventivoConBozza,
  aggiungiRevisione,
  aggiornaBozza,
  elencaPreventivi,
  caricaRevisione,
  RisorsaNonTrovata,
} from './preventivi-repo'

const DATI_BASE = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-07',
  luogo: 'Trissino',
  statoForm: JSON.stringify({ esempio: true }),
  inputCalcolo: JSON.stringify({ esempio: true }),
  risultatoCalcolo: JSON.stringify({ esempio: true }),
}

let db: PrismaClient

beforeEach(async () => {
  db = creaClientDiTest()
  await applicaMigrazioni(db)
})

afterEach(async () => {
  await db.$disconnect()
})

describe('creaPreventivoConBozza', () => {
  it('crea cliente, preventivo e la revisione numero 1 in stato bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    expect(preventivo.protocollo).toBe('2026059')
    expect(preventivo.revisioni).toHaveLength(1)
    expect(preventivo.revisioni[0].numero).toBe(1)
    expect(preventivo.revisioni[0].stato).toBe('bozza')
  })

  it('riusa un cliente esistente con stessi nome/comune/provincia invece di duplicarlo', async () => {
    await creaPreventivoConBozza(db, DATI_BASE)
    await creaPreventivoConBozza(db, { ...DATI_BASE, protocollo: '2026060' })
    const clienti = await db.cliente.findMany()
    expect(clienti).toHaveLength(1)
  })

  it('rifiuta un protocollo duplicato', async () => {
    await creaPreventivoConBozza(db, DATI_BASE)
    await expect(creaPreventivoConBozza(db, DATI_BASE)).rejects.toThrow(/protocollo/)
  })
})

describe('aggiungiRevisione', () => {
  it('aggiunge la revisione numero 2 senza toccare la numero 1', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    const nuova = await aggiungiRevisione(db, preventivo.id, DATI_BASE)
    expect(nuova.numero).toBe(2)
    expect(nuova.stato).toBe('bozza')
    const originale = await caricaRevisione(db, preventivo.id, 1)
    expect(originale?.stato).toBe('bozza')
  })

  it('lancia RisorsaNonTrovata se il preventivo non esiste', async () => {
    await expect(aggiungiRevisione(db, 'id-inesistente', DATI_BASE)).rejects.toThrow(RisorsaNonTrovata)
  })
})

describe('aggiornaBozza', () => {
  it('aggiorna lo statoForm di una revisione in bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await aggiornaBozza(db, preventivo.id, 1, { ...DATI_BASE, statoForm: JSON.stringify({ modificato: true }) })
    const aggiornata = await caricaRevisione(db, preventivo.id, 1)
    expect(aggiornata?.statoForm).toBe(JSON.stringify({ modificato: true }))
  })

  it('rifiuta di modificare una revisione non più in bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await db.revisione.update({
      where: { preventivoId_numero: { preventivoId: preventivo.id, numero: 1 } },
      data: { stato: 'firmata' },
    })
    await expect(aggiornaBozza(db, preventivo.id, 1, DATI_BASE)).rejects.toThrow(/non modificabile/)
  })

  it('lancia RisorsaNonTrovata se il numero di revisione non esiste', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await expect(aggiornaBozza(db, preventivo.id, 99, DATI_BASE)).rejects.toThrow(RisorsaNonTrovata)
  })

  it('aggiorna anche i campi anagrafici (cliente, protocollo, oggetto, data, luogo)', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    const datiAggiornati = {
      ...DATI_BASE,
      cliente: { nome: 'Bianchi Paolo', comune: 'Arzignano', provincia: 'VI' },
      protocollo: '2026099',
      oggetto: 'Fornitura e posa in opera di casa in legno MHM — variante',
      data: '2026-09-01',
      luogo: 'Arzignano',
    }
    await aggiornaBozza(db, preventivo.id, 1, datiAggiornati)

    const elenco = await elencaPreventivi(db)
    expect(elenco).toHaveLength(1)
    expect(elenco[0].protocollo).toBe('2026099')
    expect(elenco[0].cliente.nome).toBe('Bianchi Paolo')
    expect(elenco[0].cliente.comune).toBe('Arzignano')

    const rivista = await caricaRevisione(db, preventivo.id, 1)
    expect(rivista?.preventivo.protocollo).toBe('2026099')
    expect(rivista?.preventivo.oggetto).toBe('Fornitura e posa in opera di casa in legno MHM — variante')
    expect(rivista?.preventivo.cliente.nome).toBe('Bianchi Paolo')
    expect(rivista?.luogo).toBe('Arzignano')
    expect(rivista?.data.toISOString().slice(0, 10)).toBe('2026-09-01')
  })

  it('rifiuta un protocollo che coincide con quello di un altro preventivo esistente', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await creaPreventivoConBozza(db, { ...DATI_BASE, protocollo: '2026060' })
    await expect(aggiornaBozza(db, preventivo.id, 1, { ...DATI_BASE, protocollo: '2026060' })).rejects.toThrow(
      /protocollo/,
    )
  })

  it('non muta il cliente condiviso con un altro preventivo', async () => {
    const primo = await creaPreventivoConBozza(db, DATI_BASE)
    const secondo = await creaPreventivoConBozza(db, { ...DATI_BASE, protocollo: '2026060' })
    const clienti = await db.cliente.findMany()
    expect(clienti).toHaveLength(1) // condividono la stessa riga Cliente

    await aggiornaBozza(db, primo.id, 1, {
      ...DATI_BASE,
      cliente: { nome: 'Bianchi Paolo', comune: 'Arzignano', provincia: 'VI' },
    })

    const elenco = await elencaPreventivi(db)
    const voceSecondo = elenco.find((p) => p.id === secondo.id)
    expect(voceSecondo?.cliente.nome).toBe(DATI_BASE.cliente.nome)
    expect(voceSecondo?.cliente.comune).toBe(DATI_BASE.cliente.comune)

    const vocePrimo = elenco.find((p) => p.id === primo.id)
    expect(vocePrimo?.cliente.nome).toBe('Bianchi Paolo')
  })
})

describe('elencaPreventivi', () => {
  it('elenca i preventivi con l\'ultima revisione di ciascuno', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await aggiungiRevisione(db, preventivo.id, DATI_BASE)
    const elenco = await elencaPreventivi(db)
    expect(elenco).toHaveLength(1)
    expect(elenco[0].ultimaRevisione?.numero).toBe(2)
  })
})
