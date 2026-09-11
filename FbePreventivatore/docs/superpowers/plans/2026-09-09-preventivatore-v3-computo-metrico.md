# Preventivatore v3 (chat + computo metrico) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una terza versione del wizard (`/preventivi/nuovo-v3`) che tiene la
chat di apertura come la v1 e sostituisce, voce per voce, il calcolo parametrico da
geometria con gli importi ricavati dal computo metrico Primus già caricato/riconciliato
nella pagina `/preventivi/conteggi`.

**Architecture:** Nuova cartella `src/app/preventivi/nuovo-v3/` che duplica lo scheletro
di `nuovo/` (pagina, `FormStrutturato`, `WizardConSalvataggio`) invece di parametrizzare
i componenti condivisi — stessa convenzione già in uso fra `nuovo/` e `nuovo-v2/`. Un
nuovo step "Computo metrico" riusa senza modifiche i componenti già scritti e testati
della pagina `/preventivi/conteggi` (`CaricamentoComputo`, `SchedaVoce`,
`Riconciliazione`, `eseguiConteggio`) e scrive il risultato in `stato.overrides` con lo
stesso meccanismo (`aggiorna`) già usato da `StepPrezzi` per gli override manuali — non
tramite `aggiornamentoEsterno`, che farebbe un merge shallow e sovrascriverebbe l'intero
oggetto `overrides` invece di fonderlo voce per voce. Nessuna modifica a v1, v2, al
motore di calcolo (`src/domain/calcolo.ts`, `src/domain/listino.ts`,
`src/domain/voci.ts`) o alle regole di conteggio (`src/domain/computo/*`).

**Tech Stack:** Next.js (App Router), React, TypeScript, Vitest, TailwindCSS. Nessuna
nuova dipendenza.

**Spec:** `docs/superpowers/specs/2026-09-09-preventivatore-v3-computo-metrico-design.md`

## Global Constraints

- Vincolo CLAUDE.md #1: gli sconti sono a cascata, non additivi — invariato,
  `applicaScontiACascata` non viene toccata da questo piano.
- Vincolo CLAUDE.md #4: nessun testo può citare un numero di voce come costante — il
  nuovo step riusa `NUMERO_MASTER`/la numerazione a runtime già esistenti, non ne
  introduce di nuove.
- Vincolo CLAUDE.md #5: solo i numeri entrano nelle somme — un importo `'compresa'` dal
  conteggio deve diventare `'comprese'` nel wizard, non `0`.
- Vincolo CLAUDE.md #7: ogni importo mostra la provenienza `proposto | manuale |
  ripartito` — un valore scritto in `stato.overrides` è, ed è mostrato come, `'manuale'`.
  Questo piano non introduce un quarto valore.
- Formato importi italiano (`96 100,00 €`) per qualunque nuova UI: riusata da
  `formattaEuro`/`formattaQuantita` già importati dai componenti di `conteggi/`.
- v1 (`nuovo/`) e v2 (`nuovo-v2/`) restano bit-per-bit invariate: nessun file al loro
  interno viene modificato da questo piano.

---

## File Structure

```
src/app/preventivi/
  WizardConSalvataggioV3.tsx        — nuovo, copia di WizardConSalvataggio.tsx
  nuovo-v3/
    page.tsx                        — nuovo
    FormStrutturatoV3.tsx           — nuovo, copia di nuovo/FormStrutturato.tsx + 1 step
    mappa-conteggio.ts              — nuovo, logica pura di traduzione conteggio→override
    mappa-conteggio.test.ts         — nuovo
    steps/
      StepComputoMetrico.tsx        — nuovo
src/app/page.tsx                    — modificato: aggiunta la terza tile
```

Nessun altro file viene creato o modificato.

---

### Task 1: `mappaConteggioAOverride` — logica pura di traduzione

**Files:**
- Create: `src/app/preventivi/nuovo-v3/mappa-conteggio.ts`
- Test: `src/app/preventivi/nuovo-v3/mappa-conteggio.test.ts`

**Interfaces:**
- Consumes: `CATALOGO_VOCI` da `@/domain/voci` (esistente); `VoceConteggiata` da
  `@/domain/computo/regole-conteggio` (esistente); `StatoForm` da `../nuovo/stato-form`
  (esistente, per il tipo di `overrides`).
- Produces: `mappaConteggioAOverride(voci: VoceConteggiata[], overridesAttuali:
  StatoForm['overrides']): { overrides: StatoForm['overrides']; vociScartate: string[] }`
  — usata dal Task 2 (`StepComputoMetrico`).

- [x] **Step 1: Scrivi il test che fallisce**

Crea `src/app/preventivi/nuovo-v3/mappa-conteggio.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { mappaConteggioAOverride } from './mappa-conteggio'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'

function voceConteggiata(parziale: Partial<VoceConteggiata>): VoceConteggiata {
  return {
    idMaster: 'pareti-mhm',
    descrizione: '',
    passaggi: [],
    formula: '',
    importo: 0,
    provenienza: 'calcolato',
    ...parziale,
  }
}

describe('mappaConteggioAOverride', () => {
  it('scrive un override numerico per una voce presente nel catalogo', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 127543.28 })],
      {},
    )
    expect(esito.overrides['pareti-mhm']).toBe(127543.28)
    expect(esito.vociScartate).toEqual([])
  })

  it("converte l'importo 'compresa' del conteggio in 'comprese' del wizard", () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'solaio-interpiano', importo: 'compresa' })],
      {},
    )
    expect(esito.overrides['solaio-interpiano']).toBe('comprese')
  })

  it('non sovrascrive un override già presente per una voce che il conteggio non tocca', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 })],
      { garage: 12000 },
    )
    expect(esito.overrides.garage).toBe(12000)
    expect(esito.overrides['pareti-mhm']).toBe(100000)
  })

  it('scarta le voci del conteggio senza corrispondenza nel catalogo attuale', () => {
    const esito = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'copertura-piana', importo: 'compresa' })],
      {},
    )
    expect(esito.overrides['copertura-piana']).toBeUndefined()
    expect(esito.vociScartate).toEqual(['copertura-piana'])
  })

  it('un conteggio più recente sovrascrive un override scritto da un conteggio precedente', () => {
    const primo = mappaConteggioAOverride([voceConteggiata({ idMaster: 'pareti-mhm', importo: 100000 })], {})
    const secondo = mappaConteggioAOverride(
      [voceConteggiata({ idMaster: 'pareti-mhm', importo: 105000 })],
      primo.overrides,
    )
    expect(secondo.overrides['pareti-mhm']).toBe(105000)
  })
})
```

- [x] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- mappa-conteggio`
Expected: FAIL — `Cannot find module './mappa-conteggio'` (il file non esiste ancora).

- [x] **Step 3: Scrivi l'implementazione minima**

Crea `src/app/preventivi/nuovo-v3/mappa-conteggio.ts`:

```ts
import { CATALOGO_VOCI } from '@/domain/voci'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'
import type { StatoForm } from '../nuovo/stato-form'

const ID_CATALOGO = new Set(CATALOGO_VOCI.map((voce) => voce.id))

export interface EsitoMappaConteggio {
  overrides: StatoForm['overrides']
  vociScartate: string[]
}

/**
 * Traduce il risultato del conteggio in override del wizard. Il merge parte sempre da
 * `overridesAttuali`: una voce del conteggio non prevale mai su un override esistente
 * per una voce diversa (es. `garage`, digitato a mano in StepPrezzi), e un conteggio
 * più recente sovrascrive solo le chiavi che tocca lui stesso.
 */
export function mappaConteggioAOverride(
  voci: VoceConteggiata[],
  overridesAttuali: StatoForm['overrides'],
): EsitoMappaConteggio {
  const overrides = { ...overridesAttuali }
  const vociScartate: string[] = []

  for (const voce of voci) {
    if (!ID_CATALOGO.has(voce.idMaster)) {
      vociScartate.push(voce.idMaster)
      continue
    }
    overrides[voce.idMaster] = voce.importo === 'compresa' ? 'comprese' : voce.importo
  }

  return { overrides, vociScartate }
}
```

- [x] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- mappa-conteggio`
Expected: PASS — 5 test verdi.

- [x] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [x] **Step 6: Commit**

```bash
git add src/app/preventivi/nuovo-v3/mappa-conteggio.ts src/app/preventivi/nuovo-v3/mappa-conteggio.test.ts
git commit -m "feat(nuovo-v3): aggiungi la traduzione conteggio->override del wizard"
```

---

### Task 2: `StepComputoMetrico` — lo step del wizard

**Files:**
- Create: `src/app/preventivi/nuovo-v3/steps/StepComputoMetrico.tsx`

**Interfaces:**
- Consumes: `mappaConteggioAOverride` dal Task 1; `eseguiConteggio`,
  `RisultatoConteggio` da `@/domain/computo/conteggio` (esistenti); `Computo` da
  `@/domain/computo/estrai-voci` (esistente); `CaricamentoComputo`, `SchedaVoce`,
  `Riconciliazione`, `NUMERO_MASTER` da `../../conteggi/CaricamentoComputo`,
  `../../conteggi/SchedaVoce`, `../../conteggi/Riconciliazione`, `../../conteggi/page`
  (tutti esistenti, riusati senza modifiche); `Alert`, `Section` da `../../ui/Alert`,
  `../../ui/Section` (esistenti); `StatoForm` da `../../nuovo/stato-form` (esistente).
- Produces: `StepComputoMetrico({ stato, aggiorna }: { stato: StatoForm; aggiorna:
  (parziale: Partial<StatoForm>) => void }): JSX.Element` — usato dal Task 3
  (`FormStrutturatoV3`), con la stessa firma di ogni altro step (`StepGeometria`,
  `StepPrezzi`, …).

Non esiste infrastruttura di test per componenti React in questo repo (l'unico
`.test.tsx` del progetto copre una funzione pura accanto al componente, non il
rendering; `vitest.config.ts` gira in ambiente `node`, senza `@testing-library`) — la
stessa ragione per cui `CaricamentoComputo.tsx`, `SchedaVoce.tsx` e
`Riconciliazione.tsx` non hanno test propri. La logica testabile (Task 1) ha già i suoi
test; questo componente si verifica con typecheck/lint e con la verifica manuale del
Task 7.

- [x] **Step 1: Scrivi il componente**

Crea `src/app/preventivi/nuovo-v3/steps/StepComputoMetrico.tsx`:

```tsx
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CaricamentoComputo } from '../../conteggi/CaricamentoComputo'
import { SchedaVoce } from '../../conteggi/SchedaVoce'
import { Riconciliazione } from '../../conteggi/Riconciliazione'
import { NUMERO_MASTER } from '../../conteggi/page'
import { Alert } from '../../ui/Alert'
import { Section } from '../../ui/Section'
import { eseguiConteggio, type RisultatoConteggio } from '@/domain/computo/conteggio'
import type { Computo } from '@/domain/computo/estrai-voci'
import { mappaConteggioAOverride } from '../mappa-conteggio'
import type { StatoForm } from '../../nuovo/stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepComputoMetrico({ stato, aggiorna }: Props) {
  const [computo, setComputo] = useState<Computo | null>(null)
  const [nomeFile, setNomeFile] = useState<string | null>(null)
  const [overrideLocali, setOverrideLocali] = useState<Record<string, number>>({})
  const [vociScartate, setVociScartate] = useState<string[]>([])

  // eseguiConteggio può sollevare (voce con tariffa duplicata o mancante: cfr.
  // src/app/preventivi/conteggi/page.tsx), quindi va isolata in un try/catch invece di
  // lasciarla propagare fuori dal render di questo step.
  const { esito, erroreConteggio } = useMemo((): {
    esito: RisultatoConteggio | null
    erroreConteggio: string | null
  } => {
    if (!computo) return { esito: null, erroreConteggio: null }
    try {
      return { esito: eseguiConteggio(computo, overrideLocali), erroreConteggio: null }
    } catch (causa) {
      const messaggio = causa instanceof Error ? causa.message : 'Errore sconosciuto nel conteggio.'
      return { esito: null, erroreConteggio: messaggio }
    }
  }, [computo, overrideLocali])

  // Tiene sempre l'ultimo `stato.overrides` senza farne una dipendenza dell'effetto
  // sotto: l'effetto stesso scrive in `stato.overrides` tramite `aggiorna`, quindi
  // includerlo fra le dipendenze lo farebbe rieseguire a ogni scrittura che lui stesso
  // produce.
  const overridesAttuali = useRef(stato.overrides)
  overridesAttuali.current = stato.overrides

  useEffect(() => {
    if (!esito) return
    const risultato = mappaConteggioAOverride(esito.voci, overridesAttuali.current)
    aggiorna({ overrides: risultato.overrides })
    setVociScartate(risultato.vociScartate)
  }, [esito, aggiorna])

  return (
    <Section title="Computo metrico">
      <p className="mb-4 text-sm text-text-secondary">
        Carica il computo Primus del progetto: gli importi delle voci coperte dal
        conteggio sovrascrivono la proposta del listino parametrico. Le voci non
        coperte dal conteggio (es. garage) restano quelle impostate nello step
        &quot;Prezzi&quot;.
      </p>

      <CaricamentoComputo
        computo={computo}
        nomeFile={nomeFile}
        onComputo={(estratto, nome) => {
          setComputo(estratto)
          setNomeFile(nome)
          setOverrideLocali({})
        }}
      />

      {erroreConteggio && <Alert variant="errore">{erroreConteggio}</Alert>}

      {vociScartate.length > 0 && (
        <div className="mt-4">
          <Alert variant="avviso">
            Queste voci del computo non hanno una voce corrispondente nel catalogo
            attuale e non sono state applicate al preventivo: {vociScartate.join(', ')}.
          </Alert>
        </div>
      )}

      {esito && (
        <>
          {esito.avvisi.length > 0 && (
            <ul className="mt-4 space-y-2">
              {esito.avvisi.map((avviso, indice) => (
                <li key={`${avviso.codice}-${indice}`}>
                  <Alert variant={avviso.livello === 'errore' ? 'errore' : 'avviso'}>
                    {avviso.messaggio}
                  </Alert>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-col gap-4">
            {esito.voci.map((voce) => (
              <SchedaVoce
                key={voce.idMaster}
                voce={voce}
                numero={NUMERO_MASTER[voce.idMaster] ?? ''}
                onOverride={(id, importo) =>
                  setOverrideLocali((precedente) => ({ ...precedente, [id]: importo }))
                }
                onRipristina={(id) =>
                  setOverrideLocali((precedente) => {
                    const successivo = { ...precedente }
                    delete successivo[id]
                    return successivo
                  })
                }
              />
            ))}
          </div>

          <Riconciliazione esito={esito} totaleComputo={computo!.totale} numeroMaster={NUMERO_MASTER} />
        </>
      )}
    </Section>
  )
}
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore. Se compare un errore sul tipo di `aggiorna` nella dipendenza
dell'effetto (`aggiorna` cambia identità a ogni render del genitore), non correggerlo
qui: è il Task 3 a rendere `aggiorna` stabile in `FormStrutturatoV3` con `useCallback` —
questo componente lo assume stabile, come fa ogni altro step.

- [x] **Step 3: Lint**

Run: `npm run lint`
Expected: nessun errore su questo file.

- [x] **Step 4: Commit**

```bash
git add src/app/preventivi/nuovo-v3/steps/StepComputoMetrico.tsx
git commit -m "feat(nuovo-v3): aggiungi lo step Computo metrico del wizard"
```

---

### Task 3: `FormStrutturatoV3` — il wizard a 7 step

**Files:**
- Create: `src/app/preventivi/nuovo-v3/FormStrutturatoV3.tsx`

**Interfaces:**
- Consumes: `StepComputoMetrico` dal Task 2; `StepAnagrafica`, `StepConfigurazione`,
  `StepGeometria`, `StepPrezzi`, `StepCondizioni`, `StepCondizioniContrattuali` da
  `../nuovo/steps/...` (esistenti, import diretto — **non** duplicati);
  `CARATTERISTICHE_DEFAULT`, `OGGETTO_STANDARD`, `StatoForm` da `../nuovo/stato-form`
  (esistenti); `CONDIZIONI_DEFAULT` da `@/documento/condizioni-default` (esistente);
  `StepTabs` da `../ui/StepTabs` (esistente).
- Produces: `FormStrutturatoV3({ statoIniziale, aggiornamentoEsterno, onCambiamento }):
  JSX.Element` — stessa firma di `FormStrutturato`, usato dal Task 4
  (`WizardConSalvataggioV3`).

**Perché `aggiorna` diventa `useCallback` qui e non nell'originale**: in
`FormStrutturato` (v1) nessuno step scrive in `stato` da un `useEffect`, quindi la
nuova identità di `aggiorna` a ogni render è innocua. `StepComputoMetrico` (Task 2)
invece la mette nelle dipendenze del proprio effetto: senza `useCallback`, ogni chiamata
a `aggiorna` produrrebbe un nuovo `stato` → un nuovo render del genitore → una nuova
identità di `aggiorna` → l'effetto rieseguirebbe subito, in un loop. Il corpo di
`aggiorna` non legge `stato` dalla chiusura (usa la forma a updater di `setStato`),
quindi può essere reso stabile con `useCallback(fn, [])` senza cambiarne il
comportamento.

- [x] **Step 1: Scrivi il componente**

Crea `src/app/preventivi/nuovo-v3/FormStrutturatoV3.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { StepTabs } from '../ui/StepTabs'
import { StepAnagrafica } from '../nuovo/steps/StepAnagrafica'
import { StepConfigurazione } from '../nuovo/steps/StepConfigurazione'
import { StepGeometria } from '../nuovo/steps/StepGeometria'
import { StepComputoMetrico } from './steps/StepComputoMetrico'
import { StepPrezzi } from '../nuovo/steps/StepPrezzi'
import { StepCondizioni } from '../nuovo/steps/StepCondizioni'
import { StepCondizioniContrattuali } from '../nuovo/steps/StepCondizioniContrattuali'
import { CARATTERISTICHE_DEFAULT, OGGETTO_STANDARD, type StatoForm } from '../nuovo/stato-form'
import { CONDIZIONI_DEFAULT } from '@/documento/condizioni-default'

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
  condizioni: CONDIZIONI_DEFAULT,
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  aggiornamentoEsterno?: { versione: number; parziale: Partial<StatoForm> }
  onCambiamento: (stato: StatoForm) => void
}

const STEP_TITOLI = [
  'Anagrafica',
  'Configurazione',
  'Geometria',
  'Computo metrico',
  'Prezzi',
  'Condizioni',
  'Condizioni contrattuali',
]

export function FormStrutturatoV3({ statoIniziale, aggiornamentoEsterno, onCambiamento }: Props) {
  const [step, setStep] = useState(0)
  const [stato, setStato] = useState<StatoForm>({ ...STATO_INIZIALE, ...statoIniziale })

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
      {step === 2 && <StepGeometria stato={stato} aggiorna={aggiorna} />}
      {step === 3 && <StepComputoMetrico stato={stato} aggiorna={aggiorna} />}
      {step === 4 && <StepPrezzi stato={stato} aggiorna={aggiorna} />}
      {step === 5 && <StepCondizioni stato={stato} aggiorna={aggiorna} />}
      {step === 6 && <StepCondizioniContrattuali stato={stato} aggiorna={aggiorna} />}
    </div>
  )
}
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [x] **Step 3: Lint**

Run: `npm run lint`
Expected: nessun errore.

- [x] **Step 4: Commit**

```bash
git add src/app/preventivi/nuovo-v3/FormStrutturatoV3.tsx
git commit -m "feat(nuovo-v3): aggiungi FormStrutturatoV3 con lo step Computo metrico"
```

---

### Task 4: `WizardConSalvataggioV3`

**Files:**
- Create: `src/app/preventivi/WizardConSalvataggioV3.tsx`

**Interfaces:**
- Consumes: `FormStrutturatoV3` dal Task 3; `eseguiCalcolo` da `@/domain/calcolo`
  (esistente); `Button`, `Alert`, `PulsanteGeneraDocumento` da `./ui/...` (esistenti);
  `PannelloPreview` da `./nuovo/PannelloPreview` (esistente); `inputCalcoloDaStato`,
  `StatoForm` da `./nuovo/stato-form` (esistenti).
- Produces: `WizardConSalvataggioV3({ statoIniziale, aggiornamentoEsterno,
  preventivoEsistente, onSalvato }): JSX.Element` — stessa firma di
  `WizardConSalvataggio`, usato dal Task 5 (`nuovo-v3/page.tsx`).

- [x] **Step 1: Scrivi il componente**

Crea `src/app/preventivi/WizardConSalvataggioV3.tsx` (identico a
`WizardConSalvataggio.tsx`, con un solo import cambiato):

```tsx
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
        <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
          {stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}
        </div>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [x] **Step 3: Commit**

```bash
git add src/app/preventivi/WizardConSalvataggioV3.tsx
git commit -m "feat(nuovo-v3): aggiungi WizardConSalvataggioV3"
```

---

### Task 5: pagina `/preventivi/nuovo-v3`

**Files:**
- Create: `src/app/preventivi/nuovo-v3/page.tsx`

**Interfaces:**
- Consumes: `WizardConSalvataggioV3` dal Task 4; `ChatApertura` da `../nuovo/ChatApertura`
  (esistente, invariata); `Breadcrumb` da `../ui/Breadcrumb` (esistente); `StatoForm` da
  `../nuovo/stato-form` (esistente).
- Produces: pagina Next.js montata su `/preventivi/nuovo-v3`, usata dal Task 6 (link
  dashboard).

- [x] **Step 1: Scrivi la pagina**

Crea `src/app/preventivi/nuovo-v3/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChatApertura } from '../nuovo/ChatApertura'
import { WizardConSalvataggioV3 } from '../WizardConSalvataggioV3'
import { Breadcrumb } from '../ui/Breadcrumb'
import type { StatoForm } from '../nuovo/stato-form'

const STATO_INIZIALE_VUOTO: Partial<StatoForm> = {}

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
          setAggiornamentoEsterno((precedente) => ({ versione: (precedente?.versione ?? 0) + 1, parziale }))
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
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: nessun errore.

- [x] **Step 3: Verifica manuale rapida**

Run: `npm run dev`, apri `http://localhost:3000/preventivi/nuovo-v3` nel browser.
Expected: la pagina carica, mostra la chat di apertura sopra e il wizard con 7 tab
("Computo metrico" fra "Geometria" e "Prezzi") sotto, senza errori in console.

- [x] **Step 4: Commit**

```bash
git add src/app/preventivi/nuovo-v3/page.tsx
git commit -m "feat(nuovo-v3): aggiungi la pagina /preventivi/nuovo-v3"
```

---

### Task 6: link dalla dashboard

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: nessuna nuova — solo un `<Link href="/preventivi/nuovo-v3">` verso la
  pagina del Task 5.
- Produces: punto di ingresso visibile in home.

- [x] **Step 1: Aggiungi la terza tile nella sezione "Genera un preventivo"**

In `src/app/page.tsx`, dopo il blocco `<Link href="/preventivi/nuovo-v2">...</Link>`
(righe 25-33) e prima della chiusura del `<div className="grid gap-4 sm:grid-cols-2">`
(riga 34), aggiungi:

```tsx
          <Link
            href="/preventivi/nuovo-v3"
            className="flex flex-col gap-2 rounded-lg border border-border-warm bg-white p-6 transition-colors hover:border-accent"
          >
            <span className="text-lg font-semibold text-text">Nuovo preventivo (da computo metrico)</span>
            <span className="text-sm text-text-secondary">
              Chat di apertura come nel wizard classico, con gli importi delle voci
              ricavati dal computo Primus invece che dalla geometria
            </span>
          </Link>
```

Il file risultante ha quindi tre `<Link>` nella griglia `sm:grid-cols-2` (il terzo va
semplicemente a capo, la griglia non richiede modifiche).

- [x] **Step 2: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: nessun errore.

- [x] **Step 3: Verifica manuale**

Con `npm run dev` attivo, apri `http://localhost:3000/` e verifica che la nuova tile
compaia e che il click porti a `/preventivi/nuovo-v3`.

- [x] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(nuovo-v3): aggiungi il link dalla dashboard"
```

---

### Task 7: verifica end-to-end e commit finale

**Files:** nessuno (solo verifica).

**Interfaces:** nessuna — task di sola verifica.

- [x] **Step 1: Suite completa**

Run: `npm run typecheck && npm run lint && npm test`
Expected: tutto verde. Se `npm test` fallisce, il problema è quasi certamente
nell'`overrides` di `mappa-conteggio.test.ts` (Task 1) o in un import errato in uno dei
file nuovi — non nel motore di calcolo, che questo piano non tocca.

- [x] **Step 2: Verifica manuale con un computo reale**

Con `npm run dev` attivo:

1. Apri `http://localhost:3000/preventivi/nuovo-v3`.
2. Vai allo step "Configurazione" e imposta i livelli come nel golden case Crivellaro di
   `CLAUDE.md` (struttura completo, involucro completo, finiture impoverito — sono già i
   default).
3. Vai allo step "Computo metrico" e carica
   `Documentazione addestramento/Computo Crivellaro rev04.PDF.pdf` (presente in
   locale, non committato).
4. Verifica che compaiano le schede voce con tariffa/formula/risultato e la
   riconciliazione, esattamente come già succede in `/preventivi/conteggi` con lo
   stesso file.
5. Vai allo step "Prezzi": gli "Override voci di listino" per `pareti-mhm`,
   `copertura-falda`, `cappotto`, `cartongesso-q2`, `infissi-pvc`, `monoblocchi`,
   `trave-larice`, `solaio-interpiano`, `progettazione-esecutiva` devono mostrare i
   valori calcolati dal computo (non vuoti), mentre `garage` e `opere-chiavi-in-mano`
   restano vuoti/non toccati.
6. Nel pannello di anteprima (`PannelloPreview`, a destra), verifica che le voci
   provenienti dal computo siano marcate `manuale` e che i totali si aggiornino di
   conseguenza.

Se il file PDF non è disponibile in questo ambiente, esegui solo gli step 1-2 e 5-6
manualmente con override digitati a mano nello step "Prezzi" per simulare l'effetto, e
segnala esplicitamente che la verifica col PDF reale resta da fare.

- [x] **Step 3: Verifica che v1 e v2 restino invariate**

Run: `git diff --stat main -- src/app/preventivi/nuovo/ src/app/preventivi/nuovo-v2/ src/app/preventivi/WizardConSalvataggio.tsx`
Expected: nessuna riga di output (nessuna modifica ai file di v1/v2).

- [x] **Step 4: Commit finale (se sono rimaste modifiche non committate)**

```bash
git status
```

Se ci sono file non ancora committati dai task precedenti, aggiungili e crea un commit
descrittivo finale; altrimenti questo task non produce nessun commit.

---

## Stato: piano completato (2026-09-11)

Tutti i task sono implementati e committati (`page.tsx`, `FormStrutturatoV3.tsx`,
`StepComputoMetrico.tsx`, `mappa-conteggio.ts`, link dashboard). Verifica finale rieseguita
l'11/09/2026:

- `npm run typecheck && npm test`: verdi (361 test Vitest).
- `npm run lint`: 0 errori (6 warning preesistenti, non introdotti da questo piano).
- `git diff --stat main -- src/app/preventivi/nuovo/ src/app/preventivi/nuovo-v2/
  src/app/preventivi/WizardConSalvataggio.tsx`: nessun output — v1/v2 invariate.
- Verifica manuale col PDF reale Crivellaro (Step 2): schede voce, riconciliazione e
  override in "Prezzi" (`pareti-mhm`, `copertura-falda`, `cappotto`, `cartongesso-q2`,
  `infissi-pvc`, `monoblocchi`, `trave-larice`, `solaio-interpiano`,
  `progettazione-esecutiva` valorizzati; `garage` e `opere-chiavi-in-mano` vuoti) confermata
  in browser — vedi [`testing-computo-metrico-nuovo-v3.md`](../../testing-computo-metrico-nuovo-v3.md).
  La marcatura `manuale` in "Prezzi"/`PannelloPreview` non è stata ri-verificata a schermo in
  questa sessione, ma quei componenti sono `StepPrezzi`/`PannelloPreview` di v1, non toccati
  da questo piano (vedi il diff sopra) e già coperti dai loro test.
- Aggiunta, oltre a quanto previsto dal piano originale, una suite E2E Playwright
  (`npm run test:e2e`, [`e2e/computo-metrico-golden-cases.spec.ts`](../../../e2e/computo-metrico-golden-cases.spec.ts))
  che copre entrambi i golden case (Crivellaro rev.04, Da Croce rev.03) end-to-end nel
  browser reale, non prevista nel piano ma naturale estensione dello Step 2 di questo task.
