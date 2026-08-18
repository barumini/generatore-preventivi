// src/documento/costruisci-input-esportazione.ts
import path from 'node:path'
import { eseguiCalcolo } from '@/domain/calcolo'
import { generaAbacoPerCategoria } from '@/ai/abaco'
import { inputCalcoloDaStato, pacchettoDaLivelli, type StatoForm } from '@/app/preventivi/nuovo/stato-form'
import { suggerisciTotaleLordoTesto } from '@/domain/geometria'
import { formattaDataItaliana } from './formatta-data-italiana'
import type { InputEsportazione, SuperficiOfferta, CondizioniOfferta, VoceOpzionale } from './export-docx'
import type { VoceEsclusioneForm, VoceOptionalForm } from './condizioni-default'

const NUMERO_SAL_PRIMI = 3

function lettera(indice: number, maiuscola: boolean): string {
  return `${String.fromCharCode((maiuscola ? 65 : 97) + indice)})`
}

function costruisciVoceOpzionale(voce: VoceOptionalForm | VoceEsclusioneForm, indice: number, maiuscola: boolean): VoceOpzionale {
  const marcataPraticaGenioCivile = 'praticaGenioCivile' in voce && voce.praticaGenioCivile === true
  return {
    id: marcataPraticaGenioCivile ? 'pratica-genio-civile' : '',
    lettera: lettera(indice, maiuscola),
    descrizione: voce.descrizione,
    importo: voce.importo,
  }
}

function costruisciSuperfici(stato: StatoForm): SuperficiOfferta {
  const trovaValore = (nomePiano: string) => stato.superfici.find((s) => s.piano === nomePiano)?.valoreLordo ?? ''

  return {
    totaleLorda: stato.totaleLordoTesto || suggerisciTotaleLordoTesto(stato.superfici, stato.totaleLordoManuale),
    pianoTerra: trovaValore('Piano Terra'),
    pianoPrimo: trovaValore('Piano Primo'),
    sottotetto: trovaValore('Piano sottotetto'),
    portico: trovaValore('Portico'),
    terrazzo: trovaValore('Terrazzo'),
    garage: trovaValore('Garage'),
  }
}

function costruisciCondizioni(stato: StatoForm): CondizioniOfferta {
  const { sal, optional, esclusioni, consegna, caparra, validita } = stato.condizioni
  return {
    consegna,
    caparra,
    validita,
    salPrimi: sal.slice(0, NUMERO_SAL_PRIMI),
    salSuccessivi: sal.slice(NUMERO_SAL_PRIMI),
    optional: optional.map((v, i) => costruisciVoceOpzionale(v, i, true)),
    esclusioni: esclusioni.map((v, i) => costruisciVoceOpzionale(v, i, false)),
  }
}

/**
 * Mapping puro StatoForm -> InputEsportazione (nessun I/O: percorsoOutput resta assente,
 * il chiamante HTTP scrive la risposta direttamente dal Buffer di costruisciBufferOfferta).
 * `revisioneMeta` vive nel record Prisma Revisione/Preventivo, non in StatoForm.
 */
export function costruisciInputEsportazione(
  stato: StatoForm,
  revisioneMeta: { numero: number; protocollo: string },
): InputEsportazione {
  const input = inputCalcoloDaStato(stato)
  const risultato = eseguiCalcolo(input)

  return {
    cliente: stato.cliente,
    protocollo: revisioneMeta.protocollo,
    revisione: String(revisioneMeta.numero - 1).padStart(2, '0'),
    dataOfferta: formattaDataItaliana(stato.data, stato.luogo),
    risultato,
    annoListino: input.listino.anno,
    caratteristiche: {
      tetto: stato.caratteristiche.tetto,
      mantoCopertura: stato.caratteristiche.manto,
      finituraEsterna: stato.caratteristiche.finituraEsterna.charAt(0).toUpperCase() + stato.caratteristiche.finituraEsterna.slice(1),
      pacchettoConsegna: pacchettoDaLivelli(stato.livelli),
    },
    superfici: costruisciSuperfici(stato),
    condizioni: costruisciCondizioni(stato),
    abaco: generaAbacoPerCategoria(stato.serramenti),
    percorsoMaster: path.join(process.cwd(), 'template', 'Offerta MHM master.docx'),
  }
}
