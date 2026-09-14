import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'
import { creaPreventivoConBozza } from '@/server/preventivi-repo'
import { serializzaRevisione } from '@/domain/persistenza'
import { eseguiCalcolo } from '@/domain/calcolo'
import { inputCalcoloDaStato, type StatoForm } from '@/app/preventivi/nuovo/stato-form'
import { CONDIZIONI_DEFAULT } from '@/documento/condizioni-default'

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

// `struttura`/`involucro` a 'impoverito'/'escluso' esclude dal calcolo pareti-mhm e
// copertura-falda/cappotto — le uniche voci del catalogo con placeholder di spessore
// ({{spessoreEsterno}} ecc., cfr. template/PLACEHOLDER.md) non interpolati. Non è una
// combinazione raggiungibile dai tre pacchetti UI (`pacchettoDaLivelli` fissa sempre
// struttura a 'completo'), ma qui serve solo a isolare un caso senza quel problema NOTO
// e separato (già coperto dai suoi test dedicati in export-docx.test.ts) — questo test
// verifica la route (200/404/422), non il contenuto del documento.
const STATO_SENZA_PLACEHOLDER: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-05',
  luogo: 'Castelgomberto',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [],
  perimetro: 60,
  livelli: { struttura: 'impoverito', involucro: 'escluso', finiture: 'escluso' },
  chiaviInManoNelTotale: false,
  overrides: {},
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  totaleTarget: 100000,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
    spessoreEsterno: '',
    spessoreInterno: '',
    spessoreCoibente: '',
    spessoreCappotto: '',
  },
  condizioni: {
    ...CONDIZIONI_DEFAULT,
    consegna: 'da pattuire',
    caparra: 30000,
    validita: '31.08.2026',
    // review finale piano export-docx-wizard (Finding 2): senza una riga optional marcata come
    // pratica Genio Civile, costruisciBufferOfferta ora si rifiuta di esportare (nuovo
    // guardrail) — questa fixture testa la route (200/404/422), non quel guardrail specifico
    // (già coperto da export-docx.test.ts), quindi serve una riga marcata per non regredire.
    optional: [{ descrizione: 'Pratica Genio Civile di test', importo: 100, praticaGenioCivile: true }],
  },
}

function corpoBozza(stato: StatoForm) {
  const input = inputCalcoloDaStato(stato)
  const risultato = eseguiCalcolo(input)
  return {
    cliente: stato.cliente,
    protocollo: stato.protocollo,
    oggetto: stato.oggetto,
    progettista: stato.progettista,
    data: stato.data,
    luogo: stato.luogo,
    ...serializzaRevisione(stato, input, risultato),
  }
}

describe('POST /api/preventivi/[id]/revisioni/[numero]/export', () => {
  it('risponde 200 con il .docx e un Content-Disposition coerente col protocollo/revisione', async () => {
    const preventivo = await creaPreventivoConBozza(db, corpoBozza(STATO_SENZA_PLACEHOLDER))
    const risposta = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(200)
    expect(risposta.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    expect(risposta.headers.get('Content-Disposition')).toBe('attachment; filename="2026059-rev00.docx"')
    const buffer = Buffer.from(await risposta.arrayBuffer())
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('valorizza documentoGeneratoAt sulla revisione dopo un export riuscito', async () => {
    const preventivo = await creaPreventivoConBozza(db, corpoBozza(STATO_SENZA_PLACEHOLDER))
    await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    const revisione = await db.revisione.findUnique({
      where: { preventivoId_numero: { preventivoId: preventivo.id, numero: 1 } },
    })
    expect(revisione?.documentoGeneratoAt).not.toBeNull()
  })

  it('risponde 404 se la revisione non esiste', async () => {
    const preventivo = await creaPreventivoConBozza(db, corpoBozza(STATO_SENZA_PLACEHOLDER))
    const risposta = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: preventivo.id, numero: '99' }),
    })
    expect(risposta.status).toBe(404)
  })

  it('risponde 200 anche con placeholder di spessore non interpolati (spessori opzionali)', async () => {
    // struttura: 'completo' reintroduce pareti-mhm — e col suo {{spessoreEsterno}}/
    // {{spessoreInterno}} mai interpolato (limite noto e separato, non risolto da questo
    // piano). Gli spessori sono opzionali nell'export: un token non interpolato resta
    // testuale nel documento invece di bloccare la generazione.
    const statoConPlaceholder: StatoForm = {
      ...STATO_SENZA_PLACEHOLDER,
      livelli: { struttura: 'completo', involucro: 'escluso', finiture: 'escluso' },
    }
    const preventivo = await creaPreventivoConBozza(db, corpoBozza(statoConPlaceholder))
    const risposta = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(200)
  })
})
