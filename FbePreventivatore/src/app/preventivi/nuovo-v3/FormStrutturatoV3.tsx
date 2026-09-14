'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { StepTabs } from '../ui/StepTabs'
import { StepAnagrafica } from '../nuovo/steps/StepAnagrafica'
import { StepConfigurazione } from '../nuovo/steps/StepConfigurazione'
import { StepComputoMetrico } from './steps/StepComputoMetrico'
import { StepPrezzi } from '../nuovo/steps/StepPrezzi'
import { StepCondizioni } from '../nuovo/steps/StepCondizioni'
import { StepCondizioniContrattuali } from '../nuovo/steps/StepCondizioniContrattuali'
import { CARATTERISTICHE_DEFAULT, OGGETTO_STANDARD, type StatoForm } from '../nuovo/stato-form'
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

// Niente step "Geometria" in questa versione (rimosso su richiesta esplicita): superfici,
// perimetro e serramenti restano ai default vuoti/0 di STATO_INIZIALE per l'intera sessione,
// quindi numeroPianiAbitativi/superficieGarage in StepComputoMetrico sono sempre 0 — le voci
// 'solaio-interpiano' e 'garage' sono perciò sempre escluse dal preventivo, anche quando il
// computo caricato le valorizza (vedi l'avviso "escluse dalla configurazione attuale" in
// StepComputoMetrico.tsx).
const STEP_TITOLI = ['Anagrafica', 'Configurazione', 'Computo metrico', 'Prezzi', 'Condizioni', 'Condizioni contrattuali']

export function FormStrutturatoV3({ statoIniziale, aggiornamentoEsterno, onCambiamento }: Props) {
  const [step, setStep] = useState(0)
  const [stato, setStato] = useState<StatoForm>(() => ({
    ...STATO_INIZIALE,
    condizioni: creaCondizioniDefault(),
    ...statoIniziale,
  }))

  useEffect(() => {
    onCambiamento(stato)
  }, [stato, onCambiamento])

  const versioneApplicata = useRef(aggiornamentoEsterno?.versione ?? 0)
  useEffect(() => {
    if (!aggiornamentoEsterno || aggiornamentoEsterno.versione === versioneApplicata.current) return
    versioneApplicata.current = aggiornamentoEsterno.versione
    setStato((precedente) => ({ ...precedente, ...aggiornamentoEsterno.parziale }))
  }, [aggiornamentoEsterno])

  // useCallback (a differenza di FormStrutturato v1): StepComputoMetrico mette
  // `aggiorna` fra le dipendenze del proprio effetto, e il corpo qui sotto non legge
  // `stato` dalla chiusura (usa la forma a updater), quindi renderlo stabile non ne
  // cambia il comportamento — vedi nota del Task 3 nel piano.
  const aggiorna = useCallback((parziale: Partial<StatoForm>) => {
    setStato((precedente) => ({ ...precedente, ...parziale }))
  }, [])

  return (
    <div>
      <StepTabs titoli={STEP_TITOLI} stepCorrente={step} onSeleziona={setStep} />
      {step === 0 && <StepAnagrafica stato={stato} aggiorna={aggiorna} />}
      {step === 1 && <StepConfigurazione stato={stato} aggiorna={aggiorna} />}
      {step === 2 && <StepComputoMetrico stato={stato} aggiorna={aggiorna} />}
      {step === 3 && <StepPrezzi stato={stato} aggiorna={aggiorna} />}
      {step === 4 && <StepCondizioni stato={stato} aggiorna={aggiorna} />}
      {step === 5 && <StepCondizioniContrattuali stato={stato} aggiorna={aggiorna} />}
    </div>
  )
}
