import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'
import { creaPreventivoConBozza } from '@/server/preventivi-repo'

vi.mock('@/server/prisma', () => ({ prisma: creaClientDiTest() }))

const { prisma: db } = await import('@/server/prisma')
const { GET, PUT } = await import('./route')

beforeAll(async () => {
  await applicaMigrazioni(db)
})

beforeEach(async () => {
  await db.revisione.deleteMany()
  await db.preventivo.deleteMany()
  await db.cliente.deleteMany()
})

const CORPO_BASE = {
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

describe('GET /api/preventivi/[id]/revisioni/[numero]', () => {
  it('carica la revisione richiesta', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const risposta = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(200)
    const corpo = await risposta.json()
    expect(corpo.numero).toBe(1)
  })

  it('risponde 404 se la revisione non esiste', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const risposta = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: preventivo.id, numero: '99' }),
    })
    expect(risposta.status).toBe(404)
  })
})

describe('PUT /api/preventivi/[id]/revisioni/[numero]', () => {
  it('aggiorna una bozza esistente', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const nuovoStatoForm = JSON.stringify({ modificato: true })
    const risposta = await PUT(
      new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ ...CORPO_BASE, statoForm: nuovoStatoForm }) }),
      { params: Promise.resolve({ id: preventivo.id, numero: '1' }) },
    )
    expect(risposta.status).toBe(200)
    const corpo = await risposta.json()
    expect(corpo.statoForm).toBe(nuovoStatoForm)
  })

  it('risponde 409 su una revisione non in bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    await db.revisione.update({
      where: { preventivoId_numero: { preventivoId: preventivo.id, numero: 1 } },
      data: { stato: 'firmata' },
    })
    const risposta = await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(CORPO_BASE) }), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(409)
  })

  it('risponde 404 su una revisione inesistente', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const risposta = await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(CORPO_BASE) }), {
      params: Promise.resolve({ id: preventivo.id, numero: '99' }),
    })
    expect(risposta.status).toBe(404)
  })
})
