import { describe, expect, it, vi } from 'vitest'
import { estraiComputo } from './estrai-voci'
import { eseguiConteggio, COSTI_SICUREZZA_FORFETTARI } from './conteggio'
import { regolaParetiBase } from './regole-conteggio'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

// Solo per il test del guardrail 'pareggio-non-applicato' più in fondo al file:
// wrappa regolaParetiBase in uno spy che di default chiama l'implementazione
// vera. Un singolo test accoda un mockReturnValueOnce per simulare, senza
// toccare regole-conteggio.ts, un futuro in cui la regola restituisse
// 'compresa' come già fa regolaSolaio. Tutti gli altri test — inclusi i golden
// case che chiamano eseguiConteggio a livello di describe, prima che quel test
// venga eseguito — passano per lo spy senza notarne la presenza.
vi.mock('./regole-conteggio', async (importOriginal) => {
  const reali = await importOriginal<typeof import('./regole-conteggio')>()
  return { ...reali, regolaParetiBase: vi.fn(reali.regolaParetiBase) }
})

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])

function importo(risultato: ReturnType<typeof eseguiConteggio>, idMaster: string) {
  return risultato.voci.find((v) => v.idMaster === idMaster)!.importo
}

describe('eseguiConteggio — golden case Dacroce rev.03', () => {
  const esito = eseguiConteggio(dacroce)

  it('riconcilia sul totale del computo meno la sicurezza forfettaria', () => {
    expect(esito.sommaVoci).toBe(278_787.93)
    expect(esito.target).toBe(300_343.58)
    expect(esito.delta).toBe(21_555.65)
  })

  it('carica il delta sulle pareti strutturali', () => {
    expect(importo(esito, 'pareti-mhm')).toBe(127_543.28)
  })

  it('produce gli importi attesi per ogni voce', () => {
    expect(importo(esito, 'trave-larice')).toBe(10_104.24)
    expect(importo(esito, 'solaio-interpiano')).toBe(15_240.96)
    expect(importo(esito, 'copertura-falda')).toBe(54_474.19)
    expect(importo(esito, 'cappotto')).toBe(21_624.51)
    expect(importo(esito, 'cartongesso-q2')).toBe(18_975.90)
    expect(importo(esito, 'assistenza-cartongessisti')).toBe(2_655.50)
    expect(importo(esito, 'infissi-pvc')).toBe(31_230)
    expect(importo(esito, 'monoblocchi')).toBe(14_495)
    expect(importo(esito, 'progettazione-esecutiva')).toBe(4_000)
  })

  it('atterra esattamente sul target', () => {
    const somma = esito.voci.reduce(
      (t, v) => t + (typeof v.importo === 'number' ? v.importo : 0),
      0,
    )
    expect(Math.round(somma * 100) / 100).toBe(esito.target)
  })
})

describe('eseguiConteggio — golden case Crivellaro rev.04', () => {
  const esito = eseguiConteggio(crivellaro)

  it('riconcilia sul totale del computo', () => {
    expect(esito.sommaVoci).toBe(215_815.97)
    expect(esito.target).toBe(236_960.99)
    expect(esito.delta).toBe(21_145.02)
    expect(importo(esito, 'pareti-mhm')).toBe(100_645.84)
  })

  it("mostra il solaio come 'compresa' quando la categoria vale zero", () => {
    expect(importo(esito, 'solaio-interpiano')).toBe('compresa')
  })

  it('produce gli importi attesi per ogni voce', () => {
    expect(importo(esito, 'trave-larice')).toBe(5_843.70)
    expect(importo(esito, 'copertura-falda')).toBe(58_849.06)
    expect(importo(esito, 'cappotto')).toBe(21_253.32)
    expect(importo(esito, 'cartongesso-q2')).toBe(15_506.77)
    expect(importo(esito, 'assistenza-cartongessisti')).toBe(2_162.30)
    expect(importo(esito, 'infissi-pvc')).toBe(19_250)
    expect(importo(esito, 'monoblocchi')).toBe(9_450)
  })
})

describe('ordine e struttura', () => {
  it('elenca le voci nell’ordine di Conteggi Master', () => {
    expect(eseguiConteggio(dacroce).voci.map((v) => v.idMaster)).toEqual([
      'pareti-mhm',
      'tracciamento-impianti',
      'pareti-telaio',
      'trave-larice',
      'solaio-interpiano',
      'copertura-falda',
      'copertura-piana',
      'cappotto',
      'cartongesso-q2',
      'assistenza-cartongessisti',
      'infissi-pvc',
      'monoblocchi',
      'progettazione-esecutiva',
    ])
  })
})

describe('avvisi', () => {
  it('segnala che la sicurezza del computo differisce dalla forfettaria', () => {
    // entrambi i computi hanno M:001.020 = 23.352,50 contro i 23.300 forfettari
    expect(COSTI_SICUREZZA_FORFETTARI).toBe(23_300)
    const avviso = eseguiConteggio(dacroce).avvisi.find((a) => a.codice === 'sicurezza-diversa')
    expect(avviso).toBeDefined()
    expect(avviso!.livello).toBe('avviso')
    expect(avviso!.messaggio).toContain('23 352,50')
  })

  it('non segnala nulla di grave sui due computi reali', () => {
    for (const computo of [dacroce, crivellaro]) {
      expect(eseguiConteggio(computo).avvisi.filter((a) => a.livello === 'errore')).toEqual([])
    }
  })

  it('segnala un delta negativo, che è legittimo ma anomalo', () => {
    const gonfiato = {
      ...dacroce,
      riepilogo: {
        ...dacroce.riepilogo,
        'M:001.005': { nome: 'CARTONGESSO', importo: 900_000 },
      },
    }
    const esito = eseguiConteggio(gonfiato)
    expect(esito.delta).toBeLessThan(0)
    expect(esito.avvisi.some((a) => a.codice === 'delta-negativo')).toBe(true)
  })
})

describe('override manuale', () => {
  it('sostituisce l’importo e ne cambia la provenienza', () => {
    const esito = eseguiConteggio(dacroce, { monoblocchi: 13_200 })
    const voce = esito.voci.find((v) => v.idMaster === 'monoblocchi')!
    expect(voce.importo).toBe(13_200)
    expect(voce.provenienza).toBe('manuale')
  })

  it('ricalcola il pareggio: il delta assorbe la correzione', () => {
    const base = eseguiConteggio(dacroce)
    const corretto = eseguiConteggio(dacroce, { monoblocchi: 13_200 })
    expect(corretto.delta).toBe(Math.round((base.delta + 1_295) * 100) / 100)
    expect(corretto.target).toBe(base.target)
  })
})

describe('trasparenza del pareggio', () => {
  const esito = eseguiConteggio(dacroce)
  const pareti = esito.voci.find((v) => v.idMaster === 'pareti-mhm')!

  it('dichiara il delta fra i passaggi delle pareti', () => {
    const pareggio = pareti.passaggi.find((p) => p.etichetta.startsWith('pareggio:'))
    expect(pareggio).toBeDefined()
    expect(pareggio!.valore).toBe(21_555.65)
    expect(pareggio!.etichetta).toContain('300 343,58')
    expect(pareggio!.etichetta).toContain('278 787,93')
  })

  it('la formula delle pareti ricostruisce l’importo finale', () => {
    expect(pareti.formula).toBe('105 987,63 + 21 555,65 di pareggio = 127 543,28 €')
  })

  it('ogni voce con importo numerico ha una formula non vuota', () => {
    for (const voce of esito.voci) {
      expect(voce.formula.length).toBeGreaterThan(0)
      expect(voce.formula).not.toMatch(/M:001\.\d{3}/)
    }
  })
})

describe('override manuale — casi limite (round 1 di correzione)', () => {
  it('ignora un override non finito e segnala un errore', () => {
    const esito = eseguiConteggio(dacroce, { monoblocchi: NaN })

    expect(importo(esito, 'monoblocchi')).toBe(14_495)
    const voce = esito.voci.find((v) => v.idMaster === 'monoblocchi')!
    expect(voce.provenienza).toBe('calcolato')

    const avviso = esito.avvisi.find((a) => a.codice === 'override-non-finito')
    expect(avviso).toBeDefined()
    expect(avviso!.livello).toBe('errore')
    expect(avviso!.messaggio).toContain('monoblocchi')
    expect(avviso!.messaggio).toContain('NaN')

    // Il bug originale: NaN è 'number' per typeof, e si propagava senza avviso.
    expect(Number.isFinite(esito.sommaVoci)).toBe(true)
    expect(Number.isFinite(esito.delta)).toBe(true)
    expect(Number.isFinite(importo(esito, 'pareti-mhm') as number)).toBe(true)
  })

  it('rifiuta un override sulle pareti e segnala un avviso', () => {
    const esito = eseguiConteggio(dacroce, { 'pareti-mhm': 50_000 })

    expect(importo(esito, 'pareti-mhm')).toBe(127_543.28)
    const voce = esito.voci.find((v) => v.idMaster === 'pareti-mhm')!
    expect(voce.provenienza).toBe('calcolato')

    const avviso = esito.avvisi.find((a) => a.codice === 'override-pareti-rifiutato')
    expect(avviso).toBeDefined()
    expect(avviso!.livello).toBe('avviso')
    expect(avviso!.messaggio).toContain('pareti')
  })

  it('riscrive la formula con la correzione manuale, mantenendo i passaggi', () => {
    const base = eseguiConteggio(dacroce).voci.find((v) => v.idMaster === 'monoblocchi')!
    const corretto = eseguiConteggio(dacroce, { monoblocchi: 13_200 }).voci.find(
      (v) => v.idMaster === 'monoblocchi',
    )!

    expect(corretto.formula).toBe('corretto a mano: 13 200,00 € — il calcolo dava 14 495,00 €')
    expect(corretto.passaggi).toHaveLength(3)
    // I passaggi sono le sorgenti lette dal computo: l'override cambia il
    // risultato, non le sorgenti che lo giustificavano prima della correzione.
    expect(corretto.passaggi).toEqual(base.passaggi)
  })

  it('segnala un override che non corrisponde a nessuna voce', () => {
    const esito = eseguiConteggio(dacroce, { 'voce-che-non-esiste': 999 })

    const avviso = esito.avvisi.find((a) => a.codice === 'override-voce-sconosciuta')
    expect(avviso).toBeDefined()
    expect(avviso!.livello).toBe('avviso')
    expect(avviso!.messaggio).toContain('voce-che-non-esiste')

    // Nessun altro effetto: né sul target, né sul delta.
    const base = eseguiConteggio(dacroce)
    expect(esito.target).toBe(base.target)
    expect(esito.delta).toBe(base.delta)
  })

  it('con un override valido su una voce diversa dalle pareti la somma atterra ancora sul target', () => {
    const esito = eseguiConteggio(dacroce, { monoblocchi: 13_200 })
    const somma = esito.voci.reduce(
      (t, v) => t + (typeof v.importo === 'number' ? v.importo : 0),
      0,
    )
    expect(Math.round(somma * 100) / 100).toBe(esito.target)
  })
})

describe('override manuale — casi limite (round 2 di correzione)', () => {
  it('ignora un override finito che va in overflow dopo l’arrotondamento e segnala un errore', () => {
    // Number.isFinite(Number.MAX_VALUE) è true, ma arrotondaCentesimi lo
    // moltiplica per 100 prima di dividere: l'overflow arriva lì, non prima.
    const esito = eseguiConteggio(dacroce, { monoblocchi: Number.MAX_VALUE })

    expect(importo(esito, 'monoblocchi')).toBe(14_495)
    const voce = esito.voci.find((v) => v.idMaster === 'monoblocchi')!
    expect(voce.provenienza).toBe('calcolato')

    const avviso = esito.avvisi.find((a) => a.codice === 'override-non-finito')
    expect(avviso).toBeDefined()
    expect(avviso!.livello).toBe('errore')
    expect(avviso!.messaggio).toContain('monoblocchi')

    // Il golden case resta intatto: l'override astronomico è stato ignorato
    // per intero, non solo azzerato dopo aver già corrotto la somma.
    expect(esito.sommaVoci).toBe(278_787.93)
    expect(esito.target).toBe(300_343.58)
    expect(esito.delta).toBe(21_555.65)
    expect(importo(esito, 'pareti-mhm')).toBe(127_543.28)
  })

  it("riscrive la formula per un override su una voce che parte da 'compresa'", () => {
    // copertura-piana, tracciamento-impianti e pareti-telaio restituiscono
    // sempre 'compresa'; solaio-interpiano lo fa quando la categoria vale
    // zero (il caso Crivellaro). Qui uso copertura-piana su Dacroce.
    const esito = eseguiConteggio(dacroce, { 'copertura-piana': 5_000 })
    const voce = esito.voci.find((v) => v.idMaster === 'copertura-piana')!

    expect(voce.formula).toBe('corretto a mano: 5 000,00 € — il calcolo dava «compresa»')
    expect(voce.importo).toBe(5_000)
    expect(voce.provenienza).toBe('manuale')
  })
})

describe('guardrail: pareggio non applicabile', () => {
  it('segnala un errore se le pareti non hanno un importo numerico', () => {
    vi.mocked(regolaParetiBase).mockReturnValueOnce({
      idMaster: 'pareti-mhm',
      descrizione: 'Pareti strutturali in legno "M.H.M."',
      passaggi: [],
      formula: 'simulazione guardrail: regola ipotetica che restituisce compresa',
      importo: 'compresa',
      provenienza: 'calcolato',
    })

    const esito = eseguiConteggio(dacroce)

    expect(importo(esito, 'pareti-mhm')).toBe('compresa')
    const avviso = esito.avvisi.find((a) => a.codice === 'pareggio-non-applicato')
    expect(avviso).toBeDefined()
    expect(avviso!.livello).toBe('errore')
    expect(avviso!.messaggio).toContain('pareti')
  })
})
