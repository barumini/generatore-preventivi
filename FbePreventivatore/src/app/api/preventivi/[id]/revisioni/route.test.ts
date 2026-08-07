import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'
import { creaPreventivoConBozza } from '@/server/preventivi-repo'

vi.mock('@/server/prisma', () => ({ prisma: creaClientDiTest() }))

const { prisma: db } = await import('@/server/prisma')
const { POST } = await import('./route')

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

describe('POST /api/preventivi/[id]/revisioni', () => {
  it('aggiunge una nuova revisione numero 2 a un preventivo esistente', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const risposta = await POST(new Request(`http://localhost/api/preventivi/${preventivo.id}/revisioni`, { method: 'POST', body: JSON.stringify(CORPO_BASE) }), {
      params: Promise.resolve({ id: preventivo.id }),
    })
    expect(risposta.status).toBe(201)
    const corpo = await risposta.json()
    expect(corpo.numero).toBe(2)
  })

  it('risponde 404 se il preventivo non esiste', async () => {
    const risposta = await POST(new Request('http://localhost/api/preventivi/id-inesistente/revisioni', { method: 'POST', body: JSON.stringify(CORPO_BASE) }), {
      params: Promise.resolve({ id: 'id-inesistente' }),
    })
    expect(risposta.status).toBe(404)
  })
})
