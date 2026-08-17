'use client'

import { useEffect, useRef, useState } from 'react'
import { StepTabs } from '../ui/StepTabs'
import { StepAnagrafica } from './steps/StepAnagrafica'
import { StepConfigurazione } from './steps/StepConfigurazione'
import { StepGeometria } from './steps/StepGeometria'
import { StepPrezzi } from './steps/StepPrezzi'
import { StepCondizioni } from './steps/StepCondizioni'
import { CARATTERISTICHE_DEFAULT, type StatoForm } from './stato-form'

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
  caratteristiche: CARATTERISTICHE_DEFAULT,
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  onCambiamento: (stato: StatoForm) => void
}

const STEP_TITOLI = ['Anagrafica', 'Configurazione', 'Geometria', 'Prezzi', 'Condizioni']

export function FormStrutturato({ statoIniziale, onCambiamento }: Props) {
  const [step, setStep] = useState(0)
  const [stato, setStato] = useState<StatoForm>({ ...STATO_INIZIALE, ...statoIniziale })

  // Il genitore (WizardConSalvataggio) non conosce lo stato iniziale unito: la sua
  // preview resta vuota finché non arriva la prima aggiorna(). Riapertura di una
  // bozza o precompilazione da AI atterrano qui senza nessun edit dell'utente.
  const notificatoIniziale = useRef(false)
  useEffect(() => {
    if (notificatoIniziale.current) return
    notificatoIniziale.current = true
    onCambiamento(stato)
  }, [stato, onCambiamento])

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
