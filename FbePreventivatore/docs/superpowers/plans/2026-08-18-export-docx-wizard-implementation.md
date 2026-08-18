# Collegare l'export DOCX al wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare all'utente del wizard un modo di scaricare `mod.05-COM` come `.docx`, raccogliendo nel form i dati che oggi mancano (condizioni contrattuali, superfici lorde in forma testuale) e collegando `esportaOfferta()` — oggi isolata — a una route API e a un pulsante nel wizard e nella pagina di revisione.

**Architecture:** Una nuova funzione pura `costruisciInputEsportazione(stato, revisioneMeta)` mappa `StatoForm` (esteso con un nuovo campo `condizioni`) su `InputEsportazione`, senza I/O. `export-docx.ts` si divide in `costruisciBufferOfferta` (puro, ritorna `Buffer`) e `esportaOfferta` (scrive su disco, usato solo dallo script CLI). Una route Next.js sottile incolla insieme: carica la revisione già persistita, chiama la funzione di mapping, chiama `costruisciBufferOfferta`, risponde con l'attachment o con 422 se l'export si rifiuta di generare un documento con placeholder non risolti. Un solo componente client (`PulsanteGeneraDocumento`) gestisce fetch+download+errore ed è riusato sia nel wizard che nella pagina di revisione di sola lettura.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Docxtemplater/PizZip (già in uso in `export-docx.ts`), Prisma 7 + adapter SQLite in-memory per i test di route (stesso pattern di `route.test.ts` esistenti).

**Spec di riferimento:** `docs/superpowers/specs/2026-08-17-export-docx-design.md`

## Global Constraints

Dal `CLAUDE.md` del progetto — si applicano a ogni task di questo piano:

- **Sconti a cascata, non additivi**: non toccato da questo piano (nessun task modifica `domain/calcolo.ts`).
- **Due gruppi di voci** (`GREZZO`/`POST_SCONTO`): non toccato — `costruisciInputEsportazione` passa `risultato` così com'è da `eseguiCalcolo`.
- **Il prezzo si riconcilia top-down**: non toccato — l'arrotondamento resta calcolato da `eseguiCalcolo`, mai ricalcolato nel mapping.
- **I numeri di voce si rinumerano al render**: nessun testo introdotto da questo piano cita un numero di voce come costante — i riferimenti (`riferimenti.tracciamentoImpianti` ecc.) restano calcolati in `export-docx.ts` come già oggi, non toccati.
- **L'importo di una voce non è sempre un numero**: `VoceOptionalForm`/`VoceEsclusioneForm` (Task 3) tipizzano `importo: number | string`, stesso principio di `overrides` in `StepPrezzi.tsx`.
- **La revisione congela il listino**: la route di export (Task 10) legge lo snapshot già persistito nella `Revisione` (stesso `caricaRevisione` della route GET esistente), mai il listino corrente — coerente con l'immutabilità già garantita da `aggiornaBozza`/`caricaRevisione`.
- **I numeri di voce/l'AI non decide i prezzi**: nessun task tocca `src/ai/estrazione.ts` o inventa importi — ogni importo nel nuovo step viene digitato dall'operatore o arriva dal listino esistente.
- **Formato importi italiano**: il nuovo step (Task 7) riusa lo stesso pattern di parsing/formattazione già in `StepPrezzi.tsx` (virgola decimale, nessun separatore delle migliaia in input).
- **Superfici come stringhe libere**: il nuovo campo `totaleLordoTesto` (Task 2, 4, 8) è pensato apposta per questo — resta editabile anche quando l'auto-suggerimento esiste già.

---

## Riferimento — tipi e funzioni esistenti richiamati da più task

Per evitare di ripeterli in ogni task, questi **esistono già** e vengono solo importati/estesi:

- `InputEsportazione`, `CondizioniOfferta`, `SalRata`, `VoceOpzionale`, `SuperficiOfferta`, `CaratteristicheOfferta` — `src/documento/export-docx.ts`
- `SAL_DEFAULT`, `SalDefault`, `CONDIZIONE_DA_DEFINIRE` — `src/documento/condizioni-default.ts`
- `StatoForm`, `pacchettoDaLivelli`, `inputCalcoloDaStato` — `src/app/preventivi/nuovo/stato-form.ts`
- `SuperficiePiano`, `PIANO_GARAGE`, `PIANI_CANONICI`, `totaleSuperficiLorde`, `risolviValoreLordo` — `src/domain/geometria.ts`
- `generaAbacoPerCategoria`, `AbacoPerCategoria` — `src/ai/abaco.ts`
- `formattaImportoItaliano` — `src/documento/preview/formattazione.ts`
- `caricaRevisione` — `src/server/preventivi-repo.ts` (ritorna `Revisione` con `include: { preventivo: { include: { cliente: true } } }`, quindi `revisione.preventivo.protocollo` è già disponibile)
- `deserializzaRevisione<T>` — `src/domain/persistenza.ts`
- `creaClientDiTest`, `applicaMigrazioni` — `src/server/test-db.ts` (pattern di test già usato da tutte le route esistenti — vedi `src/app/api/preventivi/[id]/revisioni/[numero]/route.test.ts`)
- `Field`, `controlClassName`, `Section`, `Button`, `Alert` — `src/app/preventivi/ui/`
- `aggiornaRiga`, `rimuoviRiga` — `src/app/preventivi/nuovo/riga-utils.ts`

**Deviazioni consapevoli dallo spec di design** (`2026-08-17-export-docx-design.md`), emerse leggendo il codice reale prima di scrivere questo piano:

1. Lo spec dice che consegna/caparra/validità sono "obbligatori con la stessa convenzione di validazione già usata negli altri step (blocco avanzamento step)". **Questa convenzione non esiste**: `StepTabs.tsx` non blocca mai il cambio tab, nessuno step attuale valida un campo obbligatorio. Questo piano tratta quei tre campi come semplici input, coerenti con ogni altro campo del wizard — niente blocco inventato ad hoc per un solo step.
2. Lo spec dice che il test della route deve "mock di `caricaRevisione`". Ogni test di route esistente nel progetto usa invece un DB SQLite in-memory reale (`creaClientDiTest`/`applicaMigrazioni`), mai un mock. Il Task 10 segue il pattern reale già in uso per restare coerente con gli altri test di route.
3. Lo spec dice "`StatoForm.superfici` guadagna un campo `totaleLordoTesto`" — ma `StatoForm.superfici` è un array (`SuperficiePiano[]`), non può "guadagnare un campo". Il campo va aggiunto a livello di `StatoForm`, come sibling di `totaleLordoManuale` (stesso pattern già esistente). Il Task 4 lo tratta così.
4. Il campo `abaco` di `InputEsportazione` è generato da `generaAbacoPerCategoria` (funzione pura, già testata in `src/ai/abaco.test.ts`), il cui formato di output (`n. {quantità} dim. {dim};`) **non coincide** con la stringa scritta a mano nella fixture di `export-docx.test.ts` ("n. 1 portoncini di ingresso dim. standard 100x220;" — quella fixture non è mai stata prodotta da quella funzione, è testo libero scelto per il test esistente). Il Task 6 verifica quindi `abaco` contro una chiamata diretta a `generaAbacoPerCategoria`, non contro quella stringa letterale.

---

### Task 1: Formattatore data italiana estesa

**Files:**
- Create: `src/documento/formatta-data-italiana.ts`
- Test: `src/documento/formatta-data-italiana.test.ts`

**Interfaces:**
- Produces: `formattaDataItaliana(dataIso: string, luogo: string): string` — usata dal Task 6.

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/documento/formatta-data-italiana.test.ts
import { describe, expect, it } from 'vitest'
import { formattaDataItaliana } from './formatta-data-italiana'

describe('formattaDataItaliana', () => {
  it('formatta una data ISO con mese in lettere e luogo davanti, come nel master (pag. 4)', () => {
    expect(formattaDataItaliana('2026-08-06', 'Castelgomberto')).toBe('Castelgomberto, 6 agosto 2026')
  })

  it('non aggiunge lo zero iniziale al giorno', () => {
    expect(formattaDataItaliana('2026-01-01', 'Trissino')).toBe('Trissino, 1 gennaio 2026')
  })

  it('copre tutti e 12 i mesi', () => {
    const mesi = [
      ['2026-01-15', 'gennaio'], ['2026-02-15', 'febbraio'], ['2026-03-15', 'marzo'],
      ['2026-04-15', 'aprile'], ['2026-05-15', 'maggio'], ['2026-06-15', 'giugno'],
      ['2026-07-15', 'luglio'], ['2026-08-15', 'agosto'], ['2026-09-15', 'settembre'],
      ['2026-10-15', 'ottobre'], ['2026-11-15', 'novembre'], ['2026-12-15', 'dicembre'],
    ] as const
    for (const [iso, nomeMese] of mesi) {
      expect(formattaDataItaliana(iso, 'Vicenza')).toBe(`Vicenza, 15 ${nomeMese} 2026`)
    }
  })

  it('conserva l\'anno esatto', () => {
    expect(formattaDataItaliana('2031-12-31', 'Roma')).toBe('Roma, 31 dicembre 2031')
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/documento/formatta-data-italiana.test.ts`
Expected: FAIL — `Cannot find module './formatta-data-italiana'` (il file non esiste ancora)

- [ ] **Step 3: Implementa**

```ts
// src/documento/formatta-data-italiana.ts

const MESI_ITALIANI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
] as const

/**
 * Split manuale invece di `new Date(dataIso)`: un ISO date-only interpretato come
 * UTC e poi letto con getDate()/getMonth() in un fuso orario diverso da UTC può
 * restituire il giorno prima — un bug di fuso invisibile finché qualcuno non lo
 * genera vicino a mezzanotte in un fuso a ovest di Greenwich.
 */
export function formattaDataItaliana(dataIso: string, luogo: string): string {
  const [anno, mese, giorno] = dataIso.split('-').map(Number)
  return `${luogo}, ${giorno} ${MESI_ITALIANI[mese - 1]} ${anno}`
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/documento/formatta-data-italiana.test.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Commit**

```bash
git add src/documento/formatta-data-italiana.ts src/documento/formatta-data-italiana.test.ts
git commit -m "feat(documento): aggiungi formattaDataItaliana per la data offerta"
```

---

### Task 2: Auto-suggerimento testo superfici lorde

**Files:**
- Modify: `src/domain/geometria.ts`
- Modify: `src/domain/geometria.test.ts`

**Interfaces:**
- Consumes: `SuperficiePiano`, `PIANO_GARAGE`, `totaleSuperficiLorde` (già in `geometria.ts`)
- Produces: `suggerisciTotaleLordoTesto(superfici: SuperficiePiano[], totaleLordoManuale?: number): string` — usata dal Task 6 (fallback) e dal Task 8 (placeholder nello step).

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `src/domain/geometria.test.ts` (stesso file, riusa `SUPERFICI_CRIVELLARO` già definita in cima al file):

```ts
describe('suggerisciTotaleLordoTesto', () => {
  it('unisce i piani non vuoti (Garage escluso) con "+" e aggiunge "= totale" — golden case Crivellaro', () => {
    expect(suggerisciTotaleLordoTesto(SUPERFICI_CRIVELLARO)).toBe('134+13+14= 161')
  })

  it('usa totaleLordoManuale al posto della somma calcolata, quando presente', () => {
    expect(suggerisciTotaleLordoTesto(SUPERFICI_CRIVELLARO, 310)).toBe('134+13+14= 310')
  })

  it('salta le righe con valoreLordo vuoto', () => {
    const superfici = [...SUPERFICI_CRIVELLARO, { piano: 'Piano Primo', valoreLordo: '' }]
    expect(suggerisciTotaleLordoTesto(superfici)).toBe('134+13+14= 161')
  })

  it('con nessun piano valorizzato produce solo "= totale"', () => {
    expect(suggerisciTotaleLordoTesto([{ piano: 'Piano Terra', valoreLordo: '' }])).toBe('= 0')
  })
})
```

E aggiungi `suggerisciTotaleLordoTesto` all'import in cima al file:

```ts
import {
  calcolaApertura,
  totaliSerramenti,
  DETRAZIONI_DEFAULT,
  risolviValoreLordo,
  totaleSuperficiLorde,
  suggerisciTotaleLordoTesto,
  superficieGarage,
  numeroPianiAbitativi,
  superficieSedime,
  normalizzaNomePiano,
  PIANI_CANONICI,
  type Serramento,
  type SuperficiePiano,
} from './geometria'
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/domain/geometria.test.ts`
Expected: FAIL — `suggerisciTotaleLordoTesto is not a function` (o errore di import)

- [ ] **Step 3: Implementa**

Aggiungi in fondo a `src/domain/geometria.ts` (dopo `superficieSedime`):

```ts
/**
 * Auto-suggerimento per `totaleLordoTesto` (spec §2, form): unisce i piani non
 * vuoti nell'ordine del form con '+' — stesso separatore che `risolviValoreLordo`
 * già sa interpretare — e aggiunge '= totale'. Resta un SUGGERIMENTO: il chiamante
 * (StepGeometria) lo usa come placeholder editabile, mai come valore imposto.
 */
export function suggerisciTotaleLordoTesto(superfici: SuperficiePiano[], totaleLordoManuale?: number): string {
  const totale = totaleLordoManuale ?? totaleSuperficiLorde(superfici)
  const pianiValorizzati = superfici
    .filter((s) => s.piano !== PIANO_GARAGE && s.valoreLordo.trim() !== '')
    .map((s) => s.valoreLordo)

  if (pianiValorizzati.length === 0) return `= ${totale}`
  return `${pianiValorizzati.join('+')}= ${totale}`
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/domain/geometria.test.ts`
Expected: PASS (tutti i test del file, inclusi i 4 nuovi)

- [ ] **Step 5: Commit**

```bash
git add src/domain/geometria.ts src/domain/geometria.test.ts
git commit -m "feat(geometria): aggiungi suggerisciTotaleLordoTesto per il campo superfici lorde testuale"
```

---

### Task 3: Tipi e default delle condizioni contrattuali

**Files:**
- Modify: `src/documento/condizioni-default.ts`
- Create: `src/documento/condizioni-default.test.ts`

**Interfaces:**
- Produces: `CondizioniForm`, `SalRataForm`, `VoceOptionalForm`, `VoceEsclusioneForm`, `CONDIZIONI_DEFAULT: CondizioniForm` — consumate da `StatoForm` (Task 4), dallo step (Task 7) e dal mapping (Task 6).

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/documento/condizioni-default.test.ts
import { describe, expect, it } from 'vitest'
import { CONDIZIONI_DEFAULT, SAL_DEFAULT } from './condizioni-default'

describe('CONDIZIONI_DEFAULT', () => {
  it('precompila sal da SAL_DEFAULT, rinominando milestone in descrizione', () => {
    expect(CONDIZIONI_DEFAULT.sal).toEqual(SAL_DEFAULT.map((s) => ({ percentuale: s.percentuale, descrizione: s.milestone })))
  })

  it('le percentuali di sal sommano a 100', () => {
    const somma = CONDIZIONI_DEFAULT.sal.reduce((tot, s) => tot + s.percentuale, 0)
    expect(somma).toBeCloseTo(1, 5)
  })

  it('consegna/validità partono vuote (nessun valore finto plausibile)', () => {
    expect(CONDIZIONI_DEFAULT.consegna).toBe('')
    expect(CONDIZIONI_DEFAULT.validita).toBe('')
  })

  it('caparra parte a 0', () => {
    expect(CONDIZIONI_DEFAULT.caparra).toBe(0)
  })

  it('optional ed esclusioni partono vuoti — un\'offerta può non averne', () => {
    expect(CONDIZIONI_DEFAULT.optional).toEqual([])
    expect(CONDIZIONI_DEFAULT.esclusioni).toEqual([])
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/documento/condizioni-default.test.ts`
Expected: FAIL — `CONDIZIONI_DEFAULT is not exported`

- [ ] **Step 3: Implementa**

Aggiungi in fondo a `src/documento/condizioni-default.ts` (dopo `CONDIZIONE_DA_DEFINIRE`, lasciando invariato tutto il resto del file):

```ts
export interface SalRataForm {
  percentuale: number
  descrizione: string
}

export interface VoceEsclusioneForm {
  descrizione: string
  importo: number | string
}

export interface VoceOptionalForm extends VoceEsclusioneForm {
  // Al più una riga alla volta nell'intera lista `optional` può averlo a true —
  // è l'unico id con un rimando nel testo fisso del master ({riferimenti.praticaGenioCivile}).
  // Il vincolo di esclusività si applica in StepCondizioniContrattuali, non qui.
  praticaGenioCivile?: boolean
}

export interface CondizioniForm {
  consegna: string
  caparra: number
  validita: string
  sal: SalRataForm[]
  optional: VoceOptionalForm[]
  esclusioni: VoceEsclusioneForm[]
}

/**
 * Default per il nuovo step "Condizioni contrattuali" del wizard. A differenza di
 * `CONDIZIONE_DA_DEFINIRE` (segnaposto di sola visualizzazione), questo è un valore
 * di STATO iniziale: consegna/caparra/validità partono vuoti/0 perché l'operatore li
 * compili, non perché restino permanentemente un placeholder.
 */
export const CONDIZIONI_DEFAULT: CondizioniForm = {
  consegna: '',
  caparra: 0,
  validita: '',
  sal: SAL_DEFAULT.map((s) => ({ percentuale: s.percentuale, descrizione: s.milestone })),
  optional: [],
  esclusioni: [],
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/documento/condizioni-default.test.ts`
Expected: PASS (5 test)

- [ ] **Step 5: Commit**

```bash
git add src/documento/condizioni-default.ts src/documento/condizioni-default.test.ts
git commit -m "feat(documento): aggiungi CondizioniForm e CONDIZIONI_DEFAULT per il nuovo step del wizard"
```

---

### Task 4: Estensione di `StatoForm` con `condizioni` e `totaleLordoTesto`

**Files:**
- Modify: `src/app/preventivi/nuovo/stato-form.ts`
- Modify: `src/app/preventivi/nuovo/stato-form.test.ts`
- Modify: `src/app/preventivi/nuovo/FormStrutturato.tsx`

**Interfaces:**
- Consumes: `CondizioniForm`, `CONDIZIONI_DEFAULT` (Task 3)
- Produces: `StatoForm.condizioni: CondizioniForm`, `StatoForm.totaleLordoTesto?: string` — consumati dal Task 6 (mapping), Task 7 (step condizioni), Task 8 (step geometria), Task 9 (preview).

- [ ] **Step 1: Aggiorna il tipo `StatoForm`**

In `src/app/preventivi/nuovo/stato-form.ts`, aggiungi l'import e i due campi:

```ts
import type { CondizioniForm } from '@/documento/condizioni-default'
```

(da aggiungere subito dopo gli import esistenti, in cima al file)

```ts
export interface StatoForm {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  oggetto: string
  progettista: string
  data: string
  luogo: string
  superfici: SuperficiePiano[]
  totaleLordoManuale?: number
  totaleLordoTesto?: string // NUOVO — testo libero per InputEsportazione.superfici.totaleLorda (spec §2)
  serramenti: Serramento[]
  perimetro: number
  livelli: Record<Modulo, LivelloModulo>
  chiaviInManoNelTotale: boolean
  sconti: ParametriSconto[]
  overrides: Record<string, number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'>
  totaleTarget: number
  sicurezza: Sicurezza
  caratteristiche: CaratteristicheCostruttive
  condizioni: CondizioniForm // NUOVO — spec §1/§3
}
```

- [ ] **Step 2: Verifica che il progetto NON compili ancora (i due usi di `StatoForm` letterale mancano del campo)**

Run: `npx tsc --noEmit`
Expected: FAIL — errori in `stato-form.test.ts` (`STATO_CRIVELLARO`) e `FormStrutturato.tsx` (`STATO_INIZIALE`): manca la proprietà `condizioni`.

- [ ] **Step 3: Aggiorna `STATO_CRIVELLARO` nel test**

In `src/app/preventivi/nuovo/stato-form.test.ts`, aggiungi l'import e il campo:

```ts
import { CONDIZIONI_DEFAULT } from '@/documento/condizioni-default'
```

```ts
const STATO_CRIVELLARO: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-07',
  luogo: 'Trissino',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [{ n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1, h: 2.2 }],
  perimetro: 60,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  chiaviInManoNelTotale: true,
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  overrides: {},
  totaleTarget: 300000,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
  },
  condizioni: CONDIZIONI_DEFAULT,
}
```

(unica modifica: aggiunta la riga `condizioni: CONDIZIONI_DEFAULT,` in fondo all'oggetto e il nuovo import in cima)

- [ ] **Step 4: Aggiorna `STATO_INIZIALE` in `FormStrutturato.tsx`**

In `src/app/preventivi/nuovo/FormStrutturato.tsx`, aggiungi l'import:

```ts
import { CONDIZIONI_DEFAULT } from '@/documento/condizioni-default'
```

E aggiungi il campo a `STATO_INIZIALE`:

```ts
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
```

- [ ] **Step 5: Verifica che il progetto compili e i test passino**

Run: `npx tsc --noEmit && npx vitest run src/app/preventivi/nuovo/stato-form.test.ts`
Expected: nessun errore di tipo, tutti i test PASS (il merge `{ ...STATO_INIZIALE, ...statoIniziale }` in `FormStrutturato.tsx:41` garantisce che le bozze salvate prima di questa modifica ricevano `CONDIZIONI_DEFAULT` al primo caricamento, perché il loro JSON salvato non ha la chiave `condizioni` e lo spread non la sovrascrive)

- [ ] **Step 6: Commit**

```bash
git add src/app/preventivi/nuovo/stato-form.ts src/app/preventivi/nuovo/stato-form.test.ts src/app/preventivi/nuovo/FormStrutturato.tsx
git commit -m "feat(wizard): aggiungi StatoForm.condizioni e totaleLordoTesto"
```

---

### Task 5: Refactor `export-docx.ts` — separare buffer da scrittura su disco

**Files:**
- Modify: `src/documento/export-docx.ts`

**Interfaces:**
- Produces: `costruisciBufferOfferta(input: InputEsportazione): Buffer` — usata dal Task 6/10. `esportaOfferta` resta invariata nella firma pubblica (usata dallo script CLI e dal test esistente).
- `InputEsportazione.percorsoOutput` diventa opzionale.

Nessun nuovo test: comportamento invariato, coperto da `export-docx.test.ts` esistente (design esplicito, non un buco di copertura).

- [ ] **Step 1: Rendi `percorsoOutput` opzionale nel tipo**

In `src/documento/export-docx.ts`, modifica la riga del campo in `InputEsportazione`:

```ts
  percorsoOutput?: string
```

(era `percorsoOutput: string` — unica riga toccata nell'interfaccia)

- [ ] **Step 2: Estrai `costruisciBufferOfferta` da `esportaOfferta`**

Sostituisci l'intera funzione `esportaOfferta` (dalla riga `export function esportaOfferta` fino alla penultima riga, quella di `fs.writeFileSync`) con:

```ts
export function costruisciBufferOfferta(input: InputEsportazione): Buffer {
  const { vociGrezzo, vociPostSconto } = righeVoci(input.risultato)

  const placeholderSpessore = rilevaPlaceholderSpessoreNonInterpolati([...vociGrezzo, ...vociPostSconto])
  if (placeholderSpessore.length > 0 && !input.consentiPlaceholderNonRisolti) {
    throw new Error(
      `esportaOfferta: descrizioni con placeholder di spessore non interpolati: ${[...new Set(placeholderSpessore)].join(', ')}. ` +
        `Questo documento non è pronto per un cliente reale (nessun meccanismo di interpolazione, cfr. template/PLACEHOLDER.md). ` +
        `Passa consentiPlaceholderNonRisolti: true solo se accetti consapevolmente il residuo.`,
    )
  }

  const contenuto = fs.readFileSync(input.percorsoMaster, 'binary')
  const zip = new PizZip(contenuto)

  const chiaviNonRisolte: string[] = []
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part: { value: string; module?: string }) => {
      if (!part.module) chiaviNonRisolte.push(part.value)
      return ''
    },
  })

  const numeroVoce = (id: string) => input.risultato.vociValorizzate.find((v) => v.id === id)?.numero ?? ''
  const letteraOptional = (id: string) => (input.condizioni.optional.find((v) => v.id === id)?.lettera ?? '').replace(/\)\s*$/, '')

  const segno = segnoArrotondamento(input.risultato.arrotondamento)
  const arrotondamentoTesto = `${segno} ${formattaImportoItaliano(Math.abs(input.risultato.arrotondamento))}`

  doc.render({
    'cliente.nome': input.cliente.nome,
    'cliente.comune': input.cliente.comune,
    'cliente.provincia': input.cliente.provincia,
    protocollo: input.protocollo,
    revisione: input.revisione,
    dataOfferta: input.dataOfferta,
    sistemaCostruttivo: SISTEMA_COSTRUTTIVO,
    tetto: input.caratteristiche.tetto,
    mantoCopertura: input.caratteristiche.mantoCopertura,
    finituraEsterna: input.caratteristiche.finituraEsterna,
    pacchettoConsegna: input.caratteristiche.pacchettoConsegna,
    'superficie.totaleLorda': input.superfici.totaleLorda,
    'superficie.pianoTerra': input.superfici.pianoTerra,
    'superficie.pianoPrimo': input.superfici.pianoPrimo,
    'superficie.sottotetto': input.superfici.sottotetto,
    'superficie.portico': input.superfici.portico,
    'superficie.terrazzo': input.superfici.terrazzo,
    'superficie.garage': input.superfici.garage,
    annoListino: String(input.annoListino),
    voci: vociGrezzo.map((v) => ({ numero: v.numero, descrizione: v.descrizione, importo: formattaImportoItaliano(v.importo) })),
    listinoTotale: formattaImportoItaliano(input.risultato.listinoTotale),
    sconti: input.risultato.sconti.map((s) => ({
      percentuale: formattaPercentuale(s.percentuale),
      causale: s.causale,
      importo: `- ${formattaImportoItaliano(s.importoCalcolato)}`,
    })),
    arrotondamento: arrotondamentoTesto,
    parziale: formattaImportoItaliano(input.risultato.parziale),
    'sicurezza.valorizzata': formattaImportoItaliano(input.risultato.sicurezza.valorizzata),
    vociPostSconto: vociPostSconto.map((v) => ({ numero: v.numero, descrizione: v.descrizione, importo: formattaImportoItaliano(v.importo) })),
    totaleNetto: formattaImportoItaliano(input.risultato.totaleNetto),
    optional: input.condizioni.optional.map(formattaVoceOpzionale),
    esclusioni: input.condizioni.esclusioni.map(formattaVoceOpzionale),
    'riferimenti.praticaGenioCivile': letteraOptional('pratica-genio-civile'),
    'riferimenti.tracciamentoImpianti': numeroVoce('tracciamento-impianti'),
    'riferimenti.progettazioneEsecutiva': numeroVoce('progettazione-esecutiva'),
    consegna: input.condizioni.consegna,
    caparra: formattaNumeroItaliano(input.condizioni.caparra),
    salPrimi: input.condizioni.salPrimi.map((s) => ({ percentuale: formattaPercentuale(s.percentuale), descrizione: s.descrizione })),
    salSuccessivi: input.condizioni.salSuccessivi.map((s) => ({ percentuale: formattaPercentuale(s.percentuale), descrizione: s.descrizione })),
    validita: input.condizioni.validita,
    'abaco.finestreBattente': input.abaco.finestreBattente,
    'abaco.portefinestreBattente': input.abaco.portefinestreBattente,
    'abaco.fissiVetrate': input.abaco.fissiVetrate,
    'abaco.alzantiScorrevoli': input.abaco.alzantiScorrevoli,
    abacoSerramenti: input.abaco.tutti,
    'abaco.portoncini': input.abaco.portoncini,
  })

  if (chiaviNonRisolte.length > 0) {
    throw new Error(
      `esportaOfferta: tag presenti nel master ma assenti nei dati passati a render() — ` +
        `probabile refuso nella chiave: ${[...new Set(chiaviNonRisolte)].join(', ')}`,
    )
  }

  return doc.getZip().generate({ type: 'nodebuffer' })
}

export function esportaOfferta(input: InputEsportazione): void {
  if (!input.percorsoOutput) {
    throw new Error('esportaOfferta: percorsoOutput è obbligatorio per scrivere su disco — usa costruisciBufferOfferta per il flusso HTTP.')
  }
  fs.writeFileSync(input.percorsoOutput, costruisciBufferOfferta(input))
}
```

Nota: `numeroVoce`/`letteraOptional`/`segno`/`arrotondamentoTesto` erano già dentro `esportaOfferta`, si spostano semplicemente dentro `costruisciBufferOfferta` senza modifiche.

- [ ] **Step 3: Esegui la suite esistente e verifica che passi invariata**

Run: `npx vitest run src/documento/export-docx.test.ts`
Expected: PASS (stessi 4 test di prima, nessuna modifica al file di test)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore (lo script CLI e il test passano sempre `percorsoOutput`, quindi non sono impattati dal tipo opzionale)

- [ ] **Step 5: Commit**

```bash
git add src/documento/export-docx.ts
git commit -m "refactor(documento): separa costruisciBufferOfferta da esportaOfferta per il flusso HTTP"
```

---

### Task 6: `costruisciInputEsportazione` — mapping StatoForm → InputEsportazione

**Files:**
- Create: `src/documento/costruisci-input-esportazione.ts`
- Test: `src/documento/costruisci-input-esportazione.test.ts`

**Interfaces:**
- Consumes: `StatoForm` (Task 4), `formattaDataItaliana` (Task 1), `suggerisciTotaleLordoTesto` (Task 2), `generaAbacoPerCategoria`, `inputCalcoloDaStato`, `pacchettoDaLivelli`, `eseguiCalcolo` (l'anno listino si legge da `input.listino.anno`, nessun import diretto di `LISTINO_2026` necessario)
- Produces: `costruisciInputEsportazione(stato: StatoForm, revisioneMeta: { numero: number; protocollo: string }): InputEsportazione` — usata dal Task 10 (route).

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/documento/costruisci-input-esportazione.test.ts
import { describe, expect, it } from 'vitest'
import { costruisciInputEsportazione } from './costruisci-input-esportazione'
import { generaAbacoPerCategoria } from '@/ai/abaco'
import { eseguiCalcolo } from '@/domain/calcolo'
import { inputCalcoloDaStato, type StatoForm } from '@/app/preventivi/nuovo/stato-form'
import type { CondizioniForm } from './condizioni-default'
import path from 'node:path'

const CONDIZIONI_CRIVELLARO: CondizioniForm = {
  consegna: 'da pattuire',
  caparra: 30000,
  validita: '31.08.2026',
  sal: [
    { percentuale: 0.2, descrizione: 'Acconto al contratto' },
    { percentuale: 0.1, descrizione: 'Informativa di cantiere' },
    { percentuale: 0.4, descrizione: 'Inizio montaggio' },
    { percentuale: 0.1, descrizione: 'Al tetto primo tavolato (escluso tegole)' },
    { percentuale: 0.1, descrizione: 'Cappotto esterno grezzo (escluso intonachino)' },
    { percentuale: 0.05, descrizione: 'Inizio posa Cartongesso' },
    { percentuale: 0.05, descrizione: 'Fine lavori' },
  ],
  optional: [
    { descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici', importo: 5000, praticaGenioCivile: true },
  ],
  esclusioni: [{ descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' }],
}

// Golden case Crivellaro (CLAUDE.md), costruito da uno StatoForm completo invece che da un
// InputEsportazione letterale come in export-docx.test.ts. Un solo serramento (non gli 11 reali
// di geometria.test.ts): tutti i prezzi vengono da `overrides` — la geometria dei serramenti
// non entra in nessun totale (bypassata dagli override, verificato leggendo domain/calcolo.ts) —
// e un solo portoncino rende l'abaco atteso banale da verificare.
const STATO_CRIVELLARO: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-05',
  luogo: 'Castelgomberto',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [{ n: 1, piano: 'Piano Terra', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 }],
  perimetro: 60,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  chiaviInManoNelTotale: true,
  overrides: {
    'pareti-mhm': 96100, 'trave-larice': 5800, 'copertura-falda': 63600, cappotto: 20300,
    'cartongesso-q2': 15500, 'assistenza-cartongessisti': 2200, 'infissi-pvc': 19300,
    monoblocchi: 10200, 'progettazione-esecutiva': 4000, 'opere-chiavi-in-mano': 89100, garage: 20000,
  },
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }, { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' }],
  totaleTarget: 300000,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
  },
  condizioni: CONDIZIONI_CRIVELLARO,
}

describe('costruisciInputEsportazione — golden case Crivellaro', () => {
  it('mappa cliente/protocollo/revisione/dataOfferta/annoListino', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.cliente).toEqual({ nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' })
    expect(input.protocollo).toBe('2026059')
    expect(input.revisione).toBe('00') // prima revisione salvata, numero: 1 -> '00'
    expect(input.dataOfferta).toBe('Castelgomberto, 5 agosto 2026')
    expect(input.annoListino).toBe(2026)
  })

  it('la revisione si formatta come numero-1 su due cifre', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 3, protocollo: '2026059' })
    expect(input.revisione).toBe('02')
  })

  it('mappa le caratteristiche, incluso il pacchetto derivato dai livelli', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.caratteristiche).toEqual({
      tetto: 'Tetto con travi e perline in abete',
      mantoCopertura: 'Tegole in cemento',
      finituraEsterna: 'Intonaco',
      pacchettoConsegna: 'Grezzo avanzato',
    })
  })

  it('ricalcola totaleLorda al volo (rete di sicurezza) quando totaleLordoTesto non è mai stato toccato', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.superfici).toEqual({
      totaleLorda: '134+13+14= 161',
      pianoTerra: '134',
      pianoPrimo: '',
      sottotetto: '',
      portico: '13+14',
      terrazzo: '',
      garage: '41',
    })
  })

  it('usa totaleLordoTesto verbatim quando è stato valorizzato, invece di ricalcolarlo', () => {
    const statoConTesto: StatoForm = { ...STATO_CRIVELLARO, totaleLordoTesto: '134+13+14 (vedi planimetria)= 161' }
    const input = costruisciInputEsportazione(statoConTesto, { numero: 1, protocollo: '2026059' })
    expect(input.superfici.totaleLorda).toBe('134+13+14 (vedi planimetria)= 161')
  })

  it('mappa condizioni: SAL divisi slice(0,3)/slice(3), optional/esclusioni con lettera di posizione', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.condizioni.consegna).toBe('da pattuire')
    expect(input.condizioni.caparra).toBe(30000)
    expect(input.condizioni.validita).toBe('31.08.2026')
    expect(input.condizioni.salPrimi).toEqual([
      { percentuale: 0.2, descrizione: 'Acconto al contratto' },
      { percentuale: 0.1, descrizione: 'Informativa di cantiere' },
      { percentuale: 0.4, descrizione: 'Inizio montaggio' },
    ])
    expect(input.condizioni.salSuccessivi).toEqual([
      { percentuale: 0.1, descrizione: 'Al tetto primo tavolato (escluso tegole)' },
      { percentuale: 0.1, descrizione: 'Cappotto esterno grezzo (escluso intonachino)' },
      { percentuale: 0.05, descrizione: 'Inizio posa Cartongesso' },
      { percentuale: 0.05, descrizione: 'Fine lavori' },
    ])
    expect(input.condizioni.optional).toEqual([
      { id: 'pratica-genio-civile', lettera: 'A)', descrizione: 'Pratica per deposito al Genio Civile dei calcoli sismici', importo: 5000 },
    ])
    // esclusioni non ha il concetto di praticaGenioCivile: l'id generato è sempre '' (non letto
    // da nessun tag del master per le esclusioni, a differenza di optional).
    expect(input.condizioni.esclusioni).toEqual([
      { id: '', lettera: 'a)', descrizione: 'Operaio specializzato', importo: '€ 35,00/ora' },
    ])
  })

  it('genera lettere di posizione multiple correttamente (A, B, C / a, b, c)', () => {
    const statoConPiuVoci: StatoForm = {
      ...STATO_CRIVELLARO,
      condizioni: {
        ...CONDIZIONI_CRIVELLARO,
        optional: [
          { descrizione: 'Prima', importo: 100 },
          { descrizione: 'Seconda', importo: 200, praticaGenioCivile: true },
          { descrizione: 'Terza', importo: 300 },
        ],
        esclusioni: [
          { descrizione: 'Prima', importo: 10 },
          { descrizione: 'Seconda', importo: 20 },
        ],
      },
    }
    const input = costruisciInputEsportazione(statoConPiuVoci, { numero: 1, protocollo: '2026059' })
    expect(input.condizioni.optional.map((v) => v.lettera)).toEqual(['A)', 'B)', 'C)'])
    expect(input.condizioni.optional.find((v) => v.descrizione === 'Seconda')?.id).toBe('pratica-genio-civile')
    expect(input.condizioni.optional.find((v) => v.descrizione === 'Prima')?.id).toBe('')
    expect(input.condizioni.esclusioni.map((v) => v.lettera)).toEqual(['a)', 'b)'])
  })

  it('mappa abaco chiamando generaAbacoPerCategoria sui serramenti dello stato', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.abaco).toEqual(generaAbacoPerCategoria(STATO_CRIVELLARO.serramenti))
  })

  it('risolve percorsoMaster nel repository, nessuna configurazione esterna', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.percorsoMaster).toBe(path.join(process.cwd(), 'template', 'Offerta MHM master.docx'))
  })

  it('il risultato riproduce i totali del golden case CLAUDE.md — 237 000 di listino, 190 900 di parziale, 300 000 di totale', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.risultato).toEqual(eseguiCalcolo(inputCalcoloDaStato(STATO_CRIVELLARO)))
    expect(input.risultato.listinoTotale).toBe(237000)
    expect(input.risultato.sconti.map((s) => s.importoCalcolato)).toEqual([23700, 21330])
    expect(input.risultato.parziale).toBe(190900)
    expect(input.risultato.totaleNetto).toBe(300000)
  })

  it('non passa consentiPlaceholderNonRisolti — il golden case Crivellaro ha placeholder di spessore non interpolati e deve bloccarsi in costruisciBufferOfferta, non essere silenziato qui', () => {
    const input = costruisciInputEsportazione(STATO_CRIVELLARO, { numero: 1, protocollo: '2026059' })
    expect(input.consentiPlaceholderNonRisolti).toBeUndefined()
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/documento/costruisci-input-esportazione.test.ts`
Expected: FAIL — `Cannot find module './costruisci-input-esportazione'`

- [ ] **Step 3: Implementa**

```ts
// src/documento/costruisci-input-esportazione.ts
import path from 'node:path'
import { eseguiCalcolo } from '@/domain/calcolo'
import { generaAbacoPerCategoria } from '@/ai/abaco'
import { inputCalcoloDaStato, pacchettoDaLivelli, type StatoForm } from '@/app/preventivi/nuovo/stato-form'
import { suggerisciTotaleLordoTesto } from '@/domain/geometria'
import { formattaDataItaliana } from './formatta-data-italiana'
import type { InputEsportazione, SuperficiOfferta, CondizioniOfferta, VoceOpzionale } from './export-docx'
import type { VoceEsclusioneForm, VoceOptionalForm } from './condizioni-default'

const NUMERO_SAL_PRIMI = 3

function lettera(indice: number, maiuscola: boolean): string {
  return `${String.fromCharCode((maiuscola ? 65 : 97) + indice)})`
}

function costruisciVoceOpzionale(voce: VoceOptionalForm | VoceEsclusioneForm, indice: number, maiuscola: boolean): VoceOpzionale {
  const marcataPraticaGenioCivile = 'praticaGenioCivile' in voce && voce.praticaGenioCivile === true
  return {
    id: marcataPraticaGenioCivile ? 'pratica-genio-civile' : '',
    lettera: lettera(indice, maiuscola),
    descrizione: voce.descrizione,
    importo: voce.importo,
  }
}

function costruisciSuperfici(stato: StatoForm): SuperficiOfferta {
  const trovaValore = (nomePiano: string) => stato.superfici.find((s) => s.piano === nomePiano)?.valoreLordo ?? ''

  return {
    totaleLorda: stato.totaleLordoTesto || suggerisciTotaleLordoTesto(stato.superfici, stato.totaleLordoManuale),
    pianoTerra: trovaValore('Piano Terra'),
    pianoPrimo: trovaValore('Piano Primo'),
    sottotetto: trovaValore('Piano sottotetto'),
    portico: trovaValore('Portico'),
    terrazzo: trovaValore('Terrazzo'),
    garage: trovaValore('Garage'),
  }
}

function costruisciCondizioni(stato: StatoForm): CondizioniOfferta {
  const { sal, optional, esclusioni, consegna, caparra, validita } = stato.condizioni
  return {
    consegna,
    caparra,
    validita,
    salPrimi: sal.slice(0, NUMERO_SAL_PRIMI),
    salSuccessivi: sal.slice(NUMERO_SAL_PRIMI),
    optional: optional.map((v, i) => costruisciVoceOpzionale(v, i, true)),
    esclusioni: esclusioni.map((v, i) => costruisciVoceOpzionale(v, i, false)),
  }
}

/**
 * Mapping puro StatoForm -> InputEsportazione (nessun I/O: percorsoOutput resta assente,
 * il chiamante HTTP scrive la risposta direttamente dal Buffer di costruisciBufferOfferta).
 * `revisioneMeta` vive nel record Prisma Revisione/Preventivo, non in StatoForm.
 */
export function costruisciInputEsportazione(
  stato: StatoForm,
  revisioneMeta: { numero: number; protocollo: string },
): InputEsportazione {
  const input = inputCalcoloDaStato(stato)
  const risultato = eseguiCalcolo(input)

  return {
    cliente: stato.cliente,
    protocollo: revisioneMeta.protocollo,
    revisione: String(revisioneMeta.numero - 1).padStart(2, '0'),
    dataOfferta: formattaDataItaliana(stato.data, stato.luogo),
    risultato,
    annoListino: input.listino.anno,
    caratteristiche: {
      tetto: stato.caratteristiche.tetto,
      mantoCopertura: stato.caratteristiche.manto,
      finituraEsterna: stato.caratteristiche.finituraEsterna.charAt(0).toUpperCase() + stato.caratteristiche.finituraEsterna.slice(1),
      pacchettoConsegna: pacchettoDaLivelli(stato.livelli),
    },
    superfici: costruisciSuperfici(stato),
    condizioni: costruisciCondizioni(stato),
    abaco: generaAbacoPerCategoria(stato.serramenti),
    percorsoMaster: path.join(process.cwd(), 'template', 'Offerta MHM master.docx'),
  }
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/documento/costruisci-input-esportazione.test.ts`
Expected: PASS (11 test)

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 6: Commit**

```bash
git add src/documento/costruisci-input-esportazione.ts src/documento/costruisci-input-esportazione.test.ts
git commit -m "feat(documento): aggiungi costruisciInputEsportazione, mapping StatoForm -> InputEsportazione"
```

---

### Task 7: Step wizard "Condizioni contrattuali"

**Files:**
- Create: `src/app/preventivi/nuovo/steps/StepCondizioniContrattuali.tsx`
- Modify: `src/app/preventivi/nuovo/FormStrutturato.tsx`

**Interfaces:**
- Consumes: `StatoForm.condizioni` (Task 4), `Field`, `controlClassName`, `Section`, `Button`, `aggiornaRiga`, `rimuoviRiga`, `VoceOptionalForm`, `VoceEsclusioneForm` (Task 3)

Nessun test automatico: il progetto non ha test di componenti React (`vitest.config.ts` include solo `src/**/*.test.ts`, coerente con `stato-form.ts`/`geometria.ts` testati come TS puro e nessun `.test.tsx` esistente nel repo). La verifica di questo task è manuale, nel Task 13.

- [ ] **Step 1: Crea il componente**

```tsx
// src/app/preventivi/nuovo/steps/StepCondizioniContrattuali.tsx
import { Plus, Trash2 } from 'lucide-react'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import { Button } from '../../ui/Button'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'
import type { VoceEsclusioneForm, VoceOptionalForm } from '@/documento/condizioni-default'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

function lettera(indice: number, maiuscola: boolean): string {
  return `${String.fromCharCode((maiuscola ? 65 : 97) + indice)})`
}

// Stesso principio di StepPrezzi.parseValoreOverride: un valore numerico in formato
// italiano (virgola decimale) diventa number, altrimenti resta la stringa letterale
// digitata (es. "€ 35,00/ora", importo testuale non enumerabile — spec §1).
function parseImportoLibero(testo: string): number | string {
  const pulito = testo.trim()
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? pulito : numero
}

export function StepCondizioniContrattuali({ stato, aggiorna }: Props) {
  const condizioni = stato.condizioni

  function aggiornaCondizioni(parziale: Partial<StatoForm['condizioni']>) {
    aggiorna({ condizioni: { ...condizioni, ...parziale } })
  }

  return (
    <Section title="Condizioni contrattuali">
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Consegna">
          <input className={controlClassName} value={condizioni.consegna} onChange={(e) => aggiornaCondizioni({ consegna: e.target.value })} />
        </Field>
        <Field label="Caparra">
          <input
            type="number"
            className={controlClassName}
            value={condizioni.caparra}
            onChange={(e) => aggiornaCondizioni({ caparra: Number(e.target.value) })}
          />
        </Field>
        <Field label="Validità offerta">
          <input className={controlClassName} value={condizioni.validita} onChange={(e) => aggiornaCondizioni({ validita: e.target.value })} />
        </Field>
      </div>

      <Section title="SAL">
        {condizioni.sal.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <div className="w-24">
              <Field label="%">
                <input
                  type="number"
                  className={controlClassName}
                  value={riga.percentuale * 100}
                  onChange={(e) => aggiornaCondizioni({ sal: aggiornaRiga(condizioni.sal, i, { percentuale: Number(e.target.value) / 100 }) })}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Descrizione">
                <input
                  className={controlClassName}
                  value={riga.descrizione}
                  onChange={(e) => aggiornaCondizioni({ sal: aggiornaRiga(condizioni.sal, i, { descrizione: e.target.value }) })}
                />
              </Field>
            </div>
            <Button type="button" variant="ghost" aria-label="Rimuovi SAL" onClick={() => aggiornaCondizioni({ sal: rimuoviRiga(condizioni.sal, i) })} className="mb-3">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => aggiornaCondizioni({ sal: [...condizioni.sal, { percentuale: 0, descrizione: '' }] })}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi SAL
          </span>
        </Button>
      </Section>

      <Section title="Optional">
        {condizioni.optional.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <span className="mb-3 w-6 text-sm font-semibold text-text-secondary">{lettera(i, true)}</span>
            <div className="flex-1">
              <Field label="Descrizione">
                <input
                  className={controlClassName}
                  value={riga.descrizione}
                  onChange={(e) => aggiornaCondizioni({ optional: aggiornaRiga(condizioni.optional, i, { descrizione: e.target.value }) })}
                />
              </Field>
            </div>
            <div className="w-40">
              <Field label="Importo">
                <input
                  className={controlClassName}
                  value={String(riga.importo)}
                  onChange={(e) => aggiornaCondizioni({ optional: aggiornaRiga(condizioni.optional, i, { importo: parseImportoLibero(e.target.value) }) })}
                />
              </Field>
            </div>
            <label className="mb-3 flex items-center gap-1.5 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={riga.praticaGenioCivile ?? false}
                onChange={(e) => {
                  const marcata = e.target.checked
                  // Al più una riga marcata alla volta (spec §1): marcare questa smarca le altre.
                  aggiornaCondizioni({ optional: condizioni.optional.map((v, idx) => ({ ...v, praticaGenioCivile: idx === i ? marcata : false })) })
                }}
              />
              Pratica Genio Civile
            </label>
            <Button type="button" variant="ghost" aria-label="Rimuovi optional" onClick={() => aggiornaCondizioni({ optional: rimuoviRiga(condizioni.optional, i) })} className="mb-3">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => aggiornaCondizioni({ optional: [...condizioni.optional, { descrizione: '', importo: '' } satisfies VoceOptionalForm] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi optional
          </span>
        </Button>
      </Section>

      <Section title="Esclusioni">
        {condizioni.esclusioni.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <span className="mb-3 w-6 text-sm font-semibold text-text-secondary">{lettera(i, false)}</span>
            <div className="flex-1">
              <Field label="Descrizione">
                <input
                  className={controlClassName}
                  value={riga.descrizione}
                  onChange={(e) => aggiornaCondizioni({ esclusioni: aggiornaRiga(condizioni.esclusioni, i, { descrizione: e.target.value }) })}
                />
              </Field>
            </div>
            <div className="w-40">
              <Field label="Importo">
                <input
                  className={controlClassName}
                  value={String(riga.importo)}
                  onChange={(e) => aggiornaCondizioni({ esclusioni: aggiornaRiga(condizioni.esclusioni, i, { importo: parseImportoLibero(e.target.value) }) })}
                />
              </Field>
            </div>
            <Button type="button" variant="ghost" aria-label="Rimuovi esclusione" onClick={() => aggiornaCondizioni({ esclusioni: rimuoviRiga(condizioni.esclusioni, i) })} className="mb-3">
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => aggiornaCondizioni({ esclusioni: [...condizioni.esclusioni, { descrizione: '', importo: '' } satisfies VoceEsclusioneForm] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi esclusione
          </span>
        </Button>
      </Section>
    </Section>
  )
}
```

- [ ] **Step 2: Collega lo step in `FormStrutturato.tsx`**

Aggiungi l'import e il titolo, in `src/app/preventivi/nuovo/FormStrutturato.tsx`:

```ts
import { StepCondizioniContrattuali } from './steps/StepCondizioniContrattuali'
```

```ts
const STEP_TITOLI = ['Anagrafica', 'Configurazione', 'Geometria', 'Prezzi', 'Condizioni', 'Condizioni contrattuali']
```

E aggiungi il render dello step 5, subito dopo `{step === 4 && <StepCondizioni ... />}`:

```tsx
{step === 5 && <StepCondizioniContrattuali stato={stato} aggiorna={aggiorna} />}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/nuovo/steps/StepCondizioniContrattuali.tsx src/app/preventivi/nuovo/FormStrutturato.tsx
git commit -m "feat(wizard): aggiungi step Condizioni contrattuali (consegna, caparra, SAL, optional, esclusioni)"
```

---

### Task 8: Campo `totaleLordoTesto` nello step Geometria

**Files:**
- Modify: `src/app/preventivi/nuovo/steps/StepGeometria.tsx`

**Interfaces:**
- Consumes: `suggerisciTotaleLordoTesto` (Task 2)

Nessun test automatico (stesso motivo del Task 7 — componente React, verifica manuale nel Task 13).

- [ ] **Step 1: Aggiungi il campo**

In `src/app/preventivi/nuovo/steps/StepGeometria.tsx`, aggiungi l'import:

```ts
import {
  totaleSuperficiLorde,
  suggerisciTotaleLordoTesto,
  PIANI_CANONICI,
  CATEGORIE_SERRAMENTO,
  type CategoriaSerramento,
  type Serramento,
  type SuperficiePiano,
} from '@/domain/geometria'
```

E aggiungi il campo subito dopo il blocco `totaleLordoManuale` esistente (dopo il `</div>` che chiude il campo "Totale superfici lorde calcolato"):

```tsx
<div className="mt-2">
  <Field label="Totale superfici lorde (testo per il documento, spec §2 — resta editabile)">
    <input
      className={controlClassName}
      value={stato.totaleLordoTesto ?? ''}
      placeholder={suggerisciTotaleLordoTesto(stato.superfici, stato.totaleLordoManuale)}
      onChange={(e) => aggiorna({ totaleLordoTesto: e.target.value === '' ? undefined : e.target.value })}
    />
  </Field>
</div>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add src/app/preventivi/nuovo/steps/StepGeometria.tsx
git commit -m "feat(wizard): aggiungi campo totaleLordoTesto editabile nello step Geometria"
```

---

### Task 9: `PannelloPreview` legge `stato.condizioni` invece del placeholder fisso

**Files:**
- Modify: `src/app/preventivi/nuovo/PannelloPreview.tsx`

**Interfaces:**
- Consumes: `stato.condizioni` (Task 4), `CONDIZIONI_DEFAULT` (Task 3), `formattaImportoItaliano`

Nessun test automatico (componente React, verifica manuale nel Task 13).

- [ ] **Step 1: Aggiorna gli import**

Sostituisci la riga:

```ts
import { SAL_DEFAULT, CONDIZIONE_DA_DEFINIRE } from '@/documento/condizioni-default'
```

con:

```ts
import { CONDIZIONI_DEFAULT, CONDIZIONE_DA_DEFINIRE } from '@/documento/condizioni-default'
import { formattaImportoItaliano } from '@/documento/preview/formattazione'
```

- [ ] **Step 2: Leggi `stato.condizioni` con fallback per le revisioni precedenti a questa feature**

Aggiungi, subito dopo la riga `const abaco = generaAbacoPerCategoria(stato.serramenti)`:

```ts
  // Le revisioni salvate prima di questa feature non hanno la chiave `condizioni` nel loro
  // JSON: CLAUDE.md vincolo 6 impone che restino apribili con gli stessi numeri firmati, quindi
  // qui serve un fallback esplicito (il merge in FormStrutturato copre solo il percorso bozza,
  // non questa pagina di sola lettura che deserializza il JSON grezzo senza passare da lì).
  const condizioni = stato.condizioni ?? CONDIZIONI_DEFAULT
```

- [ ] **Step 3: Sostituisci il blocco `<PaginaCondizioni>`**

Sostituisci:

```tsx
      {/* Il wizard non raccoglie ancora le condizioni (follow-up): la scaletta SAL
          usa i default reali FBE, mentre caparra/consegna/validità restano
          segnaposto espliciti perché l'operatore veda che sono da compilare. */}
      <PaginaCondizioni
        caparra={CONDIZIONE_DA_DEFINIRE}
        sal={SAL_DEFAULT}
        consegna={CONDIZIONE_DA_DEFINIRE}
        validita={CONDIZIONE_DA_DEFINIRE}
      />
```

con:

```tsx
      <PaginaCondizioni
        caparra={condizioni.caparra > 0 ? formattaImportoItaliano(condizioni.caparra) : CONDIZIONE_DA_DEFINIRE}
        sal={condizioni.sal.map((s) => ({ percentuale: s.percentuale, milestone: s.descrizione }))}
        consegna={condizioni.consegna.trim() === '' ? CONDIZIONE_DA_DEFINIRE : condizioni.consegna}
        validita={condizioni.validita.trim() === '' ? CONDIZIONE_DA_DEFINIRE : condizioni.validita}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 5: Commit**

```bash
git add src/app/preventivi/nuovo/PannelloPreview.tsx
git commit -m "feat(wizard): la preview legge le condizioni contrattuali dallo stato, non più un placeholder fisso"
```

---

### Task 10: Route API di export

**Files:**
- Create: `src/app/api/preventivi/[id]/revisioni/[numero]/export/route.ts`
- Test: `src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts`

**Interfaces:**
- Consumes: `caricaRevisione`, `deserializzaRevisione`, `costruisciInputEsportazione` (Task 6), `costruisciBufferOfferta` (Task 5), `creaPreventivoConBozza`, `creaClientDiTest`, `applicaMigrazioni`

- [ ] **Step 1: Scrivi il test che fallisce**

```ts
// src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'
import { creaPreventivoConBozza } from '@/server/preventivi-repo'
import { serializzaRevisione } from '@/domain/persistenza'
import { eseguiCalcolo } from '@/domain/calcolo'
import { inputCalcoloDaStato, type StatoForm } from '@/app/preventivi/nuovo/stato-form'
import { CONDIZIONI_DEFAULT } from '@/documento/condizioni-default'

vi.mock('@/server/prisma', () => ({ prisma: creaClientDiTest() }))

const { prisma: db } = await import('@/server/prisma')
const { POST } = await import('./route')

beforeAll(async () => {
  await applicaMigrazioni(db)
})

beforeEach(async () => {
  await db.revisione.deleteMany()
  await db.preventivo.deleteMany()
  await db.cliente.deleteMany()
})

// `struttura`/`involucro` a 'impoverito'/'escluso' esclude dal calcolo pareti-mhm e
// copertura-falda/cappotto — le uniche voci del catalogo con placeholder di spessore
// ({{spessoreEsterno}} ecc., cfr. template/PLACEHOLDER.md) non interpolati. Non è una
// combinazione raggiungibile dai tre pacchetti UI (`pacchettoDaLivelli` fissa sempre
// struttura a 'completo'), ma qui serve solo a isolare un caso senza quel problema NOTO
// e separato (già coperto dai suoi test dedicati in export-docx.test.ts) — questo test
// verifica la route (200/404/422), non il contenuto del documento.
const STATO_SENZA_PLACEHOLDER: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-05',
  luogo: 'Castelgomberto',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [],
  perimetro: 60,
  livelli: { struttura: 'impoverito', involucro: 'escluso', finiture: 'escluso' },
  chiaviInManoNelTotale: false,
  overrides: {},
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  totaleTarget: 100000,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
  },
  condizioni: { ...CONDIZIONI_DEFAULT, consegna: 'da pattuire', caparra: 30000, validita: '31.08.2026' },
}

function corpoBozza(stato: StatoForm) {
  const input = inputCalcoloDaStato(stato)
  const risultato = eseguiCalcolo(input)
  return {
    cliente: stato.cliente,
    protocollo: stato.protocollo,
    oggetto: stato.oggetto,
    progettista: stato.progettista,
    data: stato.data,
    luogo: stato.luogo,
    ...serializzaRevisione(stato, input, risultato),
  }
}

describe('POST /api/preventivi/[id]/revisioni/[numero]/export', () => {
  it('risponde 200 con il .docx e un Content-Disposition coerente col protocollo/revisione', async () => {
    const preventivo = await creaPreventivoConBozza(db, corpoBozza(STATO_SENZA_PLACEHOLDER))
    const risposta = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(200)
    expect(risposta.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    expect(risposta.headers.get('Content-Disposition')).toBe('attachment; filename="2026059-rev00.docx"')
    const buffer = Buffer.from(await risposta.arrayBuffer())
    expect(buffer.length).toBeGreaterThan(0)
  })

  it('risponde 404 se la revisione non esiste', async () => {
    const preventivo = await creaPreventivoConBozza(db, corpoBozza(STATO_SENZA_PLACEHOLDER))
    const risposta = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: preventivo.id, numero: '99' }),
    })
    expect(risposta.status).toBe(404)
  })

  it('risponde 422 con messaggio leggibile se il documento ha placeholder di spessore non interpolati', async () => {
    // struttura: 'completo' reintroduce pareti-mhm — e col suo {{spessoreEsterno}}/
    // {{spessoreInterno}} mai interpolato (limite noto e separato, non risolto da questo
    // piano). costruisciInputEsportazione non passa mai consentiPlaceholderNonRisolti,
    // quindi costruisciBufferOfferta deve bloccarsi qui esattamente come da progetto —
    // niente file corrotto scaricato in silenzio.
    const statoConPlaceholder: StatoForm = {
      ...STATO_SENZA_PLACEHOLDER,
      livelli: { struttura: 'completo', involucro: 'escluso', finiture: 'escluso' },
    }
    const preventivo = await creaPreventivoConBozza(db, corpoBozza(statoConPlaceholder))
    const risposta = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(422)
    const corpo = await risposta.json()
    expect(corpo.errore).toMatch(/spessore/)
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run "src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts"`
Expected: FAIL — `Cannot find module './route'`

- [ ] **Step 3: Implementa la route**

```ts
// src/app/api/preventivi/[id]/revisioni/[numero]/export/route.ts
import { prisma } from '@/server/prisma'
import { caricaRevisione } from '@/server/preventivi-repo'
import { deserializzaRevisione } from '@/domain/persistenza'
import { costruisciInputEsportazione } from '@/documento/costruisci-input-esportazione'
import { costruisciBufferOfferta } from '@/documento/export-docx'
import type { StatoForm } from '@/app/preventivi/nuovo/stato-form'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero } = await params
  const revisione = await caricaRevisione(prisma, id, Number(numero))
  if (!revisione) return Response.json({ errore: 'Revisione non trovata' }, { status: 404 })

  const { stato } = deserializzaRevisione<StatoForm>(revisione.statoForm, revisione.inputCalcolo, revisione.risultatoCalcolo)

  try {
    const input = costruisciInputEsportazione(stato, { numero: revisione.numero, protocollo: revisione.preventivo.protocollo })
    const buffer = costruisciBufferOfferta(input)
    const nomeFile = `${revisione.preventivo.protocollo}-rev${input.revisione}.docx`

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nomeFile}"`,
      },
    })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    return Response.json({ errore: messaggio }, { status: 422 })
  }
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run "src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts"`
Expected: PASS (3 test)

- [ ] **Step 5: Typecheck completo**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/preventivi/[id]/revisioni/[numero]/export/route.ts" "src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts"
git commit -m "feat(api): aggiungi route POST /export per generare il docx da una revisione"
```

---

### Task 11: Pulsante "Genera documento" condiviso

**Files:**
- Create: `src/app/preventivi/ui/PulsanteGeneraDocumento.tsx`

**Interfaces:**
- Consumes: `Button`, `Alert` (già in `src/app/preventivi/ui/`)
- Produces: `<PulsanteGeneraDocumento preventivoId={string} numero={number} />` — usato dal Task 12 sia in `WizardConSalvataggio.tsx` sia nella pagina di revisione.

Nessun test automatico (componente React client-side con `fetch`/DOM download, verifica manuale nel Task 13). Un solo componente per evitare di duplicare fetch+download+gestione errore nei due punti d'uso (spec §7).

- [ ] **Step 1: Crea il componente**

```tsx
// src/app/preventivi/ui/PulsanteGeneraDocumento.tsx
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { Alert } from './Alert'

interface Props {
  preventivoId: string
  numero: number
}

function nomeFileDaContentDisposition(header: string | null): string | null {
  if (!header) return null
  const match = header.match(/filename="([^"]+)"/)
  return match ? match[1] : null
}

export function PulsanteGeneraDocumento({ preventivoId, numero }: Props) {
  const [stato, setStato] = useState<'inattivo' | 'in-corso' | 'errore'>('inattivo')
  const [messaggioErrore, setMessaggioErrore] = useState('')

  async function generaDocumento() {
    setStato('in-corso')
    try {
      const risposta = await fetch(`/api/preventivi/${preventivoId}/revisioni/${numero}/export`, { method: 'POST' })
      if (!risposta.ok) {
        const corpo = await risposta.json().catch(() => ({ errore: `Errore ${risposta.status}` }))
        throw new Error(corpo.errore ?? `Errore ${risposta.status}`)
      }

      const blob = await risposta.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nomeFileDaContentDisposition(risposta.headers.get('Content-Disposition')) ?? 'offerta.docx'
      link.click()
      URL.revokeObjectURL(url)

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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 3: Commit**

```bash
git add src/app/preventivi/ui/PulsanteGeneraDocumento.tsx
git commit -m "feat(ui): aggiungi PulsanteGeneraDocumento condiviso (fetch + download + errore)"
```

---

### Task 12: Collegare il pulsante al wizard e alla pagina di revisione

**Files:**
- Modify: `src/app/preventivi/WizardConSalvataggio.tsx`
- Modify: `src/app/preventivi/[id]/revisioni/[numero]/page.tsx`

**Interfaces:**
- Consumes: `PulsanteGeneraDocumento` (Task 11)

- [ ] **Step 1: Aggiungi il pulsante in `WizardConSalvataggio.tsx`**

Aggiungi l'import:

```ts
import { PulsanteGeneraDocumento } from './ui/PulsanteGeneraDocumento'
```

E aggiungi il pulsante nella barra sticky, subito dopo il blocco `{statoSalvataggio === 'errore' && ...}` (visibile solo dopo il primo salvataggio, perché la route ha bisogno di un id e un numero di revisione persistiti — spec §7):

```tsx
          {statoSalvataggio === 'errore' && <Alert variant="errore">Salvataggio fallito, riprova.</Alert>}
          {salvataggio && <PulsanteGeneraDocumento preventivoId={salvataggio.id} numero={salvataggio.numero} />}
```

- [ ] **Step 2: Aggiungi il pulsante nella pagina di revisione di sola lettura**

In `src/app/preventivi/[id]/revisioni/[numero]/page.tsx`, aggiungi l'import:

```ts
import { PulsanteGeneraDocumento } from '@/app/preventivi/ui/PulsanteGeneraDocumento'
```

E aggiungi il pulsante nel ramo di sola lettura (dopo il paragrafo con numero/stato revisione, prima di `<PannelloPreview ... />`):

```tsx
  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          Revisione {revisione.numero} — stato: <span className="font-semibold text-text">{revisione.stato}</span> (sola lettura)
        </p>
        <PulsanteGeneraDocumento preventivoId={id} numero={revisione.numero} />
      </div>
      <PannelloPreview stato={stato} input={input} />
    </div>
  )
```

(sostituisce il `<p className="mb-4 ...">...</p>` esistente — nota il cambio da `mb-4` sul `<p>` a un contenitore flex che lo racchiude insieme al pulsante)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: nessun errore

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/WizardConSalvataggio.tsx "src/app/preventivi/[id]/revisioni/[numero]/page.tsx"
git commit -m "feat(wizard): collega il pulsante Genera documento al wizard e alla pagina di revisione"
```

---

### Task 13: Verifica end-to-end (suite completa + manuale in browser)

**Files:** nessuno (solo verifica)

- [ ] **Step 1: Suite di test completa**

Run: `npm test`
Expected: PASS, tutti i test (esistenti + i nuovi dei Task 1, 2, 3, 6, 10)

- [ ] **Step 2: Typecheck e lint completi**

Run: `npm run typecheck && npm run lint`
Expected: nessun errore

- [ ] **Step 3: Verifica manuale in browser — percorso wizard**

Run: `npm run dev`

Nel browser (`http://localhost:3000/preventivi/nuovo` o la rotta equivalente per un nuovo preventivo):
1. Compila Anagrafica, Geometria (incluso il nuovo campo testo superfici lorde — verifica che il placeholder mostri l'auto-suggerimento `134+13+14= 161` con gli stessi dati del golden case Crivellaro), Prezzi.
2. Vai allo step "Condizioni contrattuali": compila consegna/caparra/validità, aggiungi una riga SAL, una riga optional marcata "Pratica Genio Civile", una riga esclusione con importo testuale libero (es. `€ 35,00/ora`) — verifica che resti stringa e non venga convertita in numero.
3. Verifica nella preview a destra che la pagina "Condizioni" mostri i valori appena inseriti, non più `— da definire`.
4. Clicca "Salva bozza".
5. Dopo il salvataggio, verifica che compaia il pulsante "Genera documento" e cliccalo: il browser deve scaricare un file `.docx` con nome `<protocollo>-rev00.docx`.
6. Apri il file scaricato (Word o LibreOffice) e verifica visivamente che le condizioni contrattuali compaiano in pagina 6 coi valori inseriti.

- [ ] **Step 4: Verifica manuale in browser — percorso pagina di revisione**

1. Vai all'elenco preventivi (`/preventivi`), apri la revisione appena salvata (`/preventivi/[id]/revisioni/[numero]`).
2. Se la revisione è ancora `bozza`, verrà mostrato di nuovo il wizard: verifica che il pulsante "Genera documento" sia presente da subito (perché `preventivoEsistente` è già impostato).
3. Per verificare il ramo di sola lettura, imposta manualmente lo stato della revisione a `inviata` nel DB (es. con uno script `tsx` che chiama `prisma.revisione.update`), ricarica la pagina, e verifica che compaia il pulsante accanto a "Revisione N — stato: inviata (sola lettura)" e che il download funzioni identico.

- [ ] **Step 5: Se qualcosa non torna, fix + rieseguire Step 1-2 prima di procedere**

Nessun commit in questo task: è solo verifica. Se emergono bug, tornare al task pertinente, correggere lì, e ripetere il proprio ciclo test→commit di quel task.
