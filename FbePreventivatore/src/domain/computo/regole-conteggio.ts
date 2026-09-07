import { arrotondaCentesimi } from '../calcolo'
import type { Computo } from './estrai-voci'
import { sommaTotali, sommaQuantita, voceUnica } from './accesso'
import { numeroIt, quantitaIt } from './formatta-numero'
import { pulisciDescrizione } from './pulisci-descrizione'

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
    etichetta: pulisciDescrizione(computo.voci.find((v) => v.tariffa === tariffa)?.descrizione ?? tariffa),
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
    importo: zeroDiventaCompresa(totale),
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
  const categoria = importoCategoria(computo, 'M:001.003')
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
    importo: zeroDiventaCompresa(importo),
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
    // 'fisso', non 'calcolato': un override qui creerebbe un importo per un
    // tetto piano inesistente mentre la riga a falda tiene già tutto l'importo
    // della copertura (doppio conteggio, riassorbito in silenzio dalle
    // pareti). Stesso invariante delle altre voci sempre-compresa: bloccata
    // dall'interfaccia (SchedaVoce, `correggibile`).
    provenienza: 'fisso',
  }
}

/**
 * Nessuna regola FBE la conteggia: sempre `compresa`, come tracciamento
 * impianti e pareti a telaio. Segue subito `copertura-piana` nell'ordine del
 * master (`REGOLE` in conteggio.ts) perché la veletta serve al contenimento
 * della copertura piana (terrazza) — cfr. `Conteggi Master.xlsx`.
 */
export function regolaVelettaPerimetrale(): VoceConteggiata {
  return {
    idMaster: 'veletta-perimetrale',
    descrizione:
      'Veletta perimetrale h. cm 30, utilizzata per il contenimento della copertura piana ' +
      '(terrazza), coibentata esternamente con fibra di legno, rasata ed intonacata, ' +
      'internamente inguainata alla base completo di pannello in EPS, rasata ed intonacata, ' +
      'chiusa con una copertina in lamiera sommitale',
    passaggi: [],
    formula: 'sempre compresa',
    importo: 'compresa',
    provenienza: 'fisso',
  }
}

/**
 * La superficie è quella della posa (`204.03.08`, il «codice 116»): comprende
 * lo zoccolo perimetrale, quindi è maggiore di quella dei soli pannelli.
 * `M:001.004` è un importo in euro, non una superficie: la media è fra euro.
 */
export function regolaCappotto(computo: Computo): VoceConteggiata {
  const mq = sommaQuantita(computo, '204.03.08')
  const categoria = importoCategoria(computo, 'M:001.004')
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
    importo: zeroDiventaCompresa(importo),
    provenienza: 'calcolato',
  }
}

export const EUR_MQ_CARTONGESSO = 22
export const EUR_MQ_ASSISTENZA = 5
export const EUR_MQ_INFISSI = 500
export const EUR_PEZZO_MONTAGGIO = 100
export const EUR_PORTONCINO = 4_000

function mqCartongesso(computo: Computo): number {
  return sommaQuantita(computo, '107.04.01')
}

/**
 * «Moltiplica totale cartongessi × 22. Moltiplica il risultato ottenuto × 5.»
 * Il secondo × 5 si applica ai mq, non al risultato del × 22: altrimenti
 * darebbe 58.421,00 su Dacroce e porterebbe la voce a 41.016,55. È la stessa
 * quantità della voce `assistenza-cartongessisti`, che viene comunque
 * fatturata a parte: entra lo stesso nella media, per scelta confermata.
 */
export function regolaCartongesso(computo: Computo): VoceConteggiata {
  const mq = mqCartongesso(computo)
  const lastre = arrotondaCentesimi(mq * EUR_MQ_CARTONGESSO)
  const assistenza = arrotondaCentesimi(mq * EUR_MQ_ASSISTENZA)
  const categoria = importoCategoria(computo, 'M:001.005')
  const importo = arrotondaCentesimi((lastre + assistenza + categoria) / 2)
  return {
    idMaster: 'cartongesso-q2',
    descrizione:
      'Cartongesso interno a placcatura diretta su pareti "M.H.M." con finitura "Q2"',
    passaggi: [
      { etichetta: 'mq pannelli in cartongesso', origine: { tariffa: '107.04.01' }, valore: mq, unita: 'mq' },
      { etichetta: `${quantitaIt(mq)} mq × ${EUR_MQ_CARTONGESSO} €/mq`, origine: {}, valore: lastre, unita: 'eur' },
      { etichetta: `${quantitaIt(mq)} mq × ${EUR_MQ_ASSISTENZA} €/mq`, origine: {}, valore: assistenza, unita: 'eur' },
      { etichetta: 'categoria CARTONGESSO', origine: { categoria: 'M:001.005' }, valore: categoria, unita: 'eur' },
    ],
    formula: `(${numeroIt(lastre)} + ${numeroIt(assistenza)} + ${numeroIt(categoria)}) / 2 = ${numeroIt(importo)} €`,
    importo: zeroDiventaCompresa(importo),
    provenienza: 'calcolato',
  }
}

export function regolaAssistenzaCartongessisti(computo: Computo): VoceConteggiata {
  const mq = mqCartongesso(computo)
  const importo = arrotondaCentesimi(mq * EUR_MQ_ASSISTENZA)
  return {
    idMaster: 'assistenza-cartongessisti',
    descrizione: 'Assistenza ai cartongessisti',
    passaggi: [
      { etichetta: 'mq pannelli in cartongesso', origine: { tariffa: '107.04.01' }, valore: mq, unita: 'mq' },
    ],
    formula: `${quantitaIt(mq)} mq × ${EUR_MQ_ASSISTENZA} €/mq = ${numeroIt(importo)} €`,
    importo: zeroDiventaCompresa(importo),
    provenienza: 'calcolato',
  }
}

/**
 * Fornitura dei serramenti, a superficie. `109.04.02` (portabalcone) è
 * dichiarata `cadauno` nel computo ma la sua quantità è una superficie
 * (2,10 = 1,00 × 2,100), quindi appartiene a questo gruppo.
 */
export const TARIFFE_INFISSI_MQ = [
  '109.04.02', '109.04.03', '109.04.04', '109.04.05', '109.04.06',
] as const

/**
 * Montaggio, a pezzo. L'istruzione originale diceva «somma i valori mq», ma
 * queste voci sono in `cadauno`: non esiste una superficie da sommare.
 */
export const TARIFFE_INFISSI_PEZZI = [
  '109.04.07', '109.04.08', '109.04.09', '109.04.10', '109.04.11',
] as const

/**
 * I tre prodotti (mq×prezzo, pezzi×prezzo, portoncini×prezzo) sono passaggi in
 * `eur` accanto alla quantità che li genera, e sono gli stessi valori che
 * compaiono già sostituiti in `formula` — Emendamento trasparenza.
 */
export function regolaInfissi(computo: Computo): VoceConteggiata {
  const mq = sommaQuantita(computo, ...TARIFFE_INFISSI_MQ)
  const pezziMontaggio = sommaQuantita(computo, ...TARIFFE_INFISSI_PEZZI)
  const portoncini = sommaQuantita(computo, '109.04.07')
  const eurMq = arrotondaCentesimi(mq * EUR_MQ_INFISSI)
  const eurPezzi = arrotondaCentesimi(pezziMontaggio * EUR_PEZZO_MONTAGGIO)
  const eurPortoncini = arrotondaCentesimi(portoncini * EUR_PORTONCINO)
  const importo = arrotondaCentesimi(eurMq + eurPezzi + eurPortoncini)
  return {
    idMaster: 'infissi-pvc',
    descrizione: 'Infissi esterni in PVC (escluso oscuranti) con un portoncino di ingresso',
    passaggi: [
      {
        etichetta: 'mq fornitura serramenti',
        origine: { tariffa: TARIFFE_INFISSI_MQ.join(', ') },
        valore: mq,
        unita: 'mq',
      },
      { etichetta: `${quantitaIt(mq)} mq × ${EUR_MQ_INFISSI} €/mq`, origine: {}, valore: eurMq, unita: 'eur' },
      {
        etichetta: 'pezzi di montaggio',
        origine: { tariffa: TARIFFE_INFISSI_PEZZI.join(', ') },
        valore: pezziMontaggio,
        unita: 'nr',
      },
      {
        etichetta: `${quantitaIt(pezziMontaggio)} pezzi × ${EUR_PEZZO_MONTAGGIO} €/pezzo`,
        origine: {},
        valore: eurPezzi,
        unita: 'eur',
      },
      {
        // Chi apre la riga 109.04.07 nel computo trova il prezzo di MONTAGGIO
        // (350 € su Dacroce), non l'importo del portoncino (8.000 €): la
        // coincidenza fra le due quantità è strutturale — un portoncino, un
        // montaggio — ma non ovvia, va detta.
        etichetta: 'portoncini di ingresso, dalla riga di montaggio',
        origine: { tariffa: '109.04.07' },
        valore: portoncini,
        unita: 'nr',
      },
      {
        etichetta: `${quantitaIt(portoncini)} portoncini × ${EUR_PORTONCINO} €/portoncino`,
        origine: {},
        valore: eurPortoncini,
        unita: 'eur',
      },
    ],
    formula: `${numeroIt(eurMq)} + ${numeroIt(eurPezzi)} + ${numeroIt(eurPortoncini)} = ${numeroIt(importo)} €`,
    importo: zeroDiventaCompresa(importo),
    provenienza: 'calcolato',
  }
}

/**
 * Si sommano i totali in euro, non le quantità. La quantità di `109.04.13` non
 * è nemmeno intera (12,10 su Dacroce) perché Primus applica un fattore alla
 * riga dell'alzante scorrevole — 1,70 su Dacroce, 1,25 su Crivellaro — per
 * pesare i serramenti larghi con più di un monoblocco. Il fattore è già dentro
 * il prezzo: non va ricalcolato.
 */
export const TARIFFE_MONOBLOCCHI = ['109.04.12', '109.04.13', '109.04.14'] as const

export function regolaMonoblocchi(computo: Computo): VoceConteggiata {
  const importo = sommaTotali(computo, ...TARIFFE_MONOBLOCCHI)
  return {
    idMaster: 'monoblocchi',
    descrizione: 'Monoblocchi lisci su 4 lati ditta Hella per posa infissi',
    passaggi: TARIFFE_MONOBLOCCHI.map((tariffa) => ({
      etichetta: pulisciDescrizione(computo.voci.find((v) => v.tariffa === tariffa)?.descrizione ?? tariffa),
      origine: { tariffa },
      valore: sommaTotali(computo, tariffa),
      unita: 'eur' as const,
    })),
    formula: `somma di 3 tariffe: ${numeroIt(importo)} €`,
    importo: zeroDiventaCompresa(importo),
    provenienza: 'calcolato',
  }
}

export function regolaTracciamentoImpianti(): VoceConteggiata {
  return {
    idMaster: 'tracciamento-impianti',
    descrizione:
      'Tracciamento impianto idrosanitario ed elettrico come da tavola di ' +
      '"predisposizione impianti" sottoscritta',
    passaggi: [],
    formula: 'sempre compresa',
    importo: 'compresa',
    provenienza: 'fisso',
  }
}

export function regolaParetiTelaio(): VoceConteggiata {
  return {
    idMaster: 'pareti-telaio',
    descrizione:
      'Pareti non strutturali a telaio composte dalla struttura del telaio e ' +
      '2 lastre di cartongesso da un lato',
    passaggi: [],
    formula: 'sempre compresa',
    importo: 'compresa',
    provenienza: 'fisso',
  }
}
