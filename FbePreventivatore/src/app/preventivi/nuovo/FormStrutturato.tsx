'use client'

import { useState } from 'react'
import { StepTabs } from '../ui/StepTabs'
import { StepAnagrafica } from './steps/StepAnagrafica'
import { StepConfigurazione } from './steps/StepConfigurazione'
import { StepGeometria } from './steps/StepGeometria'
import { StepPrezzi } from './steps/StepPrezzi'
import { StepCondizioni } from './steps/StepCondizioni'
import type { StatoForm } from './stato-form'

const STATO_INIZIALE: StatoForm = {
  cliente: { nome: '', comune: '', provincia: '' },
  protocollo: '',
  oggetto: '',
  progettista: '',
  data: new Date().toISOString().slice(0, 10),
  luogo: '',
  superfici: [],
  serramenti: [],
  perimetro: 0,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  chiaviInManoNelTotale: false,
  sconti: [],
  overrides: {},
  totaleTarget: 0,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: { copertura: 'falde', manto: 'Tegole in cemento', finituraEsterna: 'intonaco', tetto: 'Tetto con travi e perline in abete' },
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  onCambiamento: (stato: StatoForm) => void
}

const STEP_TITOLI = ['Anagrafica', 'Configurazione', 'Geometria', 'Prezzi', 'Condizioni']

export function FormStrutturato({ statoIniziale, onCambiamento }: Props) {
  const [step, setStep] = useState(0)
  const [stato, setStato] = useState<StatoForm>({ ...STATO_INIZIALE, ...statoIniziale })

  function aggiorna(parziale: Partial<StatoForm>) {
    const nuovo = { ...stato, ...parziale }
    setStato(nuovo)
    onCambiamento(nuovo)
  }

  return (
    <div>
      <StepTabs titoli={STEP_TITOLI} stepCorrente={step} onSeleziona={setStep} />
      {step === 0 && <StepAnagrafica stato={stato} aggiorna={aggiorna} />}
      {step === 1 && <StepConfigurazione stato={stato} aggiorna={aggiorna} />}
      {step === 2 && <StepGeometria stato={stato} aggiorna={aggiorna} />}
      {step === 3 && <StepPrezzi stato={stato} aggiorna={aggiorna} />}
      {step === 4 && <StepCondizioni stato={stato} aggiorna={aggiorna} />}
    </div>
  )
}
