import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'

vi.mock('@/server/prisma', () => ({ prisma: creaClientDiTest() }))

const { prisma: db } = await import('@/server/prisma')
const { POST, GET, DELETE } = await import('./route')

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

describe('POST /api/preventivi', () => {
  it('crea un preventivo e risponde 201 con id e numero revisione', async () => {
    const risposta = await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    expect(risposta.status).toBe(201)
    const corpo = await risposta.json()
    expect(corpo.protocollo).toBe('2026059')
    expect(corpo.revisioni[0].numero).toBe(1)
  })

  it('risponde 409 su un protocollo duplicato', async () => {
    await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    const risposta = await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    expect(risposta.status).toBe(409)
  })
})

describe('GET /api/preventivi', () => {
  it('elenca i preventivi salvati', async () => {
    await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    const risposta = await GET()
    const corpo = await risposta.json()
    expect(corpo).toHaveLength(1)
    expect(corpo[0].protocollo).toBe('2026059')
  })
})

describe('DELETE /api/preventivi', () => {
  it('cancella i preventivi indicati e risponde 204', async () => {
    const creato = await POST(
      new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }),
    )
    const { id } = await creato.json()

    const risposta = await DELETE(
      new Request('http://localhost/api/preventivi', { method: 'DELETE', body: JSON.stringify({ ids: [id] }) }),
    )
    expect(risposta.status).toBe(204)

    const elenco = await (await GET()).json()
    expect(elenco).toHaveLength(0)
  })

  it('risponde 400 se ids non è un array di stringhe non vuoto', async () => {
    const risposta = await DELETE(
      new Request('http://localhost/api/preventivi', { method: 'DELETE', body: JSON.stringify({ ids: [] }) }),
    )
    expect(risposta.status).toBe(400)
  })
})
