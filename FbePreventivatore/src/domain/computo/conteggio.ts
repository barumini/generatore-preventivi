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

function formattaEuro(valore: number): string {
  return valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
        `La somma delle voci (${formattaEuro(integrita.totaleVoci)}) non pareggia il totale ` +
        `del riepilogo (${formattaEuro(integrita.totaleRiepilogo)}). ` +
        'Il computo è stato letto male: i conteggi non sono affidabili.',
    })
  }

  const sicurezzaComputo = computo.riepilogo['M:001.020']?.importo
  if (sicurezzaComputo !== undefined && sicurezzaComputo !== COSTI_SICUREZZA_FORFETTARI) {
    avvisi.push({
      livello: 'avviso',
      codice: 'sicurezza-diversa',
      messaggio:
        `Il computo riporta costi sicurezza di ${formattaEuro(sicurezzaComputo)}, ` +
        `mentre il pareggio usa i ${formattaEuro(COSTI_SICUREZZA_FORFETTARI)} forfettari.`,
    })
  }

  const voci = REGOLE.map((regola) => {
    const voce = regola(computo)
    const correzione = override[voce.idMaster]
    if (correzione === undefined) return voce
    return { ...voce, importo: arrotondaCentesimi(correzione), provenienza: 'manuale' as const }
  })

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
        `Il conteggio supera il target di ${formattaEuro(-delta)}: il pareggio ridurrebbe ` +
        'le pareti strutturali. È legittimo ma inusuale, vale la pena verificare le voci.',
    })
  }

  // Il pareggio si carica sulle pareti. La voce è già nell'elenco col suo
  // importo di categoria: la si sostituisce sommandoci il delta.
  const vociAPareggio = voci.map((voce) => {
    if (voce.idMaster !== ID_PARETI || typeof voce.importo !== 'number') return voce
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
