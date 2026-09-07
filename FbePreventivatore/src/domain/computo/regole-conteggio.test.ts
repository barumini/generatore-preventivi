import { describe, expect, it } from 'vitest'
import { estraiComputo } from './estrai-voci'
import {
  regolaParetiBase,
  regolaTraveBase,
  regolaSolaio,
  regolaConsulenza,
  regolaCoperturaFalda,
  regolaCoperturaPiana,
  regolaVelettaPerimetrale,
  regolaCappotto,
  regolaCartongesso,
  regolaAssistenzaCartongessisti,
  regolaInfissi,
  regolaMonoblocchi,
  regolaTracciamentoImpianti,
  regolaParetiTelaio,
  TARIFFE_TRAVE_BASE,
  TARIFFE_MONOBLOCCHI,
} from './regole-conteggio'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])

describe('regolaParetiBase', () => {
  it('legge la categoria PARETI IN LEGNO', () => {
    expect(regolaParetiBase(dacroce).importo).toBe(105_987.63)
    expect(regolaParetiBase(crivellaro).importo).toBe(79_500.82)
  })

  it('dichiara la provenienza e la sorgente', () => {
    const voce = regolaParetiBase(dacroce)
    expect(voce.idMaster).toBe('pareti-mhm')
    expect(voce.provenienza).toBe('calcolato')
    expect(voce.passaggi[0].origine.categoria).toBe('M:001.001')
  })
})

describe('regolaTraveBase', () => {
  it('somma le undici tariffe dell’assieme di base', () => {
    expect(regolaTraveBase(dacroce).importo).toBe(10_104.24)
    expect(regolaTraveBase(crivellaro).importo).toBe(5_843.70)
  })

  it('esclude la posa cordolo 104.01.024', () => {
    expect(TARIFFE_TRAVE_BASE).not.toContain('104.01.024')
    expect(TARIFFE_TRAVE_BASE).toHaveLength(11)
  })

  it('usa l’id stabile già presente nel catalogo, non uno inventato', () => {
    expect(regolaTraveBase(dacroce).idMaster).toBe('trave-larice')
  })

  it('mostra un passaggio per ogni tariffa che contribuisce', () => {
    const voce = regolaTraveBase(dacroce)
    expect(voce.passaggi).toHaveLength(11)
    expect(voce.passaggi.map((p) => p.origine.tariffa)).toEqual([...TARIFFE_TRAVE_BASE])
  })
})

describe('regolaSolaio', () => {
  it('legge la categoria SOLAIO', () => {
    expect(regolaSolaio(dacroce).importo).toBe(15_240.96)
  })

  it("diventa 'compresa' quando la categoria vale zero", () => {
    expect(regolaSolaio(crivellaro).importo).toBe('compresa')
  })
})

describe('regolaConsulenza', () => {
  it('vale sempre 4.000 e non dipende dal computo', () => {
    const voce = regolaConsulenza()
    expect(voce.importo).toBe(4_000)
    expect(voce.provenienza).toBe('fisso')
    expect(voce.passaggi).toEqual([])
  })

  it('usa l’id stabile già presente nel catalogo, non uno inventato', () => {
    expect(regolaConsulenza().idMaster).toBe('progettazione-esecutiva')
  })
})

describe('trasparenza delle formule', () => {
  it('le formule portano i valori, non i codici categoria', () => {
    for (const voce of [regolaParetiBase(dacroce), regolaSolaio(dacroce), regolaTraveBase(dacroce)]) {
      expect(voce.formula).not.toMatch(/M:001\.\d{3}/)
    }
    expect(regolaParetiBase(dacroce).formula).toContain('105 987,63')
  })

  it('nessuna formula porta codici categoria grezzi', () => {
    const voci = [
      regolaCartongesso(dacroce),
      regolaAssistenzaCartongessisti(dacroce),
      regolaInfissi(dacroce),
      regolaMonoblocchi(dacroce),
    ]
    for (const voce of voci) expect(voce.formula).not.toMatch(/M:001\.\d{3}/)
  })
})

describe('regolaCoperturaFalda', () => {
  it('media i mq per 220 con la categoria COPERTURA', () => {
    // Dacroce: (184,18 × 220 = 40.519,60 + 68.428,78) / 2
    expect(regolaCoperturaFalda(dacroce).importo).toBe(54_474.19)
    // Crivellaro: (186,35 × 220 = 40.997,00 + 76.701,12) / 2
    expect(regolaCoperturaFalda(crivellaro).importo).toBe(58_849.06)
  })

  it('usa la sola riga a falda, non lo sporto che condivide la tariffa', () => {
    const passaggi = regolaCoperturaFalda(crivellaro).passaggi
    const falda = passaggi.find((p) => p.origine.tariffa === '104.02.000')!
    expect(falda.valore).toBe(186.35)
    expect(falda.valore).not.toBe(229.19)
    expect(falda.origine.numeroVoce).toBe(59)
  })

  it('espone i mq letti come passaggi in mq, non in euro', () => {
    const passaggi = regolaCoperturaFalda(dacroce).passaggi
    expect(passaggi.filter((p) => p.unita === 'mq')).toHaveLength(2)
  })

  it('mostra il prodotto intermedio, non solo i mq', () => {
    const passaggi = regolaCoperturaFalda(dacroce).passaggi
    const prodotto = passaggi.find((p) => p.etichetta.includes('× 220'))
    expect(prodotto).toBeDefined()
    expect(prodotto!.valore).toBe(40_519.60)
    expect(prodotto!.etichetta).toBe('184,18 mq × 220 €/mq')
    // il prodotto sta fra i mq e la categoria: se finisse in coda la scheda
    // mostrerebbe il risultato prima dei suoi ingredienti
    expect(passaggi.findIndex((p) => p.etichetta.includes('× 220'))).toBe(2)
    expect(passaggi.at(-1)!.origine.categoria).toBe('M:001.003')
  })

  it('la formula porta i valori sostituiti e il risultato', () => {
    expect(regolaCoperturaFalda(dacroce).formula).toBe(
      '(40 519,60 + 68 428,78) / 2 = 54 474,19 €',
    )
    expect(regolaCappotto(dacroce).formula).not.toMatch(/M:001\.\d{3}/)
  })
})

describe('regolaCoperturaPiana', () => {
  it("è sempre 'compresa': l'importo sta sulla riga a falda", () => {
    expect(regolaCoperturaPiana(dacroce).importo).toBe('compresa')
    expect(regolaCoperturaPiana(crivellaro).importo).toBe('compresa')
  })

  it("è 'fisso', come le altre voci sempre comprese: un override qui doppierebbe il conteggio della copertura, già intero sulla riga a falda", () => {
    expect(regolaCoperturaPiana(dacroce).provenienza).toBe('fisso')
  })
})

describe('regolaCappotto', () => {
  it('media i mq della posa per 90 con la categoria CAPPOTTO', () => {
    // Dacroce: (195,16 × 90 = 17.564,40 + 25.684,61) / 2 = 21.624,505
    expect(regolaCappotto(dacroce).importo).toBe(21_624.51)
    // Crivellaro: (191,58 × 90 = 17.242,20 + 25.264,43) / 2 = 21.253,315
    expect(regolaCappotto(crivellaro).importo).toBe(21_253.32)
  })

  it('arrotonda per eccesso il mezzo centesimo, in entrambi i computi', () => {
    // Se si sommassero i valori grezzi senza arrotondare per voce, il delta di
    // pareggio slitterebbe di un centesimo e i golden case non tornerebbero.
    expect(regolaCappotto(dacroce).importo).not.toBe(21_624.5)
    expect(regolaCappotto(crivellaro).importo).not.toBe(21_253.31)
  })

  it('mostra il prodotto intermedio nella posizione attesa', () => {
    // come per la copertura a falda: il prodotto sta fra i mq e la categoria,
    // qui alla posizione 1 perché i passaggi del cappotto sono tre, non quattro
    const passaggi = regolaCappotto(dacroce).passaggi
    expect(passaggi.findIndex((p) => p.etichetta.includes('× 90'))).toBe(1)
    expect(passaggi.at(-1)!.origine.categoria).toBe('M:001.004')
  })
})

describe('regolaCartongesso', () => {
  it('somma mq×22 e mq×5 al riepilogo, poi dimezza', () => {
    // Dacroce: (531,10 × 22 = 11.684,20 + 531,10 × 5 = 2.655,50 + 23.612,10) / 2
    expect(regolaCartongesso(dacroce).importo).toBe(18_975.90)
    expect(regolaCartongesso(crivellaro).importo).toBe(15_506.77)
  })

  it('moltiplica per 5 i mq, non il risultato del ×22', () => {
    const passaggi = regolaCartongesso(dacroce).passaggi
    expect(passaggi.find((p) => p.unita === 'mq')!.valore).toBe(531.1)
    // la lettura alternativa, (531,10 × 22) × 5, darebbe 41.016,55
    expect(regolaCartongesso(dacroce).importo).not.toBe(41_016.55)
  })
})

describe('regolaAssistenzaCartongessisti', () => {
  it('vale i mq di cartongesso per 5', () => {
    expect(regolaAssistenzaCartongessisti(dacroce).importo).toBe(2_655.50)
    expect(regolaAssistenzaCartongessisti(crivellaro).importo).toBe(2_162.30)
  })
})

describe('regolaInfissi', () => {
  it('somma mq×500, pezzi×100 e portoncini×4000', () => {
    // Dacroce: 43,66 × 500 + 14 × 100 + 2 × 4000
    expect(regolaInfissi(dacroce).importo).toBe(31_230)
    // Crivellaro: 28,30 × 500 + 11 × 100 + 1 × 4000
    expect(regolaInfissi(crivellaro).importo).toBe(19_250)
  })

  it('tratta il secondo gruppo come pezzi e il primo come superficie', () => {
    const passaggi = regolaInfissi(dacroce).passaggi
    expect(passaggi.find((p) => p.unita === 'mq')!.valore).toBe(43.66)
    expect(passaggi.find((p) => p.unita === 'nr' && p.etichetta.includes('montaggio'))!.valore).toBe(14)
  })

  it('conta i portoncini come pezzi di 109.04.07', () => {
    expect(regolaInfissi(dacroce).passaggi.find((p) => p.etichetta.includes('portoncini'))!.valore).toBe(2)
    expect(regolaInfissi(crivellaro).passaggi.find((p) => p.etichetta.includes('portoncini'))!.valore).toBe(1)
  })

  it('la formula degli infissi mostra i tre addendi, non i moltiplicatori', () => {
    expect(regolaInfissi(dacroce).formula).toBe(
      '21 830,00 + 1 400,00 + 8 000,00 = 31 230,00 €',
    )
  })
})

describe('regolaMonoblocchi', () => {
  it('somma i totali in euro delle tre tariffe, non le quantità', () => {
    expect(regolaMonoblocchi(dacroce).importo).toBe(14_495)
    expect(regolaMonoblocchi(crivellaro).importo).toBe(9_450)
  })
})

describe('voci sempre comprese', () => {
  it('tracciamento impianti, pareti a telaio e veletta perimetrale non sono modificabili', () => {
    for (const voce of [
      regolaTracciamentoImpianti(),
      regolaParetiTelaio(),
      regolaVelettaPerimetrale(),
    ]) {
      expect(voce.importo).toBe('compresa')
      expect(voce.provenienza).toBe('fisso')
    }
  })

  it('la veletta perimetrale usa l’id stabile del catalogo', () => {
    expect(regolaVelettaPerimetrale().idMaster).toBe('veletta-perimetrale')
  })
})

describe('righe calcolate che possono risultare zero diventano "compresa"', () => {
  it('su entrambi i computi reali nessuna di queste voci vale mai zero', () => {
    // Regressione minima: se zeroDiventaCompresa scattasse per errore su un
    // golden case, questi importi diventerebbero 'compresa' invece del
    // numero atteso — cosa che i test dei singoli importi, sopra, già
    // impedirebbero, ma qui è esplicito e in un posto solo.
    const regole = [
      regolaTraveBase,
      regolaCoperturaFalda,
      regolaCappotto,
      regolaCartongesso,
      regolaAssistenzaCartongessisti,
      regolaInfissi,
      regolaMonoblocchi,
    ]
    for (const computo of [dacroce, crivellaro]) {
      for (const regola of regole) {
        expect(regola(computo).importo).not.toBe(0)
      }
    }
  })

  it("regolaMonoblocchi diventa 'compresa' se nessuna delle tre tariffe è presente nel computo", () => {
    const senzaMonoblocchi = {
      ...dacroce,
      voci: dacroce.voci.filter((v) => !TARIFFE_MONOBLOCCHI.some((t) => t === v.tariffa)),
    }
    expect(regolaMonoblocchi(senzaMonoblocchi).importo).toBe('compresa')
  })
})
