'use client'

import { useState } from 'react'
import { ChatApertura } from '../nuovo/ChatApertura'
import { WizardConSalvataggioV3 } from '../WizardConSalvataggioV3'
import { Breadcrumb } from '../ui/Breadcrumb'
import type { StatoForm } from '../nuovo/stato-form'

const STATO_INIZIALE_VUOTO: Partial<StatoForm> = {}

// Campi di geometria che l'estrazione AI ("Apertura rapida") può popolare ma che questa
// versione del wizard non espone in nessuno step (niente "Geometria"): senza filtrarli,
// un'estrazione potrebbe scrivere superfici/serramenti/perimetro nello stato senza che
// l'operatore possa mai vederli o correggerli prima di salvare/esportare.
const CAMPI_GEOMETRIA_NON_REVISIONABILI = [
  'superfici',
  'totaleLordoManuale',
  'totaleLordoTesto',
  'serramenti',
  'perimetro',
  'pareti',
  'falde',
  'travi',
] as const satisfies readonly (keyof StatoForm)[]

function senzaGeometria(parziale: Partial<StatoForm>): Partial<StatoForm> {
  const risultato = { ...parziale }
  for (const campo of CAMPI_GEOMETRIA_NON_REVISIONABILI) delete risultato[campo]
  return risultato
}

export default function NuovoPreventivoV3() {
  const [aggiornamentoEsterno, setAggiornamentoEsterno] = useState<
    { versione: number; parziale: Partial<StatoForm> } | undefined
  >()
  const [salvataggio, setSalvataggio] = useState<{ id: string; numero: number } | undefined>()

  return (
    <div className="mx-auto max-w-[1400px] px-6 pt-6">
      <Breadcrumb
        voci={[
          { label: 'Home', href: '/' },
          { label: 'Preventivi', href: '/preventivi' },
          { label: 'Nuovo preventivo (da computo metrico)' },
        ]}
      />
      <ChatApertura
        onEstrazioneCompletata={(parziale) => {
          setAggiornamentoEsterno((precedente) => ({
            versione: (precedente?.versione ?? 0) + 1,
            parziale: senzaGeometria(parziale),
          }))
        }}
      />
      <WizardConSalvataggioV3
        statoIniziale={STATO_INIZIALE_VUOTO}
        aggiornamentoEsterno={aggiornamentoEsterno}
        preventivoEsistente={salvataggio}
        onSalvato={setSalvataggio}
      />
    </div>
  )
}
