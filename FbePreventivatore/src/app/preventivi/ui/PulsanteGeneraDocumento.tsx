'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { Alert } from './Alert'
import { scaricaDocumentoDaRisposta } from './scarica-blob'

interface Props {
  preventivoId: string
  numero: number
  primaDiGenerare: () => Promise<boolean>
}

export function PulsanteGeneraDocumento({ preventivoId, numero, primaDiGenerare }: Props) {
  const [stato, setStato] = useState<'inattivo' | 'in-corso' | 'errore'>('inattivo')
  const [messaggioErrore, setMessaggioErrore] = useState('')

  async function generaDocumento() {
    setStato('in-corso')
    try {
      const salvataggioRiuscito = await primaDiGenerare()
      if (!salvataggioRiuscito) {
        throw new Error('Salvataggio delle modifiche fallito: il documento non è stato generato.')
      }

      const risposta = await fetch(`/api/preventivi/${preventivoId}/revisioni/${numero}/export`, { method: 'POST' })
      await scaricaDocumentoDaRisposta(risposta, 'offerta.docx')

      setStato('inattivo')
    } catch (errore) {
      console.error('Generazione documento fallita:', errore)
      setMessaggioErrore(errore instanceof Error ? errore.message : 'Errore sconosciuto')
      setStato('errore')
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" variant="secondary" onClick={generaDocumento} disabled={stato === 'in-corso'}>
        <span className="flex items-center gap-2">
          {stato === 'in-corso' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Genera documento
        </span>
      </Button>
      {stato === 'errore' && <Alert variant="errore">{messaggioErrore}</Alert>}
    </div>
  )
}
