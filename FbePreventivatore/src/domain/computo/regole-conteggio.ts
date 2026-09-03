import { arrotondaCentesimi } from '../calcolo'
import type { Computo } from './estrai-voci'
import { sommaTotali, sommaQuantita, voceUnica } from './accesso'
import { numeroIt, quantitaIt } from './formatta-numero'

export interface Passaggio {
  etichetta: string
  origine: { tariffa?: string; numeroVoce?: number; categoria?: string }
  valore: number
  unita: 'mq' | 'nr' | 'eur'
}

/** Vincolo CLAUDE.md #5: solo i numeri entrano nelle somme. */
export type ImportoConteggiato = number | 'compresa'

export interface VoceConteggiata {
  /** Id stabile, mai un numero di posizione — vincolo CLAUDE.md #4. */
  idMaster: string
  descrizione: string
  passaggi: Passaggio[]
  formula: string
  importo: ImportoConteggiato
  /** Vincolo CLAUDE.md #7: ogni importo dichiara da dove viene. */
  provenienza: 'calcolato' | 'manuale' | 'fisso'
}

function importoCategoria(computo: Computo, codice: string): number {
  return computo.riepilogo[codice]?.importo ?? 0
}

/**
 * Una voce che risulta zero non mostra `0,00` ma `compresa`: la riga resta nel
 * preventivo e dice al cliente che la lavorazione è contemplata.
 */
function zeroDiventaCompresa(valore: number): ImportoConteggiato {
  return valore === 0 ? 'compresa' : valore
}

export function regolaParetiBase(computo: Computo): VoceConteggiata {
  const importo = importoCategoria(computo, 'M:001.001')
  return {
    idMaster: 'pareti-mhm',
    descrizione: 'Pareti strutturali in legno "M.H.M."',
    passaggi: [
      {
        etichetta: 'categoria PARETI IN LEGNO',
        origine: { categoria: 'M:001.001' },
        valore: importo,
        unita: 'eur',
      },
    ],
    formula: `categoria PARETI IN LEGNO: ${numeroIt(importo)} €`,
    importo: arrotondaCentesimi(importo),
    provenienza: 'calcolato',
  }
}

/**
 * L'assieme della trave di base. L'istruzione originale diceva «il totale a
 * pagina 2 più 104.01.022 e 104.01.023», ma dove cade il salto di pagina lo
 * decide Primus: in Crivellaro quel subtotale è 4.697,52, in Dacroce 8.208,13,
 * e in entrambi la pagina si chiude sulla voce 9 solo per coincidenza. Le
 * undici tariffe sono lo stesso insieme, indipendente dall'impaginazione.
 *
 * Esclude `104.01.024`, la posa cordolo, che in entrambi i computi cade oltre.
 */
export const TARIFFE_TRAVE_BASE = [
  '106.01.01', '106.01.02', '106.01.03', '106.01.04',
  '104.01.017', '104.01.018', '104.01.019', '104.01.020',
  '104.01.021', '104.01.022', '104.01.023',
] as const

export function regolaTraveBase(computo: Computo): VoceConteggiata {
  const passaggi: Passaggio[] = TARIFFE_TRAVE_BASE.map((tariffa) => ({
    etichetta: computo.voci.find((v) => v.tariffa === tariffa)?.descrizione.slice(0, 60) ?? tariffa,
    origine: { tariffa },
    valore: sommaTotali(computo, tariffa),
    unita: 'eur' as const,
  }))
  const totale = sommaTotali(computo, ...TARIFFE_TRAVE_BASE)
  return {
    idMaster: 'trave-larice',
    descrizione: 'Trave alla base in larice',
    passaggi,
    formula: `somma di 11 tariffe: ${numeroIt(totale)} €`,
    importo: totale,
    provenienza: 'calcolato',
  }
}

export function regolaSolaio(computo: Computo): VoceConteggiata {
  const importo = importoCategoria(computo, 'M:001.002')
  return {
    idMaster: 'solaio-interpiano',
    descrizione: 'Solaio interpiano in legno lato inferiore a vista (escluso scala)',
    passaggi: [
      {
        etichetta: 'categoria SOLAIO',
        origine: { categoria: 'M:001.002' },
        valore: importo,
        unita: 'eur',
      },
    ],
    formula: `categoria SOLAIO: ${numeroIt(importo)} €`,
    importo: zeroDiventaCompresa(arrotondaCentesimi(importo)),
    provenienza: 'calcolato',
  }
}

export const CONSULENZA_ESECUTIVA = 4_000

export function regolaConsulenza(): VoceConteggiata {
  return {
    idMaster: 'progettazione-esecutiva',
    descrizione: 'Consulenza progettazione esecutiva di produzione',
    passaggi: [],
    formula: 'importo fisso',
    importo: CONSULENZA_ESECUTIVA,
    provenienza: 'fisso',
  }
}

export const EUR_MQ_COPERTURA = 220
export const EUR_MQ_CAPPOTTO = 90

/**
 * La superficie a falda è quella della riga `104.02.000` che dice FALDA. La
 * stessa tariffa porta anche sporto, tettoie e portico — 42,84 mq in
 * Crivellaro — che restano fuori, e non è una perdita: nel computo gli strati
 * si dividono proprio così. Il pacchetto coibente (freno a vapore, isolamento,
 * posa) è misurato sulla falda; struttura e manto su falda più sporto, perché
 * lo sporto sta fuori dall'involucro riscaldato. I 220 €/mq valorizzano il
 * pacchetto coibentato.
 */
export function regolaCoperturaFalda(computo: Computo): VoceConteggiata {
  const falda = voceUnica(computo, '104.02.000', /FALDA/)
  const mqFalda = falda.quantita ?? 0
  const mqPiana = sommaQuantita(computo, '104.02.011')
  const mq = arrotondaCentesimi(mqFalda + mqPiana)
  const categoria = computo.riepilogo['M:001.003']?.importo ?? 0
  const prodotto = arrotondaCentesimi(mq * EUR_MQ_COPERTURA)
  const importo = arrotondaCentesimi((prodotto + categoria) / 2)
  return {
    idMaster: 'copertura-falda',
    descrizione:
      'Copertura a falda in travi e tavolato lato inferiore a vista, compresa ' +
      'coibentazione, teli, manto in tegole e lattoneria',
    passaggi: [
      {
        etichetta: 'mq copertura a falda',
        origine: { tariffa: '104.02.000', numeroVoce: falda.numero },
        valore: mqFalda,
        unita: 'mq',
      },
      {
        etichetta: 'mq copertura piana',
        origine: { tariffa: '104.02.011' },
        valore: mqPiana,
        unita: 'mq',
      },
      {
        etichetta: `${quantitaIt(mq)} mq × ${EUR_MQ_COPERTURA} €/mq`,
        origine: {},
        valore: prodotto,
        unita: 'eur',
      },
      {
        etichetta: 'categoria COPERTURA',
        origine: { categoria: 'M:001.003' },
        valore: categoria,
        unita: 'eur',
      },
    ],
    formula: `(${numeroIt(prodotto)} + ${numeroIt(categoria)}) / 2 = ${numeroIt(importo)} €`,
    importo,
    provenienza: 'calcolato',
  }
}

/**
 * L'importo dell'intera copertura sta sulla riga a falda: questa riga resta a
 * `compresa` anche quando esiste una copertura piana.
 */
export function regolaCoperturaPiana(computo: Computo): VoceConteggiata {
  const mqPiana = sommaQuantita(computo, '104.02.011')
  return {
    idMaster: 'copertura-piana',
    descrizione: 'Tetto piano in lamellare lato inferiore a vista',
    passaggi: [
      {
        etichetta: 'mq copertura piana',
        origine: { tariffa: '104.02.011' },
        valore: mqPiana,
        unita: 'mq',
      },
    ],
    formula: `${quantitaIt(mqPiana)} mq — importo riportato sulla riga a falda`,
    importo: 'compresa',
    provenienza: 'calcolato',
  }
}

/**
 * La superficie è quella della posa (`204.03.08`, il «codice 116»): comprende
 * lo zoccolo perimetrale, quindi è maggiore di quella dei soli pannelli.
 * `M:001.004` è un importo in euro, non una superficie: la media è fra euro.
 */
export function regolaCappotto(computo: Computo): VoceConteggiata {
  const mq = sommaQuantita(computo, '204.03.08')
  const categoria = computo.riepilogo['M:001.004']?.importo ?? 0
  const prodotto = arrotondaCentesimi(mq * EUR_MQ_CAPPOTTO)
  const importo = arrotondaCentesimi((prodotto + categoria) / 2)
  return {
    idMaster: 'cappotto',
    descrizione: 'Cappotto esterno in fibra di legno finito con rasante ed intonaco',
    passaggi: [
      {
        etichetta: 'mq posa cappotto',
        origine: { tariffa: '204.03.08' },
        valore: mq,
        unita: 'mq',
      },
      {
        etichetta: `${quantitaIt(mq)} mq × ${EUR_MQ_CAPPOTTO} €/mq`,
        origine: {},
        valore: prodotto,
        unita: 'eur',
      },
      {
        etichetta: 'categoria CAPPOTTO',
        origine: { categoria: 'M:001.004' },
        valore: categoria,
        unita: 'eur',
      },
    ],
    formula: `(${numeroIt(prodotto)} + ${numeroIt(categoria)}) / 2 = ${numeroIt(importo)} €`,
    importo,
    provenienza: 'calcolato',
  }
}
