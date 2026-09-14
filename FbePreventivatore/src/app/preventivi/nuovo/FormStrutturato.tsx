'use client'

import { useEffect, useRef, useState } from 'react'
import { StepTabs } from '../ui/StepTabs'
import { StepAnagrafica } from './steps/StepAnagrafica'
import { StepConfigurazione } from './steps/StepConfigurazione'
import { StepGeometria } from './steps/StepGeometria'
import { StepPrezzi } from './steps/StepPrezzi'
import { StepCondizioni } from './steps/StepCondizioni'
import { StepCondizioniContrattuali } from './steps/StepCondizioniContrattuali'
import { CARATTERISTICHE_DEFAULT, OGGETTO_STANDARD, type StatoForm } from './stato-form'
import { creaCondizioniDefault } from '@/documento/condizioni-default'

// `condizioni` qui è solo un placeholder per far quadrare il tipo: STATO_INIZIALE è un
// modulo caricato una volta sola, quindi una `creaCondizioniDefault()` chiamata qui
// congelerebbe "oggi" al boot invece che al montaggio del wizard. Il valore vero si calcola
// nell'inizializzatore lazy di useState qui sotto, e lo sovrascrive.
const STATO_INIZIALE: StatoForm = {
  cliente: { nome: '', comune: '', provincia: '' },
  protocollo: '',
  oggetto: OGGETTO_STANDARD,
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
  condizioni: creaCondizioniDefault(),
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  aggiornamentoEsterno?: { versione: number; parziale: Partial<StatoForm> }
  onCambiamento: (stato: StatoForm) => void
}

const STEP_TITOLI = ['Anagrafica', 'Configurazione', 'Geometria', 'Prezzi', 'Condizioni', 'Condizioni contrattuali']

export function FormStrutturato({ statoIniziale, aggiornamentoEsterno, onCambiamento }: Props) {
  const [step, setStep] = useState(0)
  const [stato, setStato] = useState<StatoForm>(() => ({
    ...STATO_INIZIALE,
    condizioni: creaCondizioniDefault(),
    ...statoIniziale,
  }))

  // Unico punto che notifica il genitore: gira dopo il render (mai durante), a ogni
  // cambio di stato — mount incluso. Prima onCambiamento veniva chiamato anche dentro
  // l'updater di setStato per il merge esterno, il che è "setState di un altro
  // componente durante il render di questo" (warning React reale, non solo teorico).
  useEffect(() => {
    onCambiamento(stato)
  }, [stato, onCambiamento])

  // Le risposte successive dell'Apertura rapida (follow-up della chat) arrivano come
  // patch da fondere nello stato corrente, non come un nuovo statoIniziale da rimontare:
  // altrimenti ogni follow-up azzererebbe sconti/override/totale target già inseriti a
  // mano nei tab successivi (bug reale trovato nel review finale del piano SDD).
  const versioneApplicata = useRef(aggiornamentoEsterno?.versione ?? 0)
  useEffect(() => {
    if (!aggiornamentoEsterno || aggiornamentoEsterno.versione === versioneApplicata.current) return
    versioneApplicata.current = aggiornamentoEsterno.versione
    setStato((precedente) => ({ ...precedente, ...aggiornamentoEsterno.parziale }))
  }, [aggiornamentoEsterno])

  function aggiorna(parziale: Partial<StatoForm>) {
    setStato((precedente) => ({ ...precedente, ...parziale }))
  }

  return (
    <div>
      <StepTabs titoli={STEP_TITOLI} stepCorrente={step} onSeleziona={setStep} />
      {step === 0 && <StepAnagrafica stato={stato} aggiorna={aggiorna} />}
      {step === 1 && <StepConfigurazione stato={stato} aggiorna={aggiorna} />}
      {step === 2 && <StepGeometria stato={stato} aggiorna={aggiorna} />}
      {step === 3 && <StepPrezzi stato={stato} aggiorna={aggiorna} />}
      {step === 4 && <StepCondizioni stato={stato} aggiorna={aggiorna} />}
      {step === 5 && <StepCondizioniContrattuali stato={stato} aggiorna={aggiorna} />}
    </div>
  )
}
