import type { RisultatoImportazioneExcel } from '@/domain/importazione-excel'
import type { StatoForm } from '../nuovo/stato-form'

// Solo i serramenti sono automatizzabili al 100% (CLAUDE.md, spec §3.6): pareti/falde/travi
// restano dati informativi non prezzati. Gli avvisi del parser non entrano nello StatoForm —
// sono transitori, mostrati una volta sola nella schermata di import.
export function statoFormDaImportazione(risultato: RisultatoImportazioneExcel): Partial<StatoForm> {
  return {
    serramenti: risultato.serramenti,
    pareti: risultato.pareti,
    falde: risultato.falde,
    travi: risultato.travi,
  }
}
