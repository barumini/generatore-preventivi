# Restyling UI del wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare il flusso del wizard (chat di apertura, 5 step del form, layout con preview) da HTML/form senza stile a un'interfaccia Tailwind CSS v4 con palette calda ispirata al legno, senza cambiare nessuna logica esistente.

**Architecture:** Setup Tailwind v4 + Inter + design token; costruzione di 5 primitive UI condivise (`Field`, `Button`, `Section`, `Alert`, `StepTabs`); estrazione di `FormStrutturato.tsx` (oggi 439 righe, 5 step inline) in un orchestratore più 5 file di step; restyling incrementale file per file usando le primitive; restyling finale del layout a due colonne in `WizardConSalvataggio.tsx`.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS v4 (`@tailwindcss/postcss`), `next/font/google` (Inter), `lucide-react`.

## Global Constraints

- Nessuna modifica di logica: `stato-form.ts`, `domain/`, le chiamate `fetch` e la gestione errori esistenti restano identiche in ogni task — solo markup e classi cambiano.
- Palette: fondo `#FAF6F0`, bordo `#E8DCC8`, accento `#8B5E34` (hover `#6B4726`), testo `#2B2420`, testo secondario `#6B5A3F`, errore `#B3261E`, avviso `#9A6A00`.
- Font Inter per il chrome dell'app; `.pagina-a4` (in `documento/preview/print.css`) resta `Georgia, serif` — **non va toccato**.
- Fuori scope, da non modificare: `src/documento/preview/Pagina*.tsx`, `src/documento/preview/print.css`, `src/app/preventivi/page.tsx` (elenco), `src/app/preventivi/[id]/revisioni/[numero]/page.tsx`.
- Nessun nuovo test automatico: è restyling puro. Verifica tramite `npm run typecheck`, `npm run build` e verifica manuale nel browser (Task 9).
- `npm run test` (suite `domain/`, invariata da questo lavoro) deve restare verde in ogni task.

---

### Task 1: Tailwind CSS v4 + Inter + design token

**Files:**
- Modify: `package.json` (dipendenze)
- Create: `postcss.config.mjs`
- Create: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: classi utility Tailwind disponibili in ogni `.tsx` sotto `src/`; classi colore `bg-cream`, `text-cream`, `border-cream`, `bg-border-warm`, `text-border-warm`, `border-border-warm`, `bg-accent`, `text-accent`, `border-accent`, `bg-accent-hover`, `text-accent-hover`, `bg-text`, `text-text`, `bg-text-secondary`, `text-text-secondary`, `bg-error`, `text-error`, `border-error`, `bg-warning`, `text-warning`, `border-warning` generate automaticamente da Tailwind v4 a partire dai token `--color-*` in `@theme`.

- [ ] **Step 1: Installa le dipendenze**

```bash
npm install -D tailwindcss @tailwindcss/postcss
npm install lucide-react
```

- [ ] **Step 2: Crea `postcss.config.mjs`**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

- [ ] **Step 3: Crea `src/app/globals.css`**

```css
@import 'tailwindcss';

@theme {
  --color-cream: #faf6f0;
  --color-border-warm: #e8dcc8;
  --color-accent: #8b5e34;
  --color-accent-hover: #6b4726;
  --color-text: #2b2420;
  --color-text-secondary: #6b5a3f;
  --color-error: #b3261e;
  --color-warning: #9a6a00;
}
```

- [ ] **Step 4: Aggiorna `src/app/layout.tsx`**

```tsx
// CSS globale non-module: in App Router va importato nel root layout perché si
// applichi a ogni route (cfr. node_modules/next/dist/docs/01-app/01-getting-started/11-css.md).
import './globals.css'
// Definisce `.pagina-a4` e il blocco @media print usati da tutte le pagine di preview.
// Importato dopo globals.css: le sue regole (tutte scoped a `.pagina-a4`) hanno
// specificità maggiore del preflight di Tailwind e non vanno mai sovrascritte.
import '@/documento/preview/print.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Verifica il build**

Run: `npm run typecheck && npm run build`
Expected: entrambi i comandi terminano con exit code 0, nessun errore relativo a `postcss.config.mjs`, `globals.css` o al font.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json postcss.config.mjs src/app/globals.css src/app/layout.tsx
git commit -m "feat(ui): setup Tailwind CSS v4, font Inter e design token"
```

---

### Task 2: Primitive UI condivise

**Files:**
- Create: `src/app/preventivi/ui/Field.tsx`
- Create: `src/app/preventivi/ui/Button.tsx`
- Create: `src/app/preventivi/ui/Section.tsx`
- Create: `src/app/preventivi/ui/Alert.tsx`
- Create: `src/app/preventivi/ui/StepTabs.tsx`

**Interfaces:**
- Consumes: token Tailwind da Task 1 (`bg-cream`, `border-border-warm`, `text-accent`, ecc.)
- Produces:
  - `Field({ label: string, children: ReactNode, error?: string })` — wrapper label+controllo
  - `controlClassName: string` — classe da applicare a ogni `<input>`/`<select>` grezzo
  - `Button({ variant?: 'primary' | 'secondary' | 'ghost', ...ButtonHTMLAttributes })`
  - `Section({ title: string, children: ReactNode })`
  - `Alert({ variant: 'errore' | 'avviso', children: ReactNode })`
  - `StepTabs({ titoli: string[], stepCorrente: number, onSeleziona: (indice: number) => void })`

- [ ] **Step 1: Crea `src/app/preventivi/ui/Field.tsx`**

```tsx
import type { ReactNode } from 'react'

export const controlClassName =
  'w-full rounded-md border border-border-warm bg-cream px-2.5 py-2 text-sm text-text focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30'

interface Props {
  label: string
  children: ReactNode
  error?: string
}

export function Field({ label, children, error }: Props) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11.5px] font-medium text-text-secondary">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  )
}
```

- [ ] **Step 2: Crea `src/app/preventivi/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50',
  secondary:
    'border border-border-warm text-text hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50',
  ghost: 'text-text-secondary hover:text-error',
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      {...props}
      className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${VARIANT_CLASSES[variant]} ${className}`}
    />
  )
}
```

- [ ] **Step 3: Crea `src/app/preventivi/ui/Section.tsx`**

```tsx
import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
}

export function Section({ title, children }: Props) {
  return (
    <section className="mb-4 rounded-lg border border-border-warm bg-white p-4">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wide text-accent">{title}</h3>
      {children}
    </section>
  )
}
```

- [ ] **Step 4: Crea `src/app/preventivi/ui/Alert.tsx`**

```tsx
import type { ReactNode } from 'react'

type Variant = 'errore' | 'avviso'

interface Props {
  variant: Variant
  children: ReactNode
}

const VARIANT_CLASSES: Record<Variant, string> = {
  errore: 'border-error/30 bg-error/5 text-error',
  avviso: 'border-warning/30 bg-warning/5 text-warning',
}

export function Alert({ variant, children }: Props) {
  return (
    <p role="alert" className={`mb-2 rounded-md border px-3 py-2 text-sm ${VARIANT_CLASSES[variant]}`}>
      {children}
    </p>
  )
}
```

- [ ] **Step 5: Crea `src/app/preventivi/ui/StepTabs.tsx`**

```tsx
interface Props {
  titoli: string[]
  stepCorrente: number
  onSeleziona: (indice: number) => void
}

export function StepTabs({ titoli, stepCorrente, onSeleziona }: Props) {
  return (
    <nav className="mb-4 flex gap-1">
      {titoli.map((titolo, i) => (
        <button
          key={titolo}
          type="button"
          onClick={() => onSeleziona(i)}
          aria-current={i === stepCorrente}
          className={`flex-1 rounded-t-md px-2 py-2.5 text-xs font-semibold transition-colors ${
            i === stepCorrente ? 'bg-accent text-white' : 'bg-border-warm/60 text-text-secondary hover:bg-border-warm'
          }`}
        >
          {i + 1}. {titolo}
        </button>
      ))}
    </nav>
  )
}
```

- [ ] **Step 6: Verifica**

Run: `npm run typecheck`
Expected: exit code 0 (nessun file consuma ancora queste primitive, quindi nessun errore di utilizzo è possibile in questo task — verifica solo che i 5 file siano sintatticamente e tipologicamente validi).

- [ ] **Step 7: Commit**

```bash
git add src/app/preventivi/ui/
git commit -m "feat(ui): primitive condivise Field, Button, Section, Alert, StepTabs"
```

---

### Task 3: Estrazione di FormStrutturato in orchestratore + 5 step

Refactor meccanico: sposta ogni step in un file proprio, senza cambiare classi/markup (arriverà nei task successivi). Contestualmente collega `StepTabs` (già pronto dal Task 2) al posto del `<nav>` grezzo, perché non richiede che gli step siano già ristilizzati.

**Files:**
- Create: `src/app/preventivi/nuovo/riga-utils.ts`
- Create: `src/app/preventivi/nuovo/steps/StepAnagrafica.tsx`
- Create: `src/app/preventivi/nuovo/steps/StepConfigurazione.tsx`
- Create: `src/app/preventivi/nuovo/steps/StepGeometria.tsx`
- Create: `src/app/preventivi/nuovo/steps/StepPrezzi.tsx`
- Create: `src/app/preventivi/nuovo/steps/StepCondizioni.tsx`
- Modify: `src/app/preventivi/nuovo/FormStrutturato.tsx` (sostituzione integrale del contenuto)

**Interfaces:**
- Consumes: `StepTabs` da Task 2 (`src/app/preventivi/ui/StepTabs.tsx`)
- Produces: ogni componente Step ha la firma `({ stato, aggiorna }: { stato: StatoForm; aggiorna: (parziale: Partial<StatoForm>) => void })` — usata dall'orchestratore e dai task di restyling successivi (4-7)
- Produces: `aggiornaRiga<T>(righe: T[], indice: number, parziale: Partial<T>): T[]` e `rimuoviRiga<T>(righe: T[], indice: number): T[]` da `riga-utils.ts`, usate da `StepGeometria` e `StepCondizioni`

- [ ] **Step 1: Crea `src/app/preventivi/nuovo/riga-utils.ts`**

```ts
export function aggiornaRiga<T>(righe: T[], indice: number, parziale: Partial<T>): T[] {
  return righe.map((riga, i) => (i === indice ? { ...riga, ...parziale } : riga))
}

export function rimuoviRiga<T>(righe: T[], indice: number): T[] {
  return righe.filter((_, i) => i !== indice)
}
```

- [ ] **Step 2: Crea `src/app/preventivi/nuovo/steps/StepAnagrafica.tsx`** (markup invariato dallo step 0 originale, non ancora ristilizzato)

```tsx
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepAnagrafica({ stato, aggiorna }: Props) {
  return (
    <fieldset>
      <legend>Anagrafica</legend>
      <label>
        Cliente
        <input value={stato.cliente.nome} onChange={(e) => aggiorna({ cliente: { ...stato.cliente, nome: e.target.value } })} />
      </label>
      <label>
        Comune
        <input value={stato.cliente.comune} onChange={(e) => aggiorna({ cliente: { ...stato.cliente, comune: e.target.value } })} />
      </label>
      <label>
        Provincia
        <input
          value={stato.cliente.provincia}
          onChange={(e) => aggiorna({ cliente: { ...stato.cliente, provincia: e.target.value } })}
        />
      </label>
      <label>
        Protocollo
        <input value={stato.protocollo} onChange={(e) => aggiorna({ protocollo: e.target.value })} />
      </label>
      <label>
        Progettista
        <input value={stato.progettista} onChange={(e) => aggiorna({ progettista: e.target.value })} />
      </label>
      <label>
        Oggetto
        <input value={stato.oggetto} onChange={(e) => aggiorna({ oggetto: e.target.value })} />
      </label>
      <label>
        Data
        <input type="date" value={stato.data} onChange={(e) => aggiorna({ data: e.target.value })} />
      </label>
      <label>
        Luogo
        <input value={stato.luogo} onChange={(e) => aggiorna({ luogo: e.target.value })} />
      </label>
    </fieldset>
  )
}
```

- [ ] **Step 3: Crea `src/app/preventivi/nuovo/steps/StepConfigurazione.tsx`** (markup invariato dallo step 1 originale)

```tsx
import type { LivelloModulo, Modulo } from '@/domain/voci'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

const LIVELLI_MODULO: LivelloModulo[] = ['completo', 'impoverito', 'escluso']
const MODULI: { chiave: Modulo; etichetta: string }[] = [
  { chiave: 'struttura', etichetta: 'Struttura' },
  { chiave: 'involucro', etichetta: 'Involucro' },
  { chiave: 'finiture', etichetta: 'Finiture' },
]

export function StepConfigurazione({ stato, aggiorna }: Props) {
  return (
    <fieldset>
      <legend>Configurazione</legend>
      {MODULI.map(({ chiave, etichetta }) => (
        <label key={chiave}>
          {etichetta}
          <select
            value={stato.livelli[chiave]}
            onChange={(e) => aggiorna({ livelli: { ...stato.livelli, [chiave]: e.target.value as LivelloModulo } })}
          >
            {LIVELLI_MODULO.map((livello) => (
              <option key={livello} value={livello}>
                {livello}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label>
        <input
          type="checkbox"
          checked={stato.chiaviInManoNelTotale}
          onChange={(e) => aggiorna({ chiaviInManoNelTotale: e.target.checked })}
        />
        Chiavi in mano nel totale
      </label>
      <label>
        Copertura
        <select
          value={stato.caratteristiche.copertura}
          onChange={(e) =>
            aggiorna({ caratteristiche: { ...stato.caratteristiche, copertura: e.target.value as 'falde' | 'piano' } })
          }
        >
          <option value="falde">A falde</option>
          <option value="piano">Piano</option>
        </select>
      </label>
      <label>
        Manto di copertura
        <input
          value={stato.caratteristiche.manto}
          onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, manto: e.target.value } })}
        />
      </label>
      <label>
        Finitura esterna
        <select
          value={stato.caratteristiche.finituraEsterna}
          onChange={(e) =>
            aggiorna({
              caratteristiche: { ...stato.caratteristiche, finituraEsterna: e.target.value as 'intonaco' | 'rivestimento' },
            })
          }
        >
          <option value="intonaco">Intonaco</option>
          <option value="rivestimento">Rivestimento</option>
        </select>
      </label>
      <label>
        Tetto (descrizione)
        <input
          value={stato.caratteristiche.tetto}
          onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, tetto: e.target.value } })}
        />
      </label>
    </fieldset>
  )
}
```

- [ ] **Step 4: Crea `src/app/preventivi/nuovo/steps/StepGeometria.tsx`** (markup invariato dallo step 2 originale)

```tsx
import {
  totaleSuperficiLorde,
  PIANI_CANONICI,
  CATEGORIE_SERRAMENTO,
  type CategoriaSerramento,
  type Serramento,
  type SuperficiePiano,
} from '@/domain/geometria'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepGeometria({ stato, aggiorna }: Props) {
  return (
    <fieldset>
      <legend>Geometria</legend>

      <h4>Superfici per piano</h4>
      {stato.superfici.map((riga, i) => (
        <div key={i}>
          <label>
            Piano
            {/* Il dominio confronta i nomi piano per stringa esatta: un testo libero
                come "Piano terra" azzererebbe il driver della copertura e farebbe
                sparire il garage senza avvisi. La lista canonica vive in geometria.ts. */}
            <select
              value={riga.piano}
              onChange={(e) => aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { piano: e.target.value }) })}
            >
              <option value="">— seleziona il piano —</option>
              {PIANI_CANONICI.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
              {riga.piano !== '' && !(PIANI_CANONICI as readonly string[]).includes(riga.piano) && (
                // Un nome arrivato dall'estrazione e non riconosciuto resta visibile
                // e marcato: va corretto a mano, non fatto sparire.
                <option value={riga.piano}>{riga.piano} — nome non valido, da correggere</option>
              )}
            </select>
          </label>
          <label>
            Sup. lorda (mq)
            <input
              value={riga.valoreLordo}
              onChange={(e) => aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { valoreLordo: e.target.value }) })}
            />
          </label>
          <button type="button" onClick={() => aggiorna({ superfici: rimuoviRiga(stato.superfici, i) })}>
            Rimuovi
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => aggiorna({ superfici: [...stato.superfici, { piano: '', valoreLordo: '' } satisfies SuperficiePiano] })}
      >
        Aggiungi piano
      </button>

      <label>
        Totale superfici lorde calcolato: {totaleSuperficiLorde(stato.superfici)} mq — sovrascrivi (spec §3.9)
        <input
          type="number"
          value={stato.totaleLordoManuale ?? ''}
          placeholder={String(totaleSuperficiLorde(stato.superfici))}
          onChange={(e) => aggiorna({ totaleLordoManuale: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
      </label>

      <label>
        Perimetro (ml)
        <input type="number" value={stato.perimetro} onChange={(e) => aggiorna({ perimetro: Number(e.target.value) })} />
      </label>

      <h4>Serramenti</h4>
      {stato.serramenti.map((riga, i) => (
        <div key={i}>
          <label>
            Piano
            <input
              value={riga.piano}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { piano: e.target.value }) })}
            />
          </label>
          <label>
            Tipologia
            <input
              value={riga.tipologia}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { tipologia: e.target.value }) })}
            />
          </label>
          <label>
            Categoria
            <select
              value={riga.categoria}
              onChange={(e) =>
                aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { categoria: e.target.value as CategoriaSerramento }) })
              }
            >
              {CATEGORIE_SERRAMENTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Base (m)
            <input
              type="number"
              value={riga.b}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { b: Number(e.target.value) }) })}
            />
          </label>
          <label>
            Altezza (m)
            <input
              type="number"
              value={riga.h}
              onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { h: Number(e.target.value) }) })}
            />
          </label>
          <button type="button" onClick={() => aggiorna({ serramenti: rimuoviRiga(stato.serramenti, i) })}>
            Rimuovi
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          aggiorna({
            serramenti: [
              ...stato.serramenti,
              { n: stato.serramenti.length + 1, piano: '', tipologia: '', categoria: 'finestra-battente', b: 0, h: 0 } satisfies Serramento,
            ],
          })
        }
      >
        Aggiungi serramento
      </button>
    </fieldset>
  )
}
```

- [ ] **Step 5: Crea `src/app/preventivi/nuovo/steps/StepPrezzi.tsx`** (markup invariato dallo step 3 originale)

```tsx
import { CATALOGO_VOCI } from '@/domain/voci'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

const VALORI_TESTUALI_OVERRIDE = ['comprese', 'escluso', 'escluse', 'OMAGGIO'] as const
type ValoreTestualeOverride = (typeof VALORI_TESTUALI_OVERRIDE)[number]

function parseValoreOverride(testo: string): number | ValoreTestualeOverride | undefined {
  const pulito = testo.trim()
  if (pulito === '') return undefined
  if ((VALORI_TESTUALI_OVERRIDE as readonly string[]).includes(pulito)) return pulito as ValoreTestualeOverride
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? undefined : numero
}

function formattaValoreOverride(valore: number | ValoreTestualeOverride | undefined): string {
  if (valore === undefined) return ''
  return String(valore)
}

function parseValorizzataSicurezza(testo: string): number | 'OMAGGIO' | undefined {
  const pulito = testo.trim()
  if (pulito === '') return undefined
  if (pulito === 'OMAGGIO') return 'OMAGGIO'
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? undefined : numero
}

function formattaValorizzataSicurezza(valore: number | 'OMAGGIO'): string {
  return String(valore)
}

export function StepPrezzi({ stato, aggiorna }: Props) {
  return (
    <fieldset>
      <legend>Prezzi</legend>
      <h4>Override voci di listino</h4>
      {CATALOGO_VOCI.map((voce) => (
        <label key={voce.id}>
          {voce.id}
          <input
            value={formattaValoreOverride(stato.overrides[voce.id])}
            placeholder="proposto dal listino"
            onChange={(e) => {
              const valore = parseValoreOverride(e.target.value)
              const nuoviOverrides = { ...stato.overrides }
              if (valore === undefined) {
                delete nuoviOverrides[voce.id]
              } else {
                nuoviOverrides[voce.id] = valore
              }
              aggiorna({ overrides: nuoviOverrides })
            }}
          />
        </label>
      ))}
      <label>
        Totale target (per risoluzione arrotondamento)
        <input type="number" value={stato.totaleTarget} onChange={(e) => aggiorna({ totaleTarget: Number(e.target.value) })} />
      </label>
      <h4>Sicurezza</h4>
      <label>
        Costo dichiarato
        <input
          type="number"
          value={stato.sicurezza.costoDichiarato}
          onChange={(e) => aggiorna({ sicurezza: { ...stato.sicurezza, costoDichiarato: Number(e.target.value) } })}
        />
      </label>
      <label>
        Valorizzata (importo oppure OMAGGIO)
        <input
          value={formattaValorizzataSicurezza(stato.sicurezza.valorizzata)}
          onChange={(e) => {
            const valore = parseValorizzataSicurezza(e.target.value)
            if (valore !== undefined) aggiorna({ sicurezza: { ...stato.sicurezza, valorizzata: valore } })
          }}
        />
      </label>
    </fieldset>
  )
}
```

- [ ] **Step 6: Crea `src/app/preventivi/nuovo/steps/StepCondizioni.tsx`** (markup invariato dallo step 4 originale)

```tsx
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepCondizioni({ stato, aggiorna }: Props) {
  return (
    <fieldset>
      <legend>Condizioni</legend>
      <h4>Sconti a cascata</h4>
      {stato.sconti.map((sconto, i) => (
        <div key={i}>
          <label>
            Percentuale (%)
            <input
              type="number"
              value={sconto.percentuale * 100}
              onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { percentuale: Number(e.target.value) / 100 }) })}
            />
          </label>
          <label>
            Causale
            <input value={sconto.causale} onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { causale: e.target.value }) })} />
          </label>
          <button type="button" onClick={() => aggiorna({ sconti: rimuoviRiga(stato.sconti, i) })}>
            Rimuovi
          </button>
        </div>
      ))}
      <button type="button" onClick={() => aggiorna({ sconti: [...stato.sconti, { percentuale: 0, causale: '' }] })}>
        Aggiungi sconto
      </button>
    </fieldset>
  )
}
```

- [ ] **Step 7: Sostituisci integralmente `src/app/preventivi/nuovo/FormStrutturato.tsx`**

```tsx
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
```

- [ ] **Step 8: Verifica**

Run: `npm run typecheck && npm run test`
Expected: entrambi verdi. Il comportamento del wizard (percorrere gli step, compilare i campi) deve restare identico a prima dell'estrazione — è un refactor meccanico.

- [ ] **Step 9: Commit**

```bash
git add src/app/preventivi/nuovo/
git commit -m "refactor(wizard): estrae FormStrutturato in orchestratore + 5 file di step"
```

---

### Task 4: Restyling ChatApertura.tsx

**Files:**
- Modify: `src/app/preventivi/nuovo/ChatApertura.tsx` (sostituzione integrale)

**Interfaces:**
- Consumes: `Button`, `Alert` da Task 2

- [ ] **Step 1: Sostituisci `src/app/preventivi/nuovo/ChatApertura.tsx`**

```tsx
// src/app/preventivi/nuovo/ChatApertura.tsx
'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { Alert } from '../ui/Alert'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import type { StatoForm } from './stato-form'

interface Props {
  onEstrazioneCompletata: (parziale: Partial<StatoForm>, campiMancanti: string[]) => void
}

export function ChatApertura({ onEstrazioneCompletata }: Props) {
  const [testo, setTesto] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function invia() {
    setCaricamento(true)
    setErrore(null)
    try {
      const risposta = await fetch('/api/estrazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo }),
      })
      if (!risposta.ok) throw new Error('Estrazione fallita')
      const campi = await risposta.json()
      onEstrazioneCompletata(statoFormDaCampiEstratti(campi), campi.campiMancanti)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore imprevisto')
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-border-warm bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-accent">
        <Sparkles size={16} />
        <span className="text-[11px] font-bold uppercase tracking-wide">Apertura rapida</span>
      </div>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Descrivi il progetto in una frase: cliente, località, superfici, pacchetto..."
        rows={3}
        className="mb-3 w-full resize-none rounded-md border border-border-warm bg-cream px-3 py-2 text-sm text-text focus:border-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      <Button onClick={invia} disabled={caricamento || testo.trim() === ''}>
        {caricamento ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Sto leggendo...
          </span>
        ) : (
          'Compila dal testo'
        )}
      </Button>
      {errore && (
        <div className="mt-2">
          <Alert variant="errore">{errore}</Alert>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verifica**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/preventivi/nuovo/ChatApertura.tsx
git commit -m "style(wizard): restyle ChatApertura con Tailwind e primitive UI"
```

---

### Task 5: Restyling StepAnagrafica.tsx + StepConfigurazione.tsx

**Files:**
- Modify: `src/app/preventivi/nuovo/steps/StepAnagrafica.tsx` (sostituzione integrale)
- Modify: `src/app/preventivi/nuovo/steps/StepConfigurazione.tsx` (sostituzione integrale)

**Interfaces:**
- Consumes: `Field`, `controlClassName`, `Section` da Task 2

- [ ] **Step 1: Sostituisci `src/app/preventivi/nuovo/steps/StepAnagrafica.tsx`**

```tsx
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepAnagrafica({ stato, aggiorna }: Props) {
  return (
    <Section title="Anagrafica">
      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Cliente">
          <input
            className={controlClassName}
            value={stato.cliente.nome}
            onChange={(e) => aggiorna({ cliente: { ...stato.cliente, nome: e.target.value } })}
          />
        </Field>
        <Field label="Protocollo">
          <input className={controlClassName} value={stato.protocollo} onChange={(e) => aggiorna({ protocollo: e.target.value })} />
        </Field>
        <Field label="Comune">
          <input
            className={controlClassName}
            value={stato.cliente.comune}
            onChange={(e) => aggiorna({ cliente: { ...stato.cliente, comune: e.target.value } })}
          />
        </Field>
        <Field label="Provincia">
          <input
            className={controlClassName}
            value={stato.cliente.provincia}
            onChange={(e) => aggiorna({ cliente: { ...stato.cliente, provincia: e.target.value } })}
          />
        </Field>
        <Field label="Progettista">
          <input className={controlClassName} value={stato.progettista} onChange={(e) => aggiorna({ progettista: e.target.value })} />
        </Field>
        <Field label="Oggetto">
          <input className={controlClassName} value={stato.oggetto} onChange={(e) => aggiorna({ oggetto: e.target.value })} />
        </Field>
        <Field label="Data">
          <input type="date" className={controlClassName} value={stato.data} onChange={(e) => aggiorna({ data: e.target.value })} />
        </Field>
        <Field label="Luogo">
          <input className={controlClassName} value={stato.luogo} onChange={(e) => aggiorna({ luogo: e.target.value })} />
        </Field>
      </div>
    </Section>
  )
}
```

- [ ] **Step 2: Sostituisci `src/app/preventivi/nuovo/steps/StepConfigurazione.tsx`**

```tsx
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import type { LivelloModulo, Modulo } from '@/domain/voci'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

const LIVELLI_MODULO: LivelloModulo[] = ['completo', 'impoverito', 'escluso']
const MODULI: { chiave: Modulo; etichetta: string }[] = [
  { chiave: 'struttura', etichetta: 'Struttura' },
  { chiave: 'involucro', etichetta: 'Involucro' },
  { chiave: 'finiture', etichetta: 'Finiture' },
]

export function StepConfigurazione({ stato, aggiorna }: Props) {
  return (
    <Section title="Configurazione">
      <div className="grid grid-cols-3 gap-x-4">
        {MODULI.map(({ chiave, etichetta }) => (
          <Field key={chiave} label={etichetta}>
            <select
              className={controlClassName}
              value={stato.livelli[chiave]}
              onChange={(e) => aggiorna({ livelli: { ...stato.livelli, [chiave]: e.target.value as LivelloModulo } })}
            >
              {LIVELLI_MODULO.map((livello) => (
                <option key={livello} value={livello}>
                  {livello}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={stato.chiaviInManoNelTotale}
          onChange={(e) => aggiorna({ chiaviInManoNelTotale: e.target.checked })}
          className="h-4 w-4 rounded border-border-warm text-accent focus:ring-accent/30"
        />
        Chiavi in mano nel totale
      </label>

      <div className="grid grid-cols-2 gap-x-4">
        <Field label="Copertura">
          <select
            className={controlClassName}
            value={stato.caratteristiche.copertura}
            onChange={(e) =>
              aggiorna({ caratteristiche: { ...stato.caratteristiche, copertura: e.target.value as 'falde' | 'piano' } })
            }
          >
            <option value="falde">A falde</option>
            <option value="piano">Piano</option>
          </select>
        </Field>
        <Field label="Manto di copertura">
          <input
            className={controlClassName}
            value={stato.caratteristiche.manto}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, manto: e.target.value } })}
          />
        </Field>
        <Field label="Finitura esterna">
          <select
            className={controlClassName}
            value={stato.caratteristiche.finituraEsterna}
            onChange={(e) =>
              aggiorna({
                caratteristiche: { ...stato.caratteristiche, finituraEsterna: e.target.value as 'intonaco' | 'rivestimento' },
              })
            }
          >
            <option value="intonaco">Intonaco</option>
            <option value="rivestimento">Rivestimento</option>
          </select>
        </Field>
        <Field label="Tetto (descrizione)">
          <input
            className={controlClassName}
            value={stato.caratteristiche.tetto}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, tetto: e.target.value } })}
          />
        </Field>
      </div>
    </Section>
  )
}
```

- [ ] **Step 3: Verifica**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/nuovo/steps/StepAnagrafica.tsx src/app/preventivi/nuovo/steps/StepConfigurazione.tsx
git commit -m "style(wizard): restyle step Anagrafica e Configurazione"
```

---

### Task 6: Restyling StepGeometria.tsx + StepPrezzi.tsx

**Files:**
- Modify: `src/app/preventivi/nuovo/steps/StepGeometria.tsx` (sostituzione integrale)
- Modify: `src/app/preventivi/nuovo/steps/StepPrezzi.tsx` (sostituzione integrale)

**Interfaces:**
- Consumes: `Field`, `controlClassName`, `Section`, `Button` da Task 2; `aggiornaRiga`, `rimuoviRiga` da Task 3

- [ ] **Step 1: Sostituisci `src/app/preventivi/nuovo/steps/StepGeometria.tsx`**

```tsx
import { Plus, Trash2 } from 'lucide-react'
import {
  totaleSuperficiLorde,
  PIANI_CANONICI,
  CATEGORIE_SERRAMENTO,
  type CategoriaSerramento,
  type Serramento,
  type SuperficiePiano,
} from '@/domain/geometria'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import { Button } from '../../ui/Button'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepGeometria({ stato, aggiorna }: Props) {
  return (
    <Section title="Geometria">
      <Section title="Superfici per piano">
        {stato.superfici.map((riga, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <div className="flex-1">
              <Field label="Piano">
                {/* Il dominio confronta i nomi piano per stringa esatta: un testo libero
                    come "Piano terra" azzererebbe il driver della copertura e farebbe
                    sparire il garage senza avvisi. La lista canonica vive in geometria.ts. */}
                <select
                  className={controlClassName}
                  value={riga.piano}
                  onChange={(e) => aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { piano: e.target.value }) })}
                >
                  <option value="">— seleziona il piano —</option>
                  {PIANI_CANONICI.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                  {riga.piano !== '' && !(PIANI_CANONICI as readonly string[]).includes(riga.piano) && (
                    <option value={riga.piano}>{riga.piano} — nome non valido, da correggere</option>
                  )}
                </select>
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Sup. lorda (mq)">
                <input
                  className={controlClassName}
                  value={riga.valoreLordo}
                  onChange={(e) => aggiorna({ superfici: aggiornaRiga(stato.superfici, i, { valoreLordo: e.target.value }) })}
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Rimuovi piano"
              onClick={() => aggiorna({ superfici: rimuoviRiga(stato.superfici, i) })}
              className="mb-3"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => aggiorna({ superfici: [...stato.superfici, { piano: '', valoreLordo: '' } satisfies SuperficiePiano] })}
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi piano
          </span>
        </Button>

        <div className="mt-4">
          <Field label={`Totale superfici lorde calcolato: ${totaleSuperficiLorde(stato.superfici)} mq — sovrascrivi (spec §3.9)`}>
            <input
              type="number"
              className={controlClassName}
              value={stato.totaleLordoManuale ?? ''}
              placeholder={String(totaleSuperficiLorde(stato.superfici))}
              onChange={(e) => aggiorna({ totaleLordoManuale: e.target.value === '' ? undefined : Number(e.target.value) })}
            />
          </Field>
        </div>

        <Field label="Perimetro (ml)">
          <input
            type="number"
            className={controlClassName}
            value={stato.perimetro}
            onChange={(e) => aggiorna({ perimetro: Number(e.target.value) })}
          />
        </Field>
      </Section>

      <Section title="Serramenti">
        {stato.serramenti.map((riga, i) => (
          <div key={i} className="mb-2 grid grid-cols-5 items-end gap-2">
            <Field label="Piano">
              <input
                className={controlClassName}
                value={riga.piano}
                onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { piano: e.target.value }) })}
              />
            </Field>
            <Field label="Tipologia">
              <input
                className={controlClassName}
                value={riga.tipologia}
                onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { tipologia: e.target.value }) })}
              />
            </Field>
            <Field label="Categoria">
              <select
                className={controlClassName}
                value={riga.categoria}
                onChange={(e) =>
                  aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { categoria: e.target.value as CategoriaSerramento }) })
                }
              >
                {CATEGORIE_SERRAMENTO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Base (m)">
              <input
                type="number"
                className={controlClassName}
                value={riga.b}
                onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { b: Number(e.target.value) }) })}
              />
            </Field>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Altezza (m)">
                  <input
                    type="number"
                    className={controlClassName}
                    value={riga.h}
                    onChange={(e) => aggiorna({ serramenti: aggiornaRiga(stato.serramenti, i, { h: Number(e.target.value) }) })}
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label="Rimuovi serramento"
                onClick={() => aggiorna({ serramenti: rimuoviRiga(stato.serramenti, i) })}
                className="mb-3"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            aggiorna({
              serramenti: [
                ...stato.serramenti,
                { n: stato.serramenti.length + 1, piano: '', tipologia: '', categoria: 'finestra-battente', b: 0, h: 0 } satisfies Serramento,
              ],
            })
          }
        >
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi serramento
          </span>
        </Button>
      </Section>
    </Section>
  )
}
```

- [ ] **Step 2: Sostituisci `src/app/preventivi/nuovo/steps/StepPrezzi.tsx`**

```tsx
import { CATALOGO_VOCI } from '@/domain/voci'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

const VALORI_TESTUALI_OVERRIDE = ['comprese', 'escluso', 'escluse', 'OMAGGIO'] as const
type ValoreTestualeOverride = (typeof VALORI_TESTUALI_OVERRIDE)[number]

function parseValoreOverride(testo: string): number | ValoreTestualeOverride | undefined {
  const pulito = testo.trim()
  if (pulito === '') return undefined
  if ((VALORI_TESTUALI_OVERRIDE as readonly string[]).includes(pulito)) return pulito as ValoreTestualeOverride
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? undefined : numero
}

function formattaValoreOverride(valore: number | ValoreTestualeOverride | undefined): string {
  if (valore === undefined) return ''
  return String(valore)
}

function parseValorizzataSicurezza(testo: string): number | 'OMAGGIO' | undefined {
  const pulito = testo.trim()
  if (pulito === '') return undefined
  if (pulito === 'OMAGGIO') return 'OMAGGIO'
  const numero = Number.parseFloat(pulito.replace(',', '.'))
  return Number.isNaN(numero) ? undefined : numero
}

function formattaValorizzataSicurezza(valore: number | 'OMAGGIO'): string {
  return String(valore)
}

export function StepPrezzi({ stato, aggiorna }: Props) {
  return (
    <Section title="Prezzi">
      <Section title="Override voci di listino">
        <div className="grid grid-cols-3 gap-x-4">
          {CATALOGO_VOCI.map((voce) => (
            <Field key={voce.id} label={voce.id}>
              <input
                className={controlClassName}
                value={formattaValoreOverride(stato.overrides[voce.id])}
                placeholder="proposto dal listino"
                onChange={(e) => {
                  const valore = parseValoreOverride(e.target.value)
                  const nuoviOverrides = { ...stato.overrides }
                  if (valore === undefined) {
                    delete nuoviOverrides[voce.id]
                  } else {
                    nuoviOverrides[voce.id] = valore
                  }
                  aggiorna({ overrides: nuoviOverrides })
                }}
              />
            </Field>
          ))}
        </div>
      </Section>

      <Field label="Totale target (per risoluzione arrotondamento)">
        <input
          type="number"
          className={controlClassName}
          value={stato.totaleTarget}
          onChange={(e) => aggiorna({ totaleTarget: Number(e.target.value) })}
        />
      </Field>

      <Section title="Sicurezza">
        <div className="grid grid-cols-2 gap-x-4">
          <Field label="Costo dichiarato">
            <input
              type="number"
              className={controlClassName}
              value={stato.sicurezza.costoDichiarato}
              onChange={(e) => aggiorna({ sicurezza: { ...stato.sicurezza, costoDichiarato: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Valorizzata (importo oppure OMAGGIO)">
            <input
              className={controlClassName}
              value={formattaValorizzataSicurezza(stato.sicurezza.valorizzata)}
              onChange={(e) => {
                const valore = parseValorizzataSicurezza(e.target.value)
                if (valore !== undefined) aggiorna({ sicurezza: { ...stato.sicurezza, valorizzata: valore } })
              }}
            />
          </Field>
        </div>
      </Section>
    </Section>
  )
}
```

- [ ] **Step 3: Verifica**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/nuovo/steps/StepGeometria.tsx src/app/preventivi/nuovo/steps/StepPrezzi.tsx
git commit -m "style(wizard): restyle step Geometria e Prezzi"
```

---

### Task 7: Restyling StepCondizioni.tsx

**Files:**
- Modify: `src/app/preventivi/nuovo/steps/StepCondizioni.tsx` (sostituzione integrale)

**Interfaces:**
- Consumes: `Field`, `controlClassName`, `Section`, `Button` da Task 2; `aggiornaRiga`, `rimuoviRiga` da Task 3

- [ ] **Step 1: Sostituisci `src/app/preventivi/nuovo/steps/StepCondizioni.tsx`**

```tsx
import { Plus, Trash2 } from 'lucide-react'
import { Field, controlClassName } from '../../ui/Field'
import { Section } from '../../ui/Section'
import { Button } from '../../ui/Button'
import { aggiornaRiga, rimuoviRiga } from '../riga-utils'
import type { StatoForm } from '../stato-form'

interface Props {
  stato: StatoForm
  aggiorna: (parziale: Partial<StatoForm>) => void
}

export function StepCondizioni({ stato, aggiorna }: Props) {
  return (
    <Section title="Condizioni">
      <Section title="Sconti a cascata">
        {stato.sconti.map((sconto, i) => (
          <div key={i} className="mb-2 flex items-end gap-2">
            <div className="flex-1">
              <Field label="Percentuale (%)">
                <input
                  type="number"
                  className={controlClassName}
                  value={sconto.percentuale * 100}
                  onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { percentuale: Number(e.target.value) / 100 }) })}
                />
              </Field>
            </div>
            <div className="flex-1">
              <Field label="Causale">
                <input
                  className={controlClassName}
                  value={sconto.causale}
                  onChange={(e) => aggiorna({ sconti: aggiornaRiga(stato.sconti, i, { causale: e.target.value }) })}
                />
              </Field>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label="Rimuovi sconto"
              onClick={() => aggiorna({ sconti: rimuoviRiga(stato.sconti, i) })}
              className="mb-3"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => aggiorna({ sconti: [...stato.sconti, { percentuale: 0, causale: '' }] })}>
          <span className="flex items-center gap-1.5">
            <Plus size={14} /> Aggiungi sconto
          </span>
        </Button>
      </Section>
    </Section>
  )
}
```

- [ ] **Step 2: Verifica**

Run: `npm run typecheck`
Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/preventivi/nuovo/steps/StepCondizioni.tsx
git commit -m "style(wizard): restyle step Condizioni"
```

---

### Task 8: Restyling WizardConSalvataggio.tsx + avvisi in PannelloPreview.tsx

Chiude il layout a due colonne e i due punti dove compaiono gli `Alert` (errore di salvataggio e avvisi di coerenza). Gli avvisi di coerenza vivono nel wrapper di `PannelloPreview.tsx` — non nelle pagine A4 (`Pagina*.tsx`, fuori scope): restyling della sola `<section>` che li contiene, nessuna modifica a `verificaCoerenza` né alle pagine del documento.

**Files:**
- Modify: `src/app/preventivi/WizardConSalvataggio.tsx` (sostituzione integrale)
- Modify: `src/app/preventivi/nuovo/PannelloPreview.tsx:1-14` (aggiunta import `Alert`) e `:39-49` (blocco avvisi)

**Interfaces:**
- Consumes: `Button`, `Alert` da Task 2

- [ ] **Step 1: Sostituisci `src/app/preventivi/WizardConSalvataggio.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { eseguiCalcolo } from '@/domain/calcolo'
import { Button } from './ui/Button'
import { Alert } from './ui/Alert'
import { FormStrutturato } from './nuovo/FormStrutturato'
import { PannelloPreview } from './nuovo/PannelloPreview'
import { inputCalcoloDaStato, type StatoForm } from './nuovo/stato-form'

interface PreventivoEsistente {
  id: string
  numero: number
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  preventivoEsistente?: PreventivoEsistente
  onSalvato?: (salvataggio: PreventivoEsistente) => void
}

export function WizardConSalvataggio({ statoIniziale, preventivoEsistente, onSalvato }: Props) {
  const [stato, setStato] = useState<StatoForm | null>(null)
  const [salvataggio, setSalvataggio] = useState<PreventivoEsistente | null>(preventivoEsistente ?? null)
  const [statoSalvataggio, setStatoSalvataggio] = useState<'inattivo' | 'in-corso' | 'errore'>('inattivo')

  async function salvaBozza() {
    if (!stato) return
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
        if (!risposta.ok) throw new Error(`Salvataggio fallito (${risposta.status}): ${await risposta.text().catch(() => '')}`)
      } else {
        const risposta = await fetch('/api/preventivi', { method: 'POST', body: JSON.stringify(corpo) })
        if (!risposta.ok) throw new Error(`Salvataggio fallito (${risposta.status}): ${await risposta.text().catch(() => '')}`)
        const preventivo = await risposta.json()
        const nuovoSalvataggio = { id: preventivo.id, numero: preventivo.revisioni[0].numero }
        setSalvataggio(nuovoSalvataggio)
        onSalvato?.(nuovoSalvataggio)
      }
      setStatoSalvataggio('inattivo')
    } catch (errore) {
      console.error('Salvataggio bozza fallito:', errore)
      setStatoSalvataggio('errore')
    }
  }

  return (
    <div className="mx-auto flex max-w-[1400px] gap-6 bg-cream p-6 text-text">
      <div className="flex flex-[1.1] flex-col">
        <FormStrutturato statoIniziale={statoIniziale} onCambiamento={setStato} />
        <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-border-warm bg-cream py-3">
          <Button type="button" onClick={salvaBozza} disabled={!stato || statoSalvataggio === 'in-corso'}>
            <span className="flex items-center gap-2">
              {statoSalvataggio === 'in-corso' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salva bozza
            </span>
          </Button>
          {statoSalvataggio === 'errore' && <Alert variant="errore">Salvataggio fallito, riprova.</Alert>}
        </div>
      </div>
      <div className="flex-1">
        <div className="sticky top-6">{stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modifica il blocco avvisi in `src/app/preventivi/nuovo/PannelloPreview.tsx`**

Sostituisci l'import in cima al file:

```tsx
import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { totaleSuperficiLorde, PIANO_GARAGE } from '@/domain/geometria'
import { generaAbacoPerCategoria } from '@/ai/abaco'
import { verificaCoerenza } from '@/ai/coerenza'
import { Alert } from '../ui/Alert'
import { PaginaCaratteristiche } from '@/documento/preview/PaginaCaratteristiche'
import { PaginaPrezzi } from '@/documento/preview/PaginaPrezzi'
import { PaginaAbacoSerramenti } from '@/documento/preview/PaginaAbacoSerramenti'
import { PaginaCondizioni } from '@/documento/preview/PaginaCondizioni'
import { SAL_DEFAULT, CONDIZIONE_DA_DEFINIRE } from '@/documento/condizioni-default'
import { pacchettoDaLivelli } from './stato-form'
import type { StatoForm } from './stato-form'
```

Sostituisci il blocco degli avvisi (il resto del componente, dal `return` in poi, resta identico):

```tsx
  return (
    <div>
      {avvisi.length > 0 && (
        <section aria-label="Avvisi di coerenza" className="mb-4 space-y-2">
          {avvisi.map((avviso, i) => (
            <div key={`${avviso.tipo}-${i}`} data-tipo-avviso={avviso.tipo}>
              <Alert variant="avviso">{avviso.messaggio}</Alert>
            </div>
          ))}
        </section>
      )}
      <PaginaCaratteristiche
        sistemaCostruttivo="MassivHolzMauer® (M.H.M.)"
        tetto={stato.caratteristiche.tetto}
        mantoCopertura={stato.caratteristiche.manto}
        finituraEsterna={
          stato.caratteristiche.finituraEsterna.charAt(0).toUpperCase() + stato.caratteristiche.finituraEsterna.slice(1)
        }
        pacchetto={pacchettoDaLivelli(stato.livelli)}
        superfici={stato.superfici.filter((s) => s.piano !== PIANO_GARAGE)}
        superficieGarage={stato.superfici.find((s) => s.piano === PIANO_GARAGE)?.valoreLordo ?? ''}
      />
      <PaginaPrezzi risultato={risultato} annoListino={input.listino.anno} />
      {/* Il wizard non raccoglie ancora le condizioni (follow-up): la scaletta SAL
          usa i default reali FBE, mentre caparra/consegna/validità restano
          segnaposto espliciti perché l'operatore veda che sono da compilare. */}
      <PaginaCondizioni
        caparra={CONDIZIONE_DA_DEFINIRE}
        sal={SAL_DEFAULT}
        consegna={CONDIZIONE_DA_DEFINIRE}
        validita={CONDIZIONE_DA_DEFINIRE}
      />
      <PaginaAbacoSerramenti abaco={abaco} />
    </div>
  )
}
```

Ho lasciato invariato tutto ciò che sta **sopra** al `return` (calcolo di `risultato`, `abaco`, `avvisi`): nessuna modifica di logica, solo il markup del blocco avvisi e l'import di `Alert`.

- [ ] **Step 3: Verifica**

Run: `npm run typecheck && npm run test`
Expected: entrambi verdi.

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/WizardConSalvataggio.tsx src/app/preventivi/nuovo/PannelloPreview.tsx
git commit -m "style(wizard): layout a due colonne con preview sticky, Alert per errori e avvisi"
```

---

### Task 9: Verifica end-to-end nel browser di sviluppo

**Files:** nessuno — solo verifica manuale.

- [ ] **Step 1: Avvia il dev server**

```bash
npm run dev
```

- [ ] **Step 2: Apri `http://localhost:3000/preventivi/nuovo` nel browser e verifica visivamente**

- Il fondo del wizard è color crema (`#FAF6F0`), i campi hanno bordo `#E8DCC8`, il font è Inter (non il font di sistema di default)
- Lo stepper mostra 5 tab, quella attiva piena color accento (`#8B5E34`), le altre chiare
- Cliccando su una tab non corrente il form cambia step (comportamento invariato)
- Compilando i campi dell'Anagrafica con i dati del golden case Crivellaro (cliente "Crivellaro Mariano", protocollo "2026059") e passando allo step Geometria con `Piano Terra = 134`, `Portico = 13+14`, `Garage = 41`, un serramento `2,00 × 1,80`, la colonna di preview a destra mostra la pagina A4 ancora in `Georgia, serif` su sfondo bianco (non toccata dal restyling)
- Il bottone "Salva bozza" resta visibile scorrendo lo step Prezzi (che ha molte righe) — verifica lo `sticky bottom-0`
- Disabilita la rete (o interrompi il server API) e prova a salvare: compare l'`Alert` rosso "Salvataggio fallito, riprova."

- [ ] **Step 3: Verifica il golden case nel pannello prezzi**

Compilando geometria e listino come da `docs/superpowers/specs/2026-08-04-fbe-preventivatore-design.md` §11 (Listino 2026 = 237 000,00; due sconti 10%+10%; totale target 300 000), la `PaginaPrezzi` nella preview deve mostrare `PARZIALE 190 900,00` e `TOTALE 300 000,00` — invariati rispetto a prima del restyling, perché nessuna logica di calcolo è stata toccata.

- [ ] **Step 4: Esegui la suite completa**

Run: `npm run typecheck && npm run test && npm run build`
Expected: tutti e tre verdi.

- [ ] **Step 5: Commit finale (se necessario)**

Se il Task 9 non ha richiesto modifiche al codice, non c'è nulla da committare: è solo verifica. Se durante la verifica emergono difetti visivi da correggere, applicali nei file pertinenti e committa con un messaggio `fix(ui): ...`.
