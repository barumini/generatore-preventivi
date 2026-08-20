'use client'

import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Alert } from '../ui/Alert'
import { importaConteggiExcel } from '@/domain/importazione-excel'
import { leggiRigheDaWorkbook } from './leggi-righe-excel'
import { statoFormDaImportazione } from './mappatura-importazione'
import type { StatoForm } from '../nuovo/stato-form'

interface Riepilogo {
  nomeFile: string
  serramenti: number
  pareti: number
  falde: number
  travi: number
  avvisi: string[]
}

interface Props {
  onImportazioneCompletata: (parziale: Partial<StatoForm>) => void
}

export function ImportazioneExcel({ onImportazioneCompletata }: Props) {
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState('')
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null)

  async function gestisciFile(file: File) {
    setCaricamento(true)
    setErrore('')
    setRiepilogo(null)
    try {
      const buffer = await file.arrayBuffer()
      const righe = await leggiRigheDaWorkbook(buffer)
      const risultato = importaConteggiExcel(righe)
      onImportazioneCompletata(statoFormDaImportazione(risultato))
      setRiepilogo({
        nomeFile: file.name,
        serramenti: risultato.serramenti.length,
        pareti: risultato.pareti.length,
        falde: risultato.falde.length,
        travi: risultato.travi.length,
        avvisi: risultato.avvisi,
      })
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Lettura del file Excel fallita: verifica che sia un .xlsx valido')
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-border-warm bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-accent">
        <Upload size={16} />
        <span className="text-[11px] font-bold uppercase tracking-wide">Importa dal foglio conteggi</span>
      </div>
      <p className="mb-3 text-sm text-text-secondary">
        Carica il file Excel dei conteggi (sezioni SERRAMENTI, COPERTURA, TRAVI, PARETI, come in &quot;Conteggi
        pulito.xlsx&quot;). I serramenti alimentano subito la geometria del wizard; pareti, falde e travi restano dati
        di riferimento, non entrano nel prezzo.
      </p>

      <label
        className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-warm px-4 py-2 text-sm font-semibold text-text hover:border-accent ${
          caricamento ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        {caricamento ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        {caricamento ? 'Sto leggendo...' : 'Scegli file Excel'}
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          disabled={caricamento}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) gestisciFile(file)
          }}
        />
      </label>

      {errore && (
        <div className="mt-3">
          <Alert variant="errore">{errore}</Alert>
        </div>
      )}

      {riepilogo && (
        <div className="mt-3 rounded-md bg-accent/5 p-3 text-sm text-text-secondary">
          <p className="font-semibold text-text">{riepilogo.nomeFile}</p>
          <p>
            {riepilogo.serramenti} serramenti importati · {riepilogo.pareti} pareti · {riepilogo.falde} voci copertura
            · {riepilogo.travi} voci travi (di riferimento, non prezzate)
          </p>
          {riepilogo.avvisi.length > 0 && (
            <div className="mt-2">
              <Alert variant="avviso">
                <ul className="list-disc pl-4">
                  {riepilogo.avvisi.map((avviso, i) => (
                    <li key={i}>{avviso}</li>
                  ))}
                </ul>
              </Alert>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
