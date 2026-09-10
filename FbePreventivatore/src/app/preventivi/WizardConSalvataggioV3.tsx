'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { eseguiCalcolo } from '@/domain/calcolo'
import { Button } from './ui/Button'
import { Alert } from './ui/Alert'
import { FormStrutturatoV3 } from './nuovo-v3/FormStrutturatoV3'
import { PannelloPreview } from './nuovo/PannelloPreview'
import { PulsanteGeneraDocumento } from './ui/PulsanteGeneraDocumento'
import { inputCalcoloDaStato, type StatoForm } from './nuovo/stato-form'

interface PreventivoEsistente {
  id: string
  numero: number
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  aggiornamentoEsterno?: { versione: number; parziale: Partial<StatoForm> }
  preventivoEsistente?: PreventivoEsistente
  onSalvato?: (salvataggio: PreventivoEsistente) => void
}

export function WizardConSalvataggioV3({ statoIniziale, aggiornamentoEsterno, preventivoEsistente, onSalvato }: Props) {
  const [stato, setStato] = useState<StatoForm | null>(null)
  const [salvataggio, setSalvataggio] = useState<PreventivoEsistente | null>(preventivoEsistente ?? null)
  const [statoSalvataggio, setStatoSalvataggio] = useState<'inattivo' | 'in-corso' | 'errore'>('inattivo')
  const [messaggioErroreSalvataggio, setMessaggioErroreSalvataggio] = useState('')

  async function salvaBozza(): Promise<boolean> {
    if (!stato) return false
    setStatoSalvataggio('in-corso')
    const input = inputCalcoloDaStato(stato)
    const risultato = eseguiCalcolo(input)
    const corpo = {
      cliente: stato.cliente,
      protocollo: stato.protocollo,
      oggetto: stato.oggetto,
      progettista: stato.progettista,
      data: stato.data,
      luogo: stato.luogo,
      statoForm: JSON.stringify(stato),
      inputCalcolo: JSON.stringify(input),
      risultatoCalcolo: JSON.stringify(risultato),
    }
    try {
      if (salvataggio) {
        const risposta = await fetch(`/api/preventivi/${salvataggio.id}/revisioni/${salvataggio.numero}`, {
          method: 'PUT',
          body: JSON.stringify(corpo),
        })
        if (!risposta.ok) {
          const corpoErrore = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
          throw new Error(corpoErrore.errore ?? `Errore ${risposta.status}`)
        }
      } else {
        const risposta = await fetch('/api/preventivi', { method: 'POST', body: JSON.stringify(corpo) })
        if (!risposta.ok) {
          const corpoErrore = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
          throw new Error(corpoErrore.errore ?? `Errore ${risposta.status}`)
        }
        const preventivo = await risposta.json()
        const nuovoSalvataggio = { id: preventivo.id, numero: preventivo.revisioni[0].numero }
        setSalvataggio(nuovoSalvataggio)
        onSalvato?.(nuovoSalvataggio)
      }
      setStatoSalvataggio('inattivo')
      return true
    } catch (errore) {
      console.error('Salvataggio bozza fallito:', errore)
      setMessaggioErroreSalvataggio(errore instanceof Error ? errore.message : 'Errore sconosciuto')
      setStatoSalvataggio('errore')
      return false
    }
  }

  return (
    <div className="mx-auto flex max-w-[1400px] gap-6 bg-cream p-6 text-text">
      <div className="flex flex-[1.1] flex-col">
        <FormStrutturatoV3 statoIniziale={statoIniziale} aggiornamentoEsterno={aggiornamentoEsterno} onCambiamento={setStato} />
        <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-border-warm bg-cream py-3">
          <Button type="button" onClick={salvaBozza} disabled={!stato || statoSalvataggio === 'in-corso'}>
            <span className="flex items-center gap-2">
              {statoSalvataggio === 'in-corso' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salva bozza
            </span>
          </Button>
          {statoSalvataggio === 'errore' && <Alert variant="errore">{messaggioErroreSalvataggio}</Alert>}
          {salvataggio && (
            <PulsanteGeneraDocumento
              preventivoId={salvataggio.id}
              numero={salvataggio.numero}
              primaDiGenerare={salvaBozza}
            />
          )}
        </div>
      </div>
      <div className="flex-1">
        {/* Bounded all'altezza del viewport: senza il cap l'elemento sticky è alto
            quanto il suo containing block e non ha corsa utile, comportandosi come static. */}
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
          {stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}
        </div>
      </div>
    </div>
  )
}
