import { arrotondaCentesimi } from '../calcolo'
import type { Computo } from './estrai-voci'
import { verificaIntegrita } from './estrai-voci'
import { numeroIt } from './formatta-numero'
import {
  regolaParetiBase,
  regolaTracciamentoImpianti,
  regolaParetiTelaio,
  regolaTraveBase,
  regolaSolaio,
  regolaCoperturaFalda,
  regolaCoperturaPiana,
  regolaCappotto,
  regolaCartongesso,
  regolaAssistenzaCartongessisti,
  regolaInfissi,
  regolaMonoblocchi,
  regolaConsulenza,
  type VoceConteggiata,
} from './regole-conteggio'

/**
 * Sottratti al totale del computo per ottenere il Listino di riferimento.
 * Entrambi i computi analizzati riportano `M:001.020 = 23.352,50`: lo scarto di
 * 52,50 è voluto, ma il conteggio lo segnala perché un computo con sicurezza
 * diversa sposterebbe il pareggio senza dirlo.
 */
export const COSTI_SICUREZZA_FORFETTARI = 23_300

export interface Avviso {
  livello: 'avviso' | 'errore'
  codice: string
  messaggio: string
}

export interface RisultatoConteggio {
  /** Nell'ordine di Conteggi Master, con le pareti già portate a pareggio. */
  voci: VoceConteggiata[]
  sommaVoci: number
  target: number
  delta: number
  avvisi: Avviso[]
}

/** L'ordine è quello del foglio Conteggi Master. */
const REGOLE: Array<(computo: Computo) => VoceConteggiata> = [
  regolaParetiBase,
  regolaTracciamentoImpianti,
  regolaParetiTelaio,
  regolaTraveBase,
  regolaSolaio,
  regolaCoperturaFalda,
  regolaCoperturaPiana,
  regolaCappotto,
  regolaCartongesso,
  regolaAssistenzaCartongessisti,
  regolaInfissi,
  regolaMonoblocchi,
  regolaConsulenza,
]

const ID_PARETI = 'pareti-mhm'

export function eseguiConteggio(
  computo: Computo,
  override: Record<string, number> = {},
): RisultatoConteggio {
  const avvisi: Avviso[] = []

  const integrita = verificaIntegrita(computo)
  if (!integrita.coerente) {
    avvisi.push({
      livello: 'errore',
      codice: 'integrita',
      messaggio:
        `La somma delle voci (${numeroIt(integrita.totaleVoci)}) non pareggia il totale ` +
        `del riepilogo (${numeroIt(integrita.totaleRiepilogo)}). ` +
        'Il computo è stato letto male: i conteggi non sono affidabili.',
    })
  }

  const sicurezzaComputo = computo.riepilogo['M:001.020']?.importo
  if (sicurezzaComputo !== undefined && sicurezzaComputo !== COSTI_SICUREZZA_FORFETTARI) {
    avvisi.push({
      livello: 'avviso',
      codice: 'sicurezza-diversa',
      messaggio:
        `Il computo riporta costi sicurezza di ${numeroIt(sicurezzaComputo)}, ` +
        `mentre il pareggio usa i ${numeroIt(COSTI_SICUREZZA_FORFETTARI)} forfettari.`,
    })
  }

  // Ogni chiave di `override` è una correzione manuale su un idMaster. Tre modi
  // in cui può essere scartata, ciascuno con un avviso: punta alle pareti (che
  // assorbono il pareggio e non si correggono a mano), non è un numero finito
  // (un campo vuoto convertito con parseFloat dà NaN, che `typeof` non
  // distingue da un numero valido), o non punta a nessuna voce del conteggio.
  const voci = REGOLE.map((regola) => {
    const voce = regola(computo)
    const correzione = override[voce.idMaster]
    if (correzione === undefined) return voce

    if (voce.idMaster === ID_PARETI) {
      avvisi.push({
        livello: 'avviso',
        codice: 'override-pareti-rifiutato',
        messaggio:
          'Le pareti strutturali assorbono il pareggio e non si correggono a mano: ' +
          "per cambiarne l'importo, correggi le altre voci.",
      })
      return voce
    }

    const corretto = arrotondaCentesimi(correzione)
    // Non basta validare l'input: arrotondaCentesimi moltiplica per 100, e un
    // valore finito ma astronomico (es. Number.MAX_VALUE) va in overflow lì,
    // non prima. Senza il secondo controllo un override "finito" produrrebbe
    // comunque un ±Infinity silenzioso — la stessa firma del bug NaN.
    if (!Number.isFinite(correzione) || !Number.isFinite(corretto)) {
      avvisi.push({
        livello: 'errore',
        codice: 'override-non-finito',
        messaggio:
          `La correzione manuale per "${voce.idMaster}" non è un numero valido ` +
          `(ricevuto ${correzione}): ignorata, resta il valore calcolato.`,
      })
      return voce
    }

    const originale = voce.importo
    // I passaggi restano le sorgenti lette dal computo: sono ancora vere, è
    // solo il risultato che l'utente ha scavalcato. La formula invece deve
    // dire la verità: senza questa riscrittura mostrerebbe ancora il calcolo
    // che l'override ha appena sostituito. Il simbolo '€' segue solo una
    // cifra: se il calcolo di partenza dava 'compresa' non è una cifra, e va
    // fra virgolette basse invece che con un '€' appeso.
    const formula =
      typeof originale === 'number'
        ? `corretto a mano: ${numeroIt(corretto)} € — il calcolo dava ${numeroIt(originale)} €`
        : `corretto a mano: ${numeroIt(corretto)} € — il calcolo dava «${originale}»`
    return {
      ...voce,
      importo: corretto,
      provenienza: 'manuale' as const,
      formula,
    }
  })

  const idMasterConosciuti = new Set(voci.map((voce) => voce.idMaster))
  for (const chiave of Object.keys(override)) {
    if (!idMasterConosciuti.has(chiave)) {
      avvisi.push({
        livello: 'avviso',
        codice: 'override-voce-sconosciuta',
        messaggio: `La correzione manuale indica la voce "${chiave}", che non esiste nel conteggio.`,
      })
    }
  }

  const sommaVoci = arrotondaCentesimi(
    voci.reduce((totale, voce) => totale + (typeof voce.importo === 'number' ? voce.importo : 0), 0),
  )
  const target = arrotondaCentesimi(computo.totale - COSTI_SICUREZZA_FORFETTARI)
  const delta = arrotondaCentesimi(target - sommaVoci)

  if (delta < 0) {
    avvisi.push({
      livello: 'avviso',
      codice: 'delta-negativo',
      messaggio:
        `Il conteggio supera il target di ${numeroIt(-delta)}: il pareggio ridurrebbe ` +
        'le pareti strutturali. È legittimo ma inusuale, vale la pena verificare le voci.',
    })
  }

  // Il pareggio si carica sulle pareti. La voce è già nell'elenco col suo
  // importo di categoria: la si sostituisce sommandoci il delta.
  const vociAPareggio = voci.map((voce) => {
    if (voce.idMaster !== ID_PARETI) return voce

    if (typeof voce.importo !== 'number') {
      // Oggi irraggiungibile — regolaParetiBase restituisce sempre un numero —
      // ma è un guardrail, non un'ipotesi: se in futuro la regola cambiasse
      // (come regolaSolaio, che può restituire 'compresa'), il pareggio
      // andrebbe perso in silenzio e la somma non atterrerebbe più sul target.
      avvisi.push({
        livello: 'errore',
        codice: 'pareggio-non-applicato',
        messaggio:
          `La voce delle pareti strutturali non ha un importo numerico (${voce.importo}): ` +
          'il pareggio non è stato applicato e la somma non atterra sul target.',
      })
      return voce
    }

    const aPareggio = arrotondaCentesimi(voce.importo + delta)
    return {
      ...voce,
      importo: aPareggio,
      // Il delta non viene dal computo: senza questo passaggio l'importo delle pareti
      // sarebbe l'unico numero della pagina che il lettore non può ricostruire.
      passaggi: [
        ...voce.passaggi,
        {
          etichetta:
            `pareggio: ${numeroIt(target)} di target − ${numeroIt(sommaVoci)} di voci conteggiate`,
          origine: {},
          valore: delta,
          unita: 'eur' as const,
        },
      ],
      formula:
        `${numeroIt(voce.importo)} + ${numeroIt(delta)} di pareggio = ${numeroIt(aPareggio)} €`,
    }
  })

  return { voci: vociAPareggio, sommaVoci, target, delta, avvisi }
}
