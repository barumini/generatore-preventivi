# FBE Preventivatore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire il motore di calcolo, il wizard AI e l'export docx del preventivatore FBE, verificato contro il caso reale Crivellaro (rev.04).

**Architecture:** Next.js 16 (App Router) + TypeScript, con un layer di dominio puro (`src/domain/`) senza dipendenze da React/Prisma/rete, testato in TDD contro numeri reali estratti dai documenti FBE. L'AI interviene solo in tre punti isolati (estrazione campi, generazione abaco, controlli di coerenza), mai nel calcolo dei prezzi. L'export usa il `.docx` master esistente come template, iniettando solo le pagine variabili.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest 3, Prisma 7 + SQLite, docxtemplater + pizzip, `@anthropic-ai/sdk` (dietro un'interfaccia sostituibile nei test).

## Global Constraints

Dalla spec (`docs/superpowers/specs/2026-08-04-fbe-preventivatore-design.md`) e da `CLAUDE.md`:

- Gli sconti sono **a cascata**: il secondo sconto si applica al residuo dopo il primo, non al totale originale.
- Le voci si dividono in due gruppi: `grezzo` (entra nel Listino, subisce gli sconti) e `post_sconto` (si somma dopo il PARZIALE, non scontato).
- Il motore deve risolvere anche il problema inverso: dato un totale target, calcolare l'arrotondamento necessario.
- I numeri di voce (`1`, `1.a`, `4.a`) sono calcolati al render sulle voci incluse — nel catalogo si usano id stabili (`pareti-mhm`, `copertura-falda`, …), mai numeri come costanti.
- L'importo di una voce può essere `number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'`. Solo i numeri entrano nelle somme.
- Ogni revisione salva una copia dei parametri di prezzo usati (snapshot), non un riferimento al listino corrente.
- L'AI non decide i prezzi: propone dal listino parametrico o registra input manuale. Ogni importo porta la propria provenienza (`proposto` | `manuale` | `ripartito`).
- Formato importi italiano nell'export: `96 100,00 €` (spazio migliaia, virgola decimale).
- Golden case Crivellaro (vedi Task 8): `Listino 2026 = 237 000,00` → `−23 700,00` → `−21 330,00` → arrotondamento `−1 070,00` → `PARZIALE = 190 900,00` → `TOTALE = 300 000,00`.

---

## File Structure

```
FbePreventivatore/
├── package.json, tsconfig.json, next.config.ts, vitest.config.ts
├── prisma/
│   └── schema.prisma
├── template/
│   ├── Offerta MHM master.docx        (preparato con placeholder, Task 16)
│   └── spike/                          (Task 2, poi cancellabile)
├── src/
│   ├── domain/                         TS puro, zero dipendenze da React/Prisma/rete
│   │   ├── geometria.ts / geometria.test.ts
│   │   ├── listino.ts / listino.test.ts
│   │   ├── voci.ts / voci.test.ts
│   │   └── calcolo.ts / calcolo.test.ts
│   ├── ai/
│   │   ├── abaco.ts / abaco.test.ts          deterministico, nessun LLM
│   │   ├── coerenza.ts / coerenza.test.ts    deterministico, nessun LLM
│   │   └── estrazione.ts / estrazione.test.ts  LLM dietro interfaccia sostituibile
│   ├── documento/
│   │   ├── export-docx.ts / export-docx.test.ts
│   │   └── preview/
│   │       ├── PaginaCaratteristiche.tsx
│   │       ├── PaginaPrezzi.tsx
│   │       ├── PaginaCondizioni.tsx
│   │       ├── PaginaAbacoSerramenti.tsx
│   │       └── print.css
│   └── app/                            Next.js App Router
│       ├── layout.tsx
│       ├── page.tsx
│       └── preventivi/nuovo/
│           ├── page.tsx
│           ├── ChatApertura.tsx
│           ├── FormStrutturato.tsx
│           └── PannelloPreview.tsx
└── docs/superpowers/{specs,plans}/
```

**Nota sulla deviazione dalla spec §7:** la spec disegna `app/domain`, `app/ai`, `app/documento`, `app/app` come sottocartelle di un unico `app/` di progetto. In Next.js App Router, qualunque sottocartella della directory router (`app/`) viene trattata come segmento di rotta se contiene file speciali, ed è comunque una fonte di confusione tenerci dentro codice non-UI. Per questo il layer di dominio, l'AI e i componenti documento vivono in `src/{domain,ai,documento}/`, fuori dalla directory router `src/app/`. La separazione di responsabilità voluta dalla spec (dominio senza dipendenze da framework) resta identica; cambia solo il percorso fisico.

---

### Task 1: Scaffold del progetto Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `prisma/schema.prisma` (scheletro minimo, esteso in Task 9)
- Test: `src/app/smoke.test.ts`

**Interfaces:**
- Produce: comando `npm test` (vitest) e `npm run dev` (next) funzionanti per tutti i task successivi.

- [ ] **Step 1: Creare `package.json`**

```json
{
  "name": "fbe-preventivatore",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.2.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@prisma/client": "^7.0.0",
    "docxtemplater": "^3.65.0",
    "pizzip": "^3.2.0",
    "@anthropic-ai/sdk": "^0.68.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "typescript": "^5.9.0",
    "vitest": "^3.2.0",
    "prisma": "^7.0.0",
    "@types/node": "^22.15.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0"
  }
}
```

- [ ] **Step 2: Creare `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Creare `next.config.ts`**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

- [ ] **Step 4: Creare `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 5: Creare `src/app/layout.tsx` e `src/app/page.tsx`**

```tsx
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// src/app/page.tsx
export default function Home() {
  return <main>FBE Preventivatore</main>
}
```

- [ ] **Step 6: Creare `prisma/schema.prisma` (scheletro, esteso in Task 9)**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Cliente {
  id   String @id @default(cuid())
  nome String
}
```

- [ ] **Step 7: Scrivere il test di fumo**

```ts
// src/app/smoke.test.ts
import { describe, expect, it } from 'vitest'

describe('scaffold', () => {
  it('esegue un assert semplice', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 8: Installare le dipendenze e verificare**

Run: `npm install && npm test`
Expected: `1 passed`

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json next.config.ts vitest.config.ts prisma/schema.prisma src/app
git commit -m "chore: scaffold progetto Next.js + vitest + prisma"
```

---

### Task 2: Spike — iniezione di placeholder nel master `.docx`

Deve essere il primo task tecnico eseguito, come richiesto dalla spec §10.3: se il master resiste all'iniezione, la strada `docxtemplater` è confermata prima di costruire tutto il resto sopra.

**Files:**
- Create: `template/spike/spike.ts`
- Create: `template/spike/README.md` (esito, non è documentazione di prodotto: è il verbale dello spike)
- Legge: `Documentazione addestramento/Offerta MHM rev.04_crivellaro.pdf` solo come riferimento visuale — il file da modificare è una **copia di lavoro** del master Word (va richiesto a FBE se non già presente come `.docx` navigabile; se in questa fase è disponibile solo `Offerta MHM rev.00_.docx`, usare quello come master di partenza).

**Interfaces:**
- Produce: verdetto booleano "docxtemplater funziona sul master reale" che condiziona Task 16/17.

- [ ] **Step 1: Copiare il master di lavoro**

```bash
mkdir -p template/spike
cp "Documentazione addestramento/Offerta MHM rev.00_.docx" template/spike/master-originale.docx
```

- [ ] **Step 2: Inserire due placeholder nel `.docx` copiato**

Aprire `template/spike/master-originale.docx` in Word/LibreOffice, salvare una copia come `template/spike/master-con-placeholder.docx` con:
- in copertina, il nome cliente sostituito da `{cliente}`
- nella tabella prezzi (o dove oggi c'è l'immagine/oggetto Excel), una cella di testo con `{totaleNetto}`

- [ ] **Step 3: Scrivere lo script di iniezione**

```ts
// template/spike/spike.ts
import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

const percorsoMaster = path.resolve(import.meta.dirname, 'master-con-placeholder.docx')
const percorsoOutput = path.resolve(import.meta.dirname, 'output-spike.docx')

const contenuto = fs.readFileSync(percorsoMaster, 'binary')
const zip = new PizZip(contenuto)
const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

doc.render({
  cliente: 'Spike Test Cliente',
  totaleNetto: '300 000,00 €',
})

const buffer = doc.getZip().generate({ type: 'nodebuffer' })
fs.writeFileSync(percorsoOutput, buffer)
console.log('Scritto', percorsoOutput)
```

- [ ] **Step 4: Eseguire lo spike**

Run: `npx tsx template/spike/spike.ts`
Expected: file `template/spike/output-spike.docx` creato senza eccezioni.

Se `Docxtemplater` lancia un errore di tag non chiuso/multipart (tipico coi placeholder dentro caselle di testo con `mc:AlternateContent`, come descritto in spec §10.3): riprovare mettendo il placeholder in un paragrafo di testo semplice fuori dalla casella di testo, per isolare se il problema è la casella o la sintassi del tag.

- [ ] **Step 5: Aprire `output-spike.docx` e verificare a occhio**

Verificare che `{cliente}` sia stato sostituito con `Spike Test Cliente` e `{totaleNetto}` con `300 000,00 €`, senza corruzione del resto del layout (immagini, caselle di testo adiacenti intatte).

- [ ] **Step 6: Scrivere il verbale**

```markdown
# template/spike/README.md

## Esito

- [ ] docxtemplater inietta correttamente placeholder in paragrafi di testo semplice
- [ ] docxtemplater inietta correttamente placeholder dentro caselle di testo
- [ ] Verdetto: PROCEDI con docxtemplater / RIPIEGA su HTML→PDF

## Note
(annotare qui eventuali errori di parsing e la soluzione trovata)
```

Compilare le checkbox in base al risultato reale osservato al Step 5.

- [ ] **Step 7: Commit**

```bash
git add template/spike
git commit -m "spike: verifica iniezione placeholder su master docx reale"
```

Se il verdetto è RIPIEGA, fermarsi qui e tornare alla sezione 10.2/10.3 della spec con l'utente prima di continuare: cambia l'architettura di Task 16-17.

---

### Task 3: `domain/geometria.ts` — serramenti

**Files:**
- Create: `src/domain/geometria.ts`
- Test: `src/domain/geometria.test.ts`

**Interfaces:**
- Produce: `Serramento`, `AperturaCalcolata`, `DetrazioniSerramenti`, `DETRAZIONI_DEFAULT`, `calcolaApertura()`, `totaliSerramenti()` — usati da Task 5 (`ai/abaco.ts`) e Task 7 (`domain/calcolo.ts`).

- [ ] **Step 1: Scrivere i test con il fixture Crivellaro (da `Conteggi pulito.xlsx`)**

```ts
// src/domain/geometria.test.ts
import { describe, expect, it } from 'vitest'
import { calcolaApertura, totaliSerramenti, DETRAZIONI_DEFAULT, type Serramento } from './geometria'

const SERRAMENTI_CRIVELLARO: Serramento[] = [
  { n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1.0, h: 2.2 },
  { n: 2, piano: 'PT', tipologia: 'finestra', b: 2.0, h: 1.8 },
  { n: 3, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 2.2 },
  { n: 4, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 5, piano: 'PT', tipologia: 'doppia finestra', b: 0.9, h: 1.2 },
  { n: 6, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 7, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 8, piano: 'PT', tipologia: 'finestra', b: 2.6, h: 2.2 },
  { n: 9, piano: 'PT', tipologia: 'finestra', b: 2.8, h: 2.2 },
  { n: 10, piano: 'PT', tipologia: 'portafinestra', b: 2.2, h: 2.2 },
  { n: 11, piano: 'PT', tipologia: 'finestra', b: 0.8, h: 2.1 },
]

describe('calcolaApertura', () => {
  it('calcola area lorda e netta con le detrazioni standard 0,60 x 0,30', () => {
    const risultato = calcolaApertura({ n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1.0, h: 2.2 })
    expect(risultato.areaLorda).toBeCloseTo(2.2, 2)
    expect(risultato.larghezzaNetta).toBeCloseTo(0.4, 2)
    expect(risultato.altezzaNetta).toBeCloseTo(1.9, 2)
    expect(risultato.areaNetta).toBeCloseTo(0.76, 2)
  })

  it('accetta detrazioni personalizzate', () => {
    const risultato = calcolaApertura(
      { n: 1, piano: 'PT', tipologia: 'finestra', b: 1.0, h: 1.0 },
      { orizzontale: 0, verticale: 0 },
    )
    expect(risultato.areaNetta).toBeCloseTo(1.0, 2)
  })
})

describe('totaliSerramenti — golden case Crivellaro', () => {
  it('riproduce 30,50 mq lordi e 15,89 mq netti dal foglio Conteggi pulito.xlsx', () => {
    const { areaLordaTotale, areaNettaTotale, numero } = totaliSerramenti(SERRAMENTI_CRIVELLARO)
    expect(areaLordaTotale).toBeCloseTo(30.5, 2)
    expect(areaNettaTotale).toBeCloseTo(15.89, 2)
    expect(numero).toBe(11)
  })
})

describe('DETRAZIONI_DEFAULT', () => {
  it('vale 0,60 orizzontale e 0,30 verticale', () => {
    expect(DETRAZIONI_DEFAULT).toEqual({ orizzontale: 0.6, verticale: 0.3 })
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- geometria`
Expected: FAIL — `./geometria` non esiste.

- [ ] **Step 3: Implementare `src/domain/geometria.ts`**

```ts
// src/domain/geometria.ts

export interface Serramento {
  n: number
  piano: string
  tipologia: string
  b: number
  h: number
}

export interface AperturaCalcolata extends Serramento {
  areaLorda: number
  larghezzaNetta: number
  altezzaNetta: number
  areaNetta: number
}

export interface DetrazioniSerramenti {
  orizzontale: number
  verticale: number
}

export const DETRAZIONI_DEFAULT: DetrazioniSerramenti = { orizzontale: 0.6, verticale: 0.3 }

function arrotonda2(valore: number): number {
  return Math.round(valore * 100) / 100
}

export function calcolaApertura(
  serramento: Serramento,
  detrazioni: DetrazioniSerramenti = DETRAZIONI_DEFAULT,
): AperturaCalcolata {
  const areaLorda = arrotonda2(serramento.b * serramento.h)
  const larghezzaNetta = arrotonda2(serramento.b - detrazioni.orizzontale)
  const altezzaNetta = arrotonda2(serramento.h - detrazioni.verticale)
  const areaNetta = arrotonda2(larghezzaNetta * altezzaNetta)
  return { ...serramento, areaLorda, larghezzaNetta, altezzaNetta, areaNetta }
}

export function totaliSerramenti(
  serramenti: Serramento[],
  detrazioni: DetrazioniSerramenti = DETRAZIONI_DEFAULT,
): { aperture: AperturaCalcolata[]; areaLordaTotale: number; areaNettaTotale: number; numero: number } {
  const aperture = serramenti.map((s) => calcolaApertura(s, detrazioni))
  const areaLordaTotale = arrotonda2(aperture.reduce((somma, a) => somma + a.areaLorda, 0))
  const areaNettaTotale = arrotonda2(aperture.reduce((somma, a) => somma + a.areaNetta, 0))
  return { aperture, areaLordaTotale, areaNettaTotale, numero: serramenti.length }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- geometria`
Expected: PASS — tutti i test verdi.

- [ ] **Step 5: Commit**

```bash
git add src/domain/geometria.ts src/domain/geometria.test.ts
git commit -m "feat(domain): geometria serramenti, golden case 30,50/15,89 mq"
```

---

### Task 4: `domain/geometria.ts` — superfici per piano

**Files:**
- Modify: `src/domain/geometria.ts`
- Test: `src/domain/geometria.test.ts`

**Interfaces:**
- Consuma: nessuno da altri task.
- Produce: `SuperficiePiano`, `PIANI_ABITATIVI`, `PIANO_GARAGE`, `risolviValoreLordo()`, `totaleSuperficiLorde()`, `superficieGarage()`, `numeroPianiAbitativi()` — usati da Task 5 (`voci.ts`, per `ConfigurazioneVoci`) e Task 7 (`calcolo.ts`, per `InputGeometrico`).

- [ ] **Step 1: Aggiungere i test per le superfici**

```ts
// aggiunta a src/domain/geometria.test.ts
import {
  risolviValoreLordo,
  totaleSuperficiLorde,
  superficieGarage,
  numeroPianiAbitativi,
  type SuperficiePiano,
} from './geometria'

const SUPERFICI_CRIVELLARO: SuperficiePiano[] = [
  { piano: 'Piano Terra', valoreLordo: '134' },
  { piano: 'Portico', valoreLordo: '13+14' },
  { piano: 'Garage', valoreLordo: '41' },
]

describe('risolviValoreLordo', () => {
  it('somma valori concatenati da +', () => {
    expect(risolviValoreLordo('13+14')).toBe(27)
  })

  it('accetta un numero singolo', () => {
    expect(risolviValoreLordo('134')).toBe(134)
  })

  it('tratta la stringa vuota come 0', () => {
    expect(risolviValoreLordo('')).toBe(0)
  })
})

describe('totaleSuperficiLorde — golden case Crivellaro', () => {
  it('somma 134 + 13 + 14 = 161, escludendo il Garage', () => {
    expect(totaleSuperficiLorde(SUPERFICI_CRIVELLARO)).toBe(161)
  })
})

describe('superficieGarage', () => {
  it('estrae il valore della riga Garage separatamente', () => {
    expect(superficieGarage(SUPERFICI_CRIVELLARO)).toBe(41)
  })

  it('vale 0 se non c\'è nessuna riga Garage', () => {
    expect(superficieGarage([{ piano: 'Piano Terra', valoreLordo: '100' }])).toBe(0)
  })
})

describe('numeroPianiAbitativi', () => {
  it('conta solo Piano Terra/Primo/sottotetto con valore positivo — Crivellaro è monopiano', () => {
    expect(numeroPianiAbitativi(SUPERFICI_CRIVELLARO)).toBe(1)
  })

  it('conta due piani se Piano Primo ha un valore', () => {
    const superfici: SuperficiePiano[] = [
      { piano: 'Piano Terra', valoreLordo: '63' },
      { piano: 'Piano Primo', valoreLordo: '63' },
    ]
    expect(numeroPianiAbitativi(superfici)).toBe(2)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- geometria`
Expected: FAIL — `risolviValoreLordo` non esiste.

- [ ] **Step 3: Implementare le funzioni in `src/domain/geometria.ts`**

```ts
// aggiunta a src/domain/geometria.ts

export interface SuperficiePiano {
  piano: string
  valoreLordo: string
}

export const PIANI_ABITATIVI = ['Piano Terra', 'Piano Primo', 'Piano sottotetto'] as const
export const PIANO_GARAGE = 'Garage'

export function risolviValoreLordo(valore: string): number {
  if (valore.trim() === '') return 0
  return valore
    .split('+')
    .map((parte) => Number.parseFloat(parte.trim().replace(',', '.')))
    .reduce((somma, numero) => somma + (Number.isNaN(numero) ? 0 : numero), 0)
}

export function totaleSuperficiLorde(superfici: SuperficiePiano[]): number {
  return arrotonda2(
    superfici
      .filter((s) => s.piano !== PIANO_GARAGE)
      .reduce((somma, s) => somma + risolviValoreLordo(s.valoreLordo), 0),
  )
}

export function superficieGarage(superfici: SuperficiePiano[]): number {
  const riga = superfici.find((s) => s.piano === PIANO_GARAGE)
  return riga ? risolviValoreLordo(riga.valoreLordo) : 0
}

export function numeroPianiAbitativi(superfici: SuperficiePiano[]): number {
  const pianiAbitativi: readonly string[] = PIANI_ABITATIVI
  return superfici.filter((s) => pianiAbitativi.includes(s.piano) && risolviValoreLordo(s.valoreLordo) > 0).length
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- geometria`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/geometria.ts src/domain/geometria.test.ts
git commit -m "feat(domain): superfici per piano, golden case 161 mq + garage 41 mq"
```

---

### Task 5: `domain/voci.ts` — catalogo, regole di inclusione, numerazione dinamica

**Files:**
- Create: `src/domain/voci.ts`
- Test: `src/domain/voci.test.ts`

**Interfaces:**
- Consuma: nessuno (definisce i propri tipi; `ConfigurazioneVoci` verrà popolata da `geometria.ts` a monte in `calcolo.ts`, Task 7).
- Produce: `Modulo`, `Gruppo`, `LivelloModulo`, `Driver`, `VoceCatalogo`, `ConfigurazioneVoci`, `CATALOGO_VOCI`, `voceInclusa()`, `vociIncluse()`, `VoceNumerata`, `numeraVoci()` — usati da Task 6 (`listino.ts`) e Task 7 (`calcolo.ts`).

- [ ] **Step 1: Scrivere i test**

```ts
// src/domain/voci.test.ts
import { describe, expect, it } from 'vitest'
import { CATALOGO_VOCI, voceInclusa, vociIncluse, numeraVoci, type ConfigurazioneVoci } from './voci'

const CONFIG_CRIVELLARO: ConfigurazioneVoci = {
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  numeroPianiAbitativi: 1,
  superficieGarage: 41,
}

describe('voceInclusa', () => {
  it('include il solaio interpiano solo se ci sono più piani', () => {
    const solaio = CATALOGO_VOCI.find((v) => v.id === 'solaio-interpiano')!
    expect(voceInclusa(solaio, CONFIG_CRIVELLARO)).toBe(false)
    expect(voceInclusa(solaio, { ...CONFIG_CRIVELLARO, numeroPianiAbitativi: 2 })).toBe(true)
  })

  it('esclude il cappotto se il modulo involucro è impoverito', () => {
    const cappotto = CATALOGO_VOCI.find((v) => v.id === 'cappotto')!
    expect(voceInclusa(cappotto, { ...CONFIG_CRIVELLARO, livelli: { ...CONFIG_CRIVELLARO.livelli, involucro: 'impoverito' } })).toBe(false)
    expect(voceInclusa(cappotto, CONFIG_CRIVELLARO)).toBe(true)
  })

  it('include il garage solo se la superficie garage è positiva', () => {
    const garage = CATALOGO_VOCI.find((v) => v.id === 'garage')!
    expect(voceInclusa(garage, CONFIG_CRIVELLARO)).toBe(true)
    expect(voceInclusa(garage, { ...CONFIG_CRIVELLARO, superficieGarage: 0 })).toBe(false)
  })

  it('include le opere chiavi in mano solo se finiture non è già completo', () => {
    const chiaviInMano = CATALOGO_VOCI.find((v) => v.id === 'opere-chiavi-in-mano')!
    expect(voceInclusa(chiaviInMano, CONFIG_CRIVELLARO)).toBe(true)
    expect(
      voceInclusa(chiaviInMano, { ...CONFIG_CRIVELLARO, livelli: { ...CONFIG_CRIVELLARO.livelli, finiture: 'completo' } }),
    ).toBe(false)
  })
})

describe('vociIncluse + numeraVoci — golden case Crivellaro', () => {
  it('riproduce esattamente la numerazione 1,1.a,1.b,1.c,2,3,4,4.a,5,5.a,6,7,8', () => {
    const incluse = vociIncluse(CATALOGO_VOCI, CONFIG_CRIVELLARO)
    const numerate = numeraVoci(incluse)
    expect(numerate.map((v) => v.numero)).toEqual([
      '1', '1.a', '1.b', '1.c', '2', '3', '4', '4.a', '5', '5.a', '6', '7', '8',
    ])
    expect(numerate.map((v) => v.voce.id)).toEqual([
      'pareti-mhm',
      'tracciamento-impianti',
      'pareti-telaio',
      'trave-larice',
      'copertura-falda',
      'cappotto',
      'cartongesso-q2',
      'assistenza-cartongessisti',
      'infissi-pvc',
      'monoblocchi',
      'progettazione-esecutiva',
      'opere-chiavi-in-mano',
      'garage',
    ])
  })

  it('esclude il solaio interpiano dalla numerazione se monopiano', () => {
    const incluse = vociIncluse(CATALOGO_VOCI, CONFIG_CRIVELLARO)
    expect(incluse.find((v) => v.id === 'solaio-interpiano')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- voci`
Expected: FAIL — `./voci` non esiste.

- [ ] **Step 3: Implementare `src/domain/voci.ts`**

```ts
// src/domain/voci.ts

export type Modulo = 'struttura' | 'involucro' | 'finiture'
export type Gruppo = 'grezzo' | 'post_sconto'
export type LivelloModulo = 'completo' | 'impoverito' | 'escluso'

export type Driver =
  | { tipo: 'mq_superficie_lorda'; eurMq: number }
  | { tipo: 'mq_garage'; eurMq: number }
  | { tipo: 'ml_perimetro'; eurMl: number }
  | { tipo: 'mq_serramenti_lordi'; eurMq: number; extraCorpo?: number }
  | { tipo: 'numero_serramenti'; eurPezzo: number }
  | { tipo: 'percentuale_voce'; percentuale: number; vocePadreId: string }
  | { tipo: 'corpo_fisso'; importo: number }

export interface ConfigurazioneVoci {
  livelli: Record<Modulo, LivelloModulo>
  numeroPianiAbitativi: number
  superficieGarage: number
}

export interface VoceCatalogo {
  id: string
  modulo?: Modulo
  gruppo: Gruppo
  livelloRichiesto?: LivelloModulo
  sottovoceDi?: string
  descrizioneTemplate: string
  driver: Driver | null
  importoTestualeDefault?: 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'
  condizione?: (config: ConfigurazioneVoci) => boolean
}

const RANK: Record<LivelloModulo, number> = { escluso: 0, impoverito: 1, completo: 2 }

export function voceInclusa(voce: VoceCatalogo, config: ConfigurazioneVoci): boolean {
  if (voce.modulo && voce.livelloRichiesto) {
    if (RANK[config.livelli[voce.modulo]] < RANK[voce.livelloRichiesto]) return false
  }
  if (voce.condizione && !voce.condizione(config)) return false
  return true
}

export function vociIncluse(catalogo: VoceCatalogo[], config: ConfigurazioneVoci): VoceCatalogo[] {
  return catalogo.filter((voce) => voceInclusa(voce, config))
}

export interface VoceNumerata {
  numero: string
  voce: VoceCatalogo
}

export function numeraVoci(voci: VoceCatalogo[]): VoceNumerata[] {
  const risultato: VoceNumerata[] = []
  let contatore = 0
  let letteraCorrente = 0
  let padreCorrenteId: string | undefined

  for (const voce of voci) {
    if (voce.sottovoceDi && voce.sottovoceDi === padreCorrenteId) {
      letteraCorrente += 1
      risultato.push({ numero: `${contatore}.${String.fromCharCode(96 + letteraCorrente)}`, voce })
    } else {
      contatore += 1
      letteraCorrente = 0
      padreCorrenteId = voce.id
      risultato.push({ numero: `${contatore}`, voce })
    }
  }
  return risultato
}

// Ordine di catalogo = ordine di numerazione (cfr. spec §5.1: i numeri si rinumerano
// scorrendo le voci incluse in quest'ordine). Sottovoci sempre immediatamente dopo il padre.
export const CATALOGO_VOCI: VoceCatalogo[] = [
  {
    id: 'pareti-mhm',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Pareti strutturali in legno "M.H.M." esterne sp. mm {{spessoreEsterno}} ed interne sp. mm {{spessoreInterno}}',
    driver: null,
  },
  {
    id: 'tracciamento-impianti',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'pareti-mhm',
    descrizioneTemplate:
      'Tracciamento impianto idrosanitario ed elettrico come da tavola di "predisposizione impianti" sottoscritta',
    driver: null,
    importoTestualeDefault: 'comprese',
  },
  {
    id: 'pareti-telaio',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'pareti-mhm',
    descrizioneTemplate:
      'Pareti non strutturali a telaio composta dalla struttura del telaio e da 2 lastre di cartongesso da un lato',
    driver: null,
    importoTestualeDefault: 'comprese',
  },
  {
    id: 'trave-larice',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'pareti-mhm',
    descrizioneTemplate: 'Trave alla base in larice',
    driver: null,
  },
  {
    id: 'solaio-interpiano',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate: 'Solaio interpiano in legno lato inferiore a vista',
    driver: null,
    condizione: (config) => config.numeroPianiAbitativi > 1,
  },
  {
    id: 'copertura-falda',
    modulo: 'involucro',
    livelloRichiesto: 'impoverito',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Copertura a falda in travi e tavolato lato inferiore a vista compreso di coibentazione in fibra di legno sp. mm {{spessoreCoibente}}, teli traspiranti e freni, manto di copertura e lattoneria varia',
    driver: null,
  },
  {
    id: 'cappotto',
    modulo: 'involucro',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Cappotto esterno in fibra di legno sp. mm {{spessoreCappotto}} finito con rasante ed intonaco',
    driver: null,
  },
  {
    id: 'cartongesso-q2',
    modulo: 'finiture',
    livelloRichiesto: 'impoverito',
    gruppo: 'grezzo',
    descrizioneTemplate:
      'Cartongesso interno a placcatura diretta su pareti "M.H.M." con finitura "Q2" e il completamento delle pareti a telaio',
    driver: null,
  },
  {
    id: 'assistenza-cartongessisti',
    modulo: 'finiture',
    livelloRichiesto: 'impoverito',
    gruppo: 'grezzo',
    sottovoceDi: 'cartongesso-q2',
    descrizioneTemplate: 'Assistenza ai cartongessisti',
    driver: null,
  },
  {
    id: 'infissi-pvc',
    modulo: 'involucro',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate: 'Infissi esterni in PVC (escluso oscuranti) con un portoncino di ingresso',
    driver: null,
  },
  {
    id: 'monoblocchi',
    modulo: 'involucro',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    sottovoceDi: 'infissi-pvc',
    descrizioneTemplate: 'Monoblocchi lisci su 4 lati ditta Hella per posa infissi',
    driver: null,
  },
  {
    id: 'progettazione-esecutiva',
    modulo: 'struttura',
    livelloRichiesto: 'completo',
    gruppo: 'grezzo',
    descrizioneTemplate: 'Consulenza progettazione esecutiva di produzione',
    driver: null,
  },
  {
    id: 'opere-chiavi-in-mano',
    modulo: 'finiture',
    gruppo: 'post_sconto',
    descrizioneTemplate: 'Stima opere chiavi in mano',
    driver: null,
    condizione: (config) => config.livelli.finiture !== 'completo',
  },
  {
    id: 'garage',
    gruppo: 'post_sconto',
    descrizioneTemplate: 'Garage realizzato con struttura a telaio portante',
    driver: null,
    condizione: (config) => config.superficieGarage > 0,
  },
]
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- voci`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/voci.ts src/domain/voci.test.ts
git commit -m "feat(domain): catalogo voci con id stabili e numerazione dinamica"
```

---

### Task 6: `domain/listino.ts` — parametri prezzo e proposta

**Files:**
- Create: `src/domain/listino.ts`
- Test: `src/domain/listino.test.ts`

**Interfaces:**
- Consuma: `Driver`, `VoceCatalogo` (da `voci.ts`, Task 5).
- Produce: `ListinoAnno`, `LISTINO_2026`, `driverPer()`, `proponiValore()` — usati da Task 7 (`calcolo.ts`).

**Nota di design importante:** i valori di questo listino sono stati ricavati a ritroso dal preventivo Crivellaro (spec §6) e sono **approssimazioni**, non garantiscono la riproduzione esatta al centesimo degli importi storici — quello è compito degli override manuali (Task 7/8). Questo modulo va testato con una tolleranza, non con uguaglianza esatta.

- [ ] **Step 1: Scrivere i test**

```ts
// src/domain/listino.test.ts
import { describe, expect, it } from 'vitest'
import { LISTINO_2026, driverPer, proponiValore } from './listino'
import { CATALOGO_VOCI } from './voci'

describe('LISTINO_2026', () => {
  it('ha un driver per ogni voce prezzabile del catalogo', () => {
    const idPrezzabili = CATALOGO_VOCI.filter((v) => !v.importoTestualeDefault).map((v) => v.id)
    for (const id of idPrezzabili) {
      expect(driverPer(LISTINO_2026, id), `manca il driver per ${id}`).toBeDefined()
    }
  })
})

describe('proponiValore — coerenza con Crivellaro (tolleranza ±5%)', () => {
  const input = {
    superficiLordeTotale: 161,
    superficieGarage: 41,
    perimetro: 60,
    serramenti: { areaLordaTotale: 30.5, numero: 11 },
  }

  it('propone un valore vicino ai 96 100 € reali per le pareti MHM', () => {
    const driver = driverPer(LISTINO_2026, 'pareti-mhm')!
    const proposto = proponiValore(driver, input, new Map())
    expect(proposto).toBeGreaterThan(96100 * 0.95)
    expect(proposto).toBeLessThan(96100 * 1.05)
  })

  it('propone un valore vicino ai 20 000 € reali per il garage (41 mq)', () => {
    const driver = driverPer(LISTINO_2026, 'garage')!
    const proposto = proponiValore(driver, input, new Map())
    expect(proposto).toBeGreaterThan(20000 * 0.95)
    expect(proposto).toBeLessThan(20000 * 1.05)
  })

  it('la consulenza progettazione esecutiva è a corpo fisso 4 000 € indipendentemente dalla geometria', () => {
    const driver = driverPer(LISTINO_2026, 'progettazione-esecutiva')!
    expect(proponiValore(driver, input, new Map())).toBe(4000)
    expect(proponiValore(driver, { ...input, superficiLordeTotale: 300 }, new Map())).toBe(4000)
  })

  it('calcola l\'assistenza cartongessisti come percentuale della voce padre già valorizzata', () => {
    const driver = driverPer(LISTINO_2026, 'assistenza-cartongessisti')!
    const vociValorizzate = new Map([['cartongesso-q2', 15500]])
    const proposto = proponiValore(driver, input, vociValorizzate)
    expect(proposto).toBeCloseTo(15500 * 0.142, 0)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- listino`
Expected: FAIL — `./listino` non esiste.

- [ ] **Step 3: Implementare `src/domain/listino.ts`**

```ts
// src/domain/listino.ts
import type { Driver } from './voci'

export interface ListinoAnno {
  anno: number
  driver: Record<string, Driver>
}

export const LISTINO_2026: ListinoAnno = {
  anno: 2026,
  driver: {
    'pareti-mhm': { tipo: 'mq_superficie_lorda', eurMq: 597 },
    'trave-larice': { tipo: 'ml_perimetro', eurMl: 97 },
    'copertura-falda': { tipo: 'mq_superficie_lorda', eurMq: 395 },
    cappotto: { tipo: 'mq_superficie_lorda', eurMq: 126 },
    'cartongesso-q2': { tipo: 'mq_superficie_lorda', eurMq: 96 },
    'assistenza-cartongessisti': { tipo: 'percentuale_voce', percentuale: 0.142, vocePadreId: 'cartongesso-q2' },
    'infissi-pvc': { tipo: 'mq_serramenti_lordi', eurMq: 502, extraCorpo: 4000 },
    monoblocchi: { tipo: 'numero_serramenti', eurPezzo: 927 },
    'progettazione-esecutiva': { tipo: 'corpo_fisso', importo: 4000 },
    'opere-chiavi-in-mano': { tipo: 'mq_superficie_lorda', eurMq: 553 },
    garage: { tipo: 'mq_garage', eurMq: 488 },
  },
}

export function driverPer(listino: ListinoAnno, voceId: string): Driver | undefined {
  return listino.driver[voceId]
}

export interface InputGeometricoListino {
  superficiLordeTotale: number
  superficieGarage: number
  perimetro: number
  serramenti: { areaLordaTotale: number; numero: number }
}

export function proponiValore(
  driver: Driver,
  input: InputGeometricoListino,
  vociGiaValorizzate: Map<string, number>,
): number {
  switch (driver.tipo) {
    case 'mq_superficie_lorda':
      return arrotonda2(driver.eurMq * input.superficiLordeTotale)
    case 'mq_garage':
      return arrotonda2(driver.eurMq * input.superficieGarage)
    case 'ml_perimetro':
      return arrotonda2(driver.eurMl * input.perimetro)
    case 'mq_serramenti_lordi':
      return arrotonda2(driver.eurMq * input.serramenti.areaLordaTotale + (driver.extraCorpo ?? 0))
    case 'numero_serramenti':
      return arrotonda2(driver.eurPezzo * input.serramenti.numero)
    case 'corpo_fisso':
      return driver.importo
    case 'percentuale_voce': {
      const valorePadre = vociGiaValorizzate.get(driver.vocePadreId) ?? 0
      return arrotonda2(valorePadre * driver.percentuale)
    }
    default:
      return 0
  }
}

function arrotonda2(valore: number): number {
  return Math.round(valore * 100) / 100
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- listino`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/listino.ts src/domain/listino.test.ts
git commit -m "feat(domain): listino parametrico 2026 con proposta di valore per driver"
```

---

### Amendment (post Task 6): tre preventivi reali aggiuntivi hanno corretto Task 4-6

Dopo il completamento e la review di Task 1-6, FBE ha fornito tre offerte reali aggiuntive
(Zapparoni, Fabrello, Lucarelli). L'analisi (spec §3.9) ha corretto due assunzioni già
implementate. Le correzioni sono state applicate con un fix-round per ciascun task
(implementer originale ripreso, poi ri-revisionato) — il dettaglio è nel ledger SDD, qui il
riassunto per chi legge questa sezione del piano da questo punto in poi:

- **`src/domain/geometria.ts` (Task 4)**: aggiunta `superficieSedime(superfici): number`,
  che restituisce il valore risolto della riga `'Piano Terra'` (proxy dell'impronta a
  terra dell'edificio). Stessa firma/stile delle funzioni già presenti in questo file.

- **`src/domain/voci.ts` (Task 5)**:
  - Il tipo `Driver` guadagna una variante: `{ tipo: 'mq_superficie_sedime'; eurMq: number }`.
  - `ConfigurazioneVoci` guadagna il campo `chiaviInManoNelTotale: boolean`.
  - La `condizione` di `opere-chiavi-in-mano` diventa
    `(config) => config.livelli.finiture !== 'completo' && config.chiaviInManoNelTotale`
    (prima era solo la prima metà — vedi spec §3.9 per il perché: non è derivabile dal
    solo livello del modulo, è una scelta commerciale esplicita).

- **`src/domain/listino.ts` (Task 6)**:
  - `InputGeometricoListino` guadagna il campo `superficieSedime: number`.
  - `proponiValore` guadagna un case `'mq_superficie_sedime'` (identico a
    `'mq_superficie_lorda'` ma legge `input.superficieSedime`).
  - **Solo** il driver di `'copertura-falda'` cambia, da
    `{ tipo: 'mq_superficie_lorda', eurMq: 395 }` a
    `{ tipo: 'mq_superficie_sedime', eurMq: 475 }`. Pareti e cappotto restano invariati:
    verificato sui dati Lucarelli che scalare quelle due voci con l'impronta a terra
    peggiora la stima invece di migliorarla (scalano col numero di piani, non con
    l'impronta), quindi la spec ha deliberatamente ristretto la correzione alla sola
    copertura.

**Ogni task successivo che referenzia `ConfigurazioneVoci`, `InputGeometricoListino` o il
golden case Crivellaro deve usare queste firme aggiornate** (il Task 8, più sotto in questo
stesso file, è già stato aggiornato di conseguenza: `configurazione.chiaviInManoNelTotale:
true` e `geometria.superficieSedime: 134` nel fixture Crivellaro).

---

### Task 7: `domain/calcolo.ts` — sconti a cascata e arrotondamento (diretto e inverso)

**Files:**
- Create: `src/domain/calcolo.ts`
- Test: `src/domain/calcolo.test.ts`

**Interfaces:**
- Consuma: nessuna dipendenza da `voci.ts`/`listino.ts` in questo task (isolato per testabilità); l'orchestratore che li collega è Task 8.
- Produce: `Sconto`, `ParametriSconto`, `applicaScontiACascata()`, `calcolaParziale()`, `risolviArrotondamento()`, `sogliaArrotondamentoSuperata()` — usati da Task 8.

- [ ] **Step 1: Scrivere i test con i numeri esatti di Crivellaro**

```ts
// src/domain/calcolo.test.ts
import { describe, expect, it } from 'vitest'
import {
  applicaScontiACascata,
  calcolaParziale,
  risolviArrotondamento,
  sogliaArrotondamentoSuperata,
  type ParametriSconto,
} from './calcolo'

const SCONTI_CRIVELLARO: ParametriSconto[] = [
  { percentuale: 0.1, causale: 'sconto cliente' },
  { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' },
]

describe('applicaScontiACascata — golden case Crivellaro', () => {
  it('applica il secondo sconto al residuo, non al totale originale', () => {
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    expect(sconti).toHaveLength(2)
    expect(sconti[0].importoCalcolato).toBe(23700)
    expect(sconti[1].importoCalcolato).toBe(21330)
  })

  it('10% + 10% fa 19%, non 20%, sul totale originale', () => {
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    const totaleSconti = sconti.reduce((somma, s) => somma + s.importoCalcolato, 0)
    expect(totaleSconti).toBe(45030)
    expect(totaleSconti / 237000).toBeCloseTo(0.19, 4)
  })
})

describe('calcolaParziale — golden case Crivellaro', () => {
  it('riproduce il PARZIALE AL GREZZO AVANZATO = 190 900,00', () => {
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    expect(calcolaParziale(237000, sconti, 1070)).toBe(190900)
  })
})

describe('risolviArrotondamento — funzione inversa', () => {
  it('dato un totale target di 300 000, risolve l\'arrotondamento a 1 070,00', () => {
    const arrotondamento = risolviArrotondamento(237000, SCONTI_CRIVELLARO, 300000, 109100)
    expect(arrotondamento).toBe(1070)
  })

  it('è coerente con calcolaParziale: applicando l\'arrotondamento risolto si ottiene il parziale corretto', () => {
    const arrotondamento = risolviArrotondamento(237000, SCONTI_CRIVELLARO, 300000, 109100)
    const sconti = applicaScontiACascata(237000, SCONTI_CRIVELLARO)
    const parziale = calcolaParziale(237000, sconti, arrotondamento)
    expect(parziale + 109100).toBe(300000)
  })
})

describe('sogliaArrotondamentoSuperata', () => {
  it('non segnala nulla per 1 070 su un listino di 237 000 (0,45%)', () => {
    expect(sogliaArrotondamentoSuperata(1070, 237000)).toBe(false)
  })

  it('segnala un arrotondamento sopra la soglia del 2%', () => {
    expect(sogliaArrotondamentoSuperata(5000, 237000)).toBe(true)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- calcolo`
Expected: FAIL — `./calcolo` non esiste.

- [ ] **Step 3: Implementare `src/domain/calcolo.ts`**

```ts
// src/domain/calcolo.ts

export interface ParametriSconto {
  percentuale: number
  causale: string
}

export interface Sconto extends ParametriSconto {
  ordine: number
  importoCalcolato: number
}

function arrotondaCentesimi(valore: number): number {
  return Math.round(valore * 100) / 100
}

export function applicaScontiACascata(base: number, sconti: ParametriSconto[]): Sconto[] {
  let residuo = base
  return sconti.map((sconto, indice) => {
    const importoCalcolato = arrotondaCentesimi(residuo * sconto.percentuale)
    residuo -= importoCalcolato
    return { ordine: indice + 1, percentuale: sconto.percentuale, causale: sconto.causale, importoCalcolato }
  })
}

export function calcolaParziale(listinoTotale: number, sconti: Sconto[], arrotondamento: number): number {
  const totaleSconti = sconti.reduce((somma, s) => somma + s.importoCalcolato, 0)
  return arrondaParziale(listinoTotale, totaleSconti, arrotondamento)
}

function arrondaParziale(listinoTotale: number, totaleSconti: number, arrotondamento: number): number {
  return arrotondaCentesimi(listinoTotale - totaleSconti - arrotondamento)
}

/**
 * Problema inverso: dato il totale che si vuole ottenere (es. una cifra tonda),
 * risolve quale Arrotondamento manuale serve nella riga del preventivo.
 */
export function risolviArrotondamento(
  listinoTotale: number,
  parametriSconti: ParametriSconto[],
  totaleTarget: number,
  sommaVociPostSconto: number,
): number {
  const sconti = applicaScontiACascata(listinoTotale, parametriSconti)
  const totaleSconti = sconti.reduce((somma, s) => somma + s.importoCalcolato, 0)
  const parzialeSenzaArrotondamento = arrotondaCentesimi(listinoTotale - totaleSconti)
  const parzialeRichiesto = arrotondaCentesimi(totaleTarget - sommaVociPostSconto)
  return arrotondaCentesimi(parzialeSenzaArrotondamento - parzialeRichiesto)
}

export function sogliaArrotondamentoSuperata(arrotondamento: number, listinoTotale: number, sogliaPercentuale = 0.02): boolean {
  return Math.abs(arrotondamento) / listinoTotale > sogliaPercentuale
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- calcolo`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/calcolo.ts src/domain/calcolo.test.ts
git commit -m "feat(domain): sconti a cascata e arrotondamento diretto/inverso, golden case Crivellaro"
```

---

### Task 8: `domain/calcolo.ts` — orchestratore `eseguiCalcolo` e golden case end-to-end

**Files:**
- Modify: `src/domain/calcolo.ts`
- Test: `src/domain/calcolo.test.ts`

**Interfaces:**
- Consuma: `VoceCatalogo`, `ConfigurazioneVoci`, `vociIncluse()`, `numeraVoci()` (da `voci.ts`, Task 5); `ListinoAnno`, `driverPer()`, `proponiValore()`, `InputGeometricoListino` (da `listino.ts`, Task 6); `applicaScontiACascata()`, `calcolaParziale()`, `risolviArrotondamento()` (da Task 7, stesso file).
- Produce: `VoceValorizzata`, `Sicurezza`, `RisultatoCalcolo`, `InputCalcolo`, `eseguiCalcolo()` — usato da Task 9 (persistenza), Task 13 (preview), Task 17 (export).

Questo è il task che chiude il cerchio: dato l'input completo di un preventivo, produce l'intera struttura di `RisultatoCalcolo`. Il test principale è il **golden case**: usa gli importi reali di Crivellaro come override manuali (§6 della spec: il listino proposto è un'approssimazione, non riproduce il centesimo esatto — la riproduzione esatta è compito di questo orchestratore quando gli import sono forniti manualmente, esattamente come farebbe l'operatore in UI).

- [ ] **Step 1: Scrivere il test end-to-end**

```ts
// aggiunta a src/domain/calcolo.test.ts
import { eseguiCalcolo, type InputCalcolo } from './calcolo'
import { CATALOGO_VOCI } from './voci'
import { LISTINO_2026 } from './listino'

describe('eseguiCalcolo — golden case Crivellaro end-to-end', () => {
  const input: InputCalcolo = {
    catalogo: CATALOGO_VOCI,
    configurazione: {
      livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
      numeroPianiAbitativi: 1,
      superficieGarage: 41,
      chiaviInManoNelTotale: true, // Crivellaro somma "opere-chiavi-in-mano" nel totale (§3.9)
    },
    listino: LISTINO_2026,
    geometria: {
      superficiLordeTotale: 161,
      superficieSedime: 134, // impronta Piano Terra, driver di copertura-falda (§3.9)
      superficieGarage: 41,
      perimetro: 60,
      serramenti: { areaLordaTotale: 30.5, numero: 11 },
    },
    overrides: {
      'pareti-mhm': 96100,
      'trave-larice': 5800,
      'copertura-falda': 63600,
      cappotto: 20300,
      'cartongesso-q2': 15500,
      'assistenza-cartongessisti': 2200,
      'infissi-pvc': 19300,
      monoblocchi: 10200,
      'progettazione-esecutiva': 4000,
      'opere-chiavi-in-mano': 89100,
      garage: 20000,
    },
    sconti: [
      { percentuale: 0.1, causale: 'sconto cliente' },
      { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' },
    ],
    sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
    arrotondamento: { risolviPerTotale: 300000 },
  }

  it('riproduce esattamente 237 000 / 190 900 / 300 000', () => {
    const risultato = eseguiCalcolo(input)
    expect(risultato.listinoTotale).toBe(237000)
    expect(risultato.sconti[0].importoCalcolato).toBe(23700)
    expect(risultato.sconti[1].importoCalcolato).toBe(21330)
    expect(risultato.arrotondamento).toBe(1070)
    expect(risultato.parziale).toBe(190900)
    expect(risultato.totaleNetto).toBe(300000)
  })

  it('numera le voci valorizzate come nel documento reale', () => {
    const risultato = eseguiCalcolo(input)
    const numeri = risultato.vociValorizzate.map((v) => v.numero)
    expect(numeri).toEqual(['1', '1.a', '1.b', '1.c', '2', '3', '4', '4.a', '5', '5.a', '6', '7', '8'])
  })

  it('marca ogni voce con override come provenienza "manuale"', () => {
    const risultato = eseguiCalcolo(input)
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    expect(pareti.importo).toBe(96100)
    expect(pareti.provenienza).toBe('manuale')
  })

  it('propone dal listino le voci senza override, con provenienza "proposto"', () => {
    const { ...senzaOverridePareti } = input
    const risultato = eseguiCalcolo({ ...senzaOverridePareti, overrides: {} })
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    expect(pareti.provenienza).toBe('proposto')
    expect(pareti.importo).toBeGreaterThan(0)
  })

  it('mantiene comprese le voci testuali senza farle entrare nella somma', () => {
    const risultato = eseguiCalcolo(input)
    const tracciamento = risultato.vociValorizzate.find((v) => v.id === 'tracciamento-impianti')!
    expect(tracciamento.importo).toBe('comprese')
  })

  it('non scala il post_sconto: sicurezza OMAGGIO non entra nel totale', () => {
    const risultato = eseguiCalcolo(input)
    expect(risultato.sicurezza.valorizzata).toBe('OMAGGIO')
    // 190 900 (parziale) + 89 100 (chiavi in mano) + 20 000 (garage) + 0 (sicurezza) = 300 000
    expect(risultato.totaleNetto).toBe(300000)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- calcolo`
Expected: FAIL — `eseguiCalcolo` non esiste.

- [ ] **Step 3: Implementare l'orchestratore in `src/domain/calcolo.ts`**

```ts
// aggiunta a src/domain/calcolo.ts
import { vociIncluse, numeraVoci, type VoceCatalogo, type ConfigurazioneVoci } from './voci'
import { driverPer, proponiValore, type ListinoAnno, type InputGeometricoListino } from './listino'

export interface VoceValorizzata {
  numero: string
  id: string
  descrizione: string
  gruppo: 'grezzo' | 'post_sconto'
  importo: number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'
  provenienza: 'proposto' | 'manuale' | 'ripartito'
}

export interface Sicurezza {
  costoDichiarato: number
  valorizzata: number | 'OMAGGIO'
}

export interface InputCalcolo {
  catalogo: VoceCatalogo[]
  configurazione: ConfigurazioneVoci
  listino: ListinoAnno
  geometria: InputGeometricoListino
  overrides: Record<string, number | string>
  sconti: ParametriSconto[]
  sicurezza: Sicurezza
  arrotondamento: number | { risolviPerTotale: number }
}

export interface RisultatoCalcolo {
  vociValorizzate: VoceValorizzata[]
  listinoTotale: number
  sconti: Sconto[]
  arrotondamento: number
  parziale: number
  sicurezza: Sicurezza
  totaleNetto: number
}

function sommaNumerica(voci: VoceValorizzata[]): number {
  return arrotondaCentesimi(voci.reduce((somma, v) => somma + (typeof v.importo === 'number' ? v.importo : 0), 0))
}

export function eseguiCalcolo(input: InputCalcolo): RisultatoCalcolo {
  const incluse = vociIncluse(input.catalogo, input.configurazione)
  const numerate = numeraVoci(incluse)

  const valoriPerId = new Map<string, number>()
  const vociValorizzate: VoceValorizzata[] = []

  for (const { numero, voce } of numerate) {
    const override = input.overrides[voce.id]

    if (override !== undefined) {
      const importo = typeof override === 'number' ? override : override
      if (typeof importo === 'number') valoriPerId.set(voce.id, importo)
      vociValorizzate.push({
        numero,
        id: voce.id,
        descrizione: voce.descrizioneTemplate,
        gruppo: voce.gruppo,
        importo,
        provenienza: 'manuale',
      })
      continue
    }

    if (voce.importoTestualeDefault) {
      vociValorizzate.push({
        numero,
        id: voce.id,
        descrizione: voce.descrizioneTemplate,
        gruppo: voce.gruppo,
        importo: voce.importoTestualeDefault,
        provenienza: 'proposto',
      })
      continue
    }

    const driver = driverPer(input.listino, voce.id)
    const importo = driver ? proponiValore(driver, input.geometria, valoriPerId) : 0
    valoriPerId.set(voce.id, importo)
    vociValorizzate.push({
      numero,
      id: voce.id,
      descrizione: voce.descrizioneTemplate,
      gruppo: voce.gruppo,
      importo,
      provenienza: 'proposto',
    })
  }

  const vociGrezzo = vociValorizzate.filter((v) => v.gruppo === 'grezzo')
  const vociPostSconto = vociValorizzate.filter((v) => v.gruppo === 'post_sconto')

  const listinoTotale = sommaNumerica(vociGrezzo)
  const sommaVociPostSconto = sommaNumerica(vociPostSconto) + (typeof input.sicurezza.valorizzata === 'number' ? input.sicurezza.valorizzata : 0)

  const arrotondamento =
    typeof input.arrotondamento === 'number'
      ? input.arrotondamento
      : risolviArrotondamento(listinoTotale, input.sconti, input.arrotondamento.risolviPerTotale, sommaVociPostSconto)

  const sconti = applicaScontiACascata(listinoTotale, input.sconti)
  const parziale = calcolaParziale(listinoTotale, sconti, arrotondamento)
  const totaleNetto = arrotondaCentesimi(parziale + sommaVociPostSconto)

  return {
    vociValorizzate,
    listinoTotale,
    sconti,
    arrotondamento,
    parziale,
    sicurezza: input.sicurezza,
    totaleNetto,
  }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- calcolo`
Expected: PASS — incluso il golden case end-to-end.

- [ ] **Step 5: Eseguire l'intera suite di dominio**

Run: `npm test -- domain`
Expected: PASS su geometria, voci, listino, calcolo.

- [ ] **Step 6: Commit**

```bash
git add src/domain/calcolo.ts src/domain/calcolo.test.ts
git commit -m "feat(domain): orchestratore eseguiCalcolo, golden case end-to-end 237k->300k"
```

---

### Task 9: Schema Prisma — persistenza con snapshot del listino

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/domain/persistenza.ts` (mapping tra `RisultatoCalcolo`/`InputCalcolo` e i campi JSON del DB)
- Test: `src/domain/persistenza.test.ts`

**Interfaces:**
- Consuma: `InputCalcolo`, `RisultatoCalcolo` (Task 8).
- Produce: `serializzaRevisione()`, `deserializzaRevisione()` — usati da Task 14 (wizard) e Task 17 (export).

- [ ] **Step 1: Estendere `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Cliente {
  id         String       @id @default(cuid())
  nome       String
  comune     String
  provincia  String
  preventivi Preventivo[]
}

model Preventivo {
  id          String      @id @default(cuid())
  protocollo  String      @unique
  clienteId   String
  cliente     Cliente     @relation(fields: [clienteId], references: [id])
  oggetto     String
  progettista String?
  revisioni   Revisione[]
  createdAt   DateTime    @default(now())
}

model Revisione {
  id           String     @id @default(cuid())
  preventivoId String
  preventivo   Preventivo @relation(fields: [preventivoId], references: [id])
  numero       Int
  data         DateTime
  luogo        String
  stato        String     @default("bozza") // bozza | inviata | firmata

  // Snapshot immutabile: input completo e risultato calcolato, come JSON.
  // Non un riferimento al listino corrente — vedi CLAUDE.md vincolo 6.
  inputCalcolo     String
  risultatoCalcolo String

  @@unique([preventivoId, numero])
}
```

- [ ] **Step 2: Scrivere i test di serializzazione**

```ts
// src/domain/persistenza.test.ts
import { describe, expect, it } from 'vitest'
import { serializzaRevisione, deserializzaRevisione } from './persistenza'
import { eseguiCalcolo, type InputCalcolo } from './calcolo'
import { CATALOGO_VOCI } from './voci'
import { LISTINO_2026 } from './listino'

const INPUT_MINIMO: InputCalcolo = {
  catalogo: CATALOGO_VOCI,
  configurazione: {
    livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
    numeroPianiAbitativi: 1,
    superficieGarage: 41,
  },
  listino: LISTINO_2026,
  geometria: { superficiLordeTotale: 161, superficieGarage: 41, perimetro: 60, serramenti: { areaLordaTotale: 30.5, numero: 11 } },
  overrides: {},
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  arrotondamento: 0,
}

describe('serializzaRevisione / deserializzaRevisione', () => {
  it('fa un round-trip senza perdere dati, incluso il risultato calcolato', () => {
    const risultato = eseguiCalcolo(INPUT_MINIMO)
    const { inputCalcolo, risultatoCalcolo } = serializzaRevisione(INPUT_MINIMO, risultato)
    const ricostruito = deserializzaRevisione(inputCalcolo, risultatoCalcolo)

    expect(ricostruito.risultato.totaleNetto).toBe(risultato.totaleNetto)
    expect(ricostruito.risultato.listinoTotale).toBe(risultato.listinoTotale)
    expect(ricostruito.input.overrides).toEqual(INPUT_MINIMO.overrides)
  })

  it('congela il listino: cambiare LISTINO_2026 dopo il salvataggio non altera la revisione deserializzata', () => {
    const risultato = eseguiCalcolo(INPUT_MINIMO)
    const { inputCalcolo, risultatoCalcolo } = serializzaRevisione(INPUT_MINIMO, risultato)
    // il listino "vivo" cambia altrove nell'app; la revisione salvata non deve saperlo
    const ricostruito = deserializzaRevisione(inputCalcolo, risultatoCalcolo)
    expect(ricostruito.risultato.totaleNetto).toBe(risultato.totaleNetto)
  })
})
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npm test -- persistenza`
Expected: FAIL — `./persistenza` non esiste.

- [ ] **Step 4: Implementare `src/domain/persistenza.ts`**

```ts
// src/domain/persistenza.ts
import type { InputCalcolo, RisultatoCalcolo } from './calcolo'

export function serializzaRevisione(
  input: InputCalcolo,
  risultato: RisultatoCalcolo,
): { inputCalcolo: string; risultatoCalcolo: string } {
  return {
    inputCalcolo: JSON.stringify(input),
    risultatoCalcolo: JSON.stringify(risultato),
  }
}

export function deserializzaRevisione(
  inputCalcolo: string,
  risultatoCalcolo: string,
): { input: InputCalcolo; risultato: RisultatoCalcolo } {
  return {
    input: JSON.parse(inputCalcolo) as InputCalcolo,
    risultato: JSON.parse(risultatoCalcolo) as RisultatoCalcolo,
  }
}
```

Nota: `input.catalogo` e `input.listino` vengono serializzati per intero dentro lo snapshot JSON — è voluto (vincolo 6: la revisione non deve dipendere dal catalogo/listino "vivo" dell'app al momento della lettura).

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test -- persistenza`
Expected: PASS

- [ ] **Step 6: Generare il client Prisma e applicare la migrazione**

Run: `npx prisma migrate dev --name init`
Expected: migrazione creata in `prisma/migrations/`, `dev.db` generato.

Nota per chi esegue questo task: se `@prisma/client` in questa versione richiede un driver adapter esplicito per SQLite (verificare l'output di `npx prisma migrate dev` e la documentazione della versione installata), seguire le istruzioni che Prisma stampa a schermo per l'istanziazione del client — l'API dei driver adapter è cambiata più volte tra le versioni 6 e 7 e va verificata contro la versione effettivamente installata da `npm install`, non assunta.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/domain/persistenza.ts src/domain/persistenza.test.ts
git commit -m "feat: schema Prisma con snapshot immutabile di listino per revisione"
```

---

### Task 10: `ai/abaco.ts` — generazione dell'abaco serramenti (deterministico)

**Files:**
- Create: `src/ai/abaco.ts`
- Test: `src/ai/abaco.test.ts`

**Interfaces:**
- Consuma: `Serramento`, `AperturaCalcolata` (da `domain/geometria.ts`, Task 3).
- Produce: `generaAbacoSerramenti()` — usato da Task 13 (preview) e Task 17 (export).

Nessun LLM: è puro raggruppamento e formattazione, verificato riga per riga contro Crivellaro in spec §3.6.

- [ ] **Step 1: Scrivere i test con il fixture Crivellaro**

```ts
// src/ai/abaco.test.ts
import { describe, expect, it } from 'vitest'
import { generaAbacoSerramenti } from './abaco'
import type { Serramento } from '@/domain/geometria'

const SERRAMENTI_CRIVELLARO: Serramento[] = [
  { n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1.0, h: 2.2 },
  { n: 2, piano: 'PT', tipologia: 'finestra', b: 2.0, h: 1.8 },
  { n: 3, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 2.2 },
  { n: 4, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 5, piano: 'PT', tipologia: 'doppia finestra', b: 0.9, h: 1.2 },
  { n: 6, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 7, piano: 'PT', tipologia: 'finestra', b: 0.9, h: 1.2 },
  { n: 8, piano: 'PT', tipologia: 'finestra', b: 2.6, h: 2.2 },
  { n: 9, piano: 'PT', tipologia: 'finestra', b: 2.8, h: 2.2 },
  { n: 10, piano: 'PT', tipologia: 'portafinestra', b: 2.2, h: 2.2 },
  { n: 11, piano: 'PT', tipologia: 'finestra', b: 0.8, h: 2.1 },
]

describe('generaAbacoSerramenti — golden case Crivellaro', () => {
  it('raggruppa le finestre 0,9x1,2 in un\'unica riga "n. 4 dim. 90x120"', () => {
    const abaco = generaAbacoSerramenti(SERRAMENTI_CRIVELLARO.filter((s) => s.tipologia !== 'porta di ingresso' && s.tipologia !== 'portafinestra'))
    expect(abaco).toContain('n. 4 dim. 90x120')
  })

  it('elenca le dimensioni non ripetute singolarmente', () => {
    const abaco = generaAbacoSerramenti(SERRAMENTI_CRIVELLARO.filter((s) => s.tipologia === 'finestra' && s.b === 2.0))
    expect(abaco).toContain('n. 1 dim. 200x180')
  })

  it('tratta separatamente il portoncino di ingresso', () => {
    const porta = SERRAMENTI_CRIVELLARO.find((s) => s.tipologia === 'porta di ingresso')!
    const abaco = generaAbacoSerramenti([porta], { prefisso: 'n. {n} portoncini di ingresso dim. standard {dim}' })
    expect(abaco).toBe('n. 1 portoncini di ingresso dim. standard 100x220')
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- abaco`
Expected: FAIL — `./abaco` non esiste.

- [ ] **Step 3: Implementare `src/ai/abaco.ts`**

```ts
// src/ai/abaco.ts
import type { Serramento } from '@/domain/geometria'

function formattaCm(metri: number): string {
  return String(Math.round(metri * 100))
}

interface OpzioniAbaco {
  prefisso?: string // usa {n} e {dim} come placeholder, es. 'n. {n} portoncini di ingresso dim. standard {dim}'
}

export function generaAbacoSerramenti(serramenti: Serramento[], opzioni: OpzioniAbaco = {}): string {
  const gruppi = new Map<string, number>()

  for (const s of serramenti) {
    const dim = `${formattaCm(s.b)}x${formattaCm(s.h)}`
    gruppi.set(dim, (gruppi.get(dim) ?? 0) + 1)
  }

  const righe = [...gruppi.entries()].map(([dim, quantita]) => {
    if (opzioni.prefisso) {
      return opzioni.prefisso.replace('{n}', String(quantita)).replace('{dim}', dim)
    }
    return `n. ${quantita} dim. ${dim}`
  })

  return righe.join('; ') + (righe.length > 0 ? ';' : '')
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- abaco`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ai/abaco.ts src/ai/abaco.test.ts
git commit -m "feat(ai): generazione deterministica abaco serramenti, verificata su Crivellaro"
```

---

### Task 11: `ai/coerenza.ts` — controlli pre-export (deterministico)

**Files:**
- Create: `src/ai/coerenza.ts`
- Test: `src/ai/coerenza.test.ts`

**Interfaces:**
- Consuma: `SuperficiePiano`, `totaleSuperficiLorde()` (da `domain/geometria.ts`, Task 4); `RisultatoCalcolo` (da `domain/calcolo.ts`, Task 8); `sogliaArrotondamentoSuperata()` (Task 7).
- Produce: `Avviso`, `verificaCoerenza()` — usato da Task 14 (wizard, prima dell'export) e Task 17 (export).

I controlli sono quelli elencati in spec §3.8, tutti osservati come errori reali nei documenti FBE esistenti.

- [ ] **Step 1: Scrivere i test**

```ts
// src/ai/coerenza.test.ts
import { describe, expect, it } from 'vitest'
import { verificaCoerenza } from './coerenza'
import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { CATALOGO_VOCI } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import type { SuperficiePiano } from '@/domain/geometria'

const INPUT_BASE: InputCalcolo = {
  catalogo: CATALOGO_VOCI,
  configurazione: { livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' }, numeroPianiAbitativi: 1, superficieGarage: 41 },
  listino: LISTINO_2026,
  geometria: { superficiLordeTotale: 161, superficieGarage: 41, perimetro: 60, serramenti: { areaLordaTotale: 30.5, numero: 11 } },
  overrides: {},
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }, { percentuale: 0.1, causale: 'conferma' }],
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  arrotondamento: { risolviPerTotale: 300000 },
}

const SUPERFICI_COERENTI: SuperficiePiano[] = [
  { piano: 'Piano Terra', valoreLordo: '134' },
  { piano: 'Portico', valoreLordo: '13+14' },
]

describe('verificaCoerenza', () => {
  it('non segnala nulla su un caso pienamente coerente', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
    })
    expect(avvisi).toHaveLength(0)
  })

  it('segnala se la somma delle superfici non coincide col totale dichiarato', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 187, // come nel bug reale del rev.00 (somma reale 193,5)
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
    })
    expect(avvisi.some((a) => a.tipo === 'superfici-incoerenti')).toBe(true)
  })

  it('segnala un placeholder di protocollo non sostituito', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: true,
      sezioniDaDefinire: [],
    })
    expect(avvisi.some((a) => a.tipo === 'placeholder-non-sostituito')).toBe(true)
  })

  it('segnala le sezioni ancora marcate "da definire"', () => {
    const risultato = eseguiCalcolo(INPUT_BASE)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: ['Scuri', 'Avvolgibili'],
    })
    expect(avvisi.filter((a) => a.tipo === 'sezione-da-definire')).toHaveLength(2)
  })

  it('segnala un arrotondamento sopra la soglia del 2%', () => {
    const inputConArrotondamentoAlto: InputCalcolo = { ...INPUT_BASE, arrotondamento: 10000 }
    const risultato = eseguiCalcolo(inputConArrotondamentoAlto)
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
    })
    expect(avvisi.some((a) => a.tipo === 'arrotondamento-eccessivo')).toBe(true)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- coerenza`
Expected: FAIL — `./coerenza` non esiste.

- [ ] **Step 3: Implementare `src/ai/coerenza.ts`**

```ts
// src/ai/coerenza.ts
import { totaleSuperficiLorde, type SuperficiePiano } from '@/domain/geometria'
import { sogliaArrotondamentoSuperata, type RisultatoCalcolo } from '@/domain/calcolo'

export interface Avviso {
  tipo:
    | 'superfici-incoerenti'
    | 'placeholder-non-sostituito'
    | 'sezione-da-definire'
    | 'arrotondamento-eccessivo'
  messaggio: string
}

export interface InputVerificaCoerenza {
  superfici: SuperficiePiano[]
  totaleLordoDichiarato: number
  risultato: RisultatoCalcolo
  protocolloPlaceholderPresente: boolean
  sezioniDaDefinire: string[]
}

export function verificaCoerenza(input: InputVerificaCoerenza): Avviso[] {
  const avvisi: Avviso[] = []

  const totaleReale = totaleSuperficiLorde(input.superfici)
  if (Math.abs(totaleReale - input.totaleLordoDichiarato) > 0.01) {
    avvisi.push({
      tipo: 'superfici-incoerenti',
      messaggio: `La somma delle superfici (${totaleReale} mq) non coincide col totale dichiarato (${input.totaleLordoDichiarato} mq)`,
    })
  }

  if (input.protocolloPlaceholderPresente) {
    avvisi.push({
      tipo: 'placeholder-non-sostituito',
      messaggio: 'È presente un placeholder di protocollo non sostituito in copertina',
    })
  }

  for (const sezione of input.sezioniDaDefinire) {
    avvisi.push({
      tipo: 'sezione-da-definire',
      messaggio: `La sezione "${sezione}" è ancora marcata "da definire"`,
    })
  }

  if (sogliaArrotondamentoSuperata(input.risultato.arrotondamento, input.risultato.listinoTotale)) {
    avvisi.push({
      tipo: 'arrotondamento-eccessivo',
      messaggio: `L'arrotondamento (${input.risultato.arrotondamento} €) supera il 2% del Listino — rivedere sconti o voci`,
    })
  }

  return avvisi
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- coerenza`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ai/coerenza.ts src/ai/coerenza.test.ts
git commit -m "feat(ai): controlli di coerenza pre-export, dai bug reali osservati in spec"
```

---

### Task 12: `ai/estrazione.ts` — estrazione campi dalla frase iniziale (LLM dietro interfaccia)

**Files:**
- Create: `src/ai/estrazione.ts`
- Test: `src/ai/estrazione.test.ts`

**Interfaces:**
- Consuma: nessuno dagli altri task (produce dati che il wizard, Task 14, riverserà nei tipi di `geometria.ts`/`voci.ts`).
- Produce: `CampiEstratti`, `ClienteEstrazione` (interfaccia), `ClienteEstrazioneAnthropic`, `estraiCampi()` — usati da Task 15 (chat di apertura).

Il punto chiave: i test **non chiamano rete**. Usano un `ClienteEstrazione` finto che implementa la stessa interfaccia del client reale, verificando solo il parsing/validazione della risposta — non il comportamento del modello linguistico.

- [ ] **Step 1: Scrivere i test con un client finto**

```ts
// src/ai/estrazione.test.ts
import { describe, expect, it } from 'vitest'
import { estraiCampi, type ClienteEstrazione } from './estrazione'

function clienteFinto(rispostaJson: string): ClienteEstrazione {
  return {
    async estrai() {
      return rispostaJson
    },
  }
}

describe('estraiCampi', () => {
  it('valida e restituisce i campi quando il client risponde con JSON corretto', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      superfici: [{ piano: 'Piano Terra', valoreLordo: '134' }],
      tipoCopertura: 'falde',
      finituraEsterna: 'intonaco',
      pacchetto: 'grezzo avanzato',
      campiMancanti: ['progettista', 'serramenti'],
    })

    const campi = await estraiCampi('casa per Crivellaro Mariano a Trissino...', clienteFinto(risposta))

    expect(campi.cliente.nome).toBe('Crivellaro Mariano')
    expect(campi.protocollo).toBe('2026059')
    expect(campi.superfici).toEqual([{ piano: 'Piano Terra', valoreLordo: '134' }])
    expect(campi.campiMancanti).toContain('progettista')
  })

  it('lancia un errore leggibile se il client risponde con JSON malformato', async () => {
    await expect(estraiCampi('testo qualsiasi', clienteFinto('non è json'))).rejects.toThrow(/estrazione/i)
  })

  it('lancia un errore se manca un campo obbligatorio nella risposta', async () => {
    const rispostaIncompleta = JSON.stringify({ cliente: { nome: 'Solo nome' } })
    await expect(estraiCampi('testo qualsiasi', clienteFinto(rispostaIncompleta))).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- estrazione`
Expected: FAIL — `./estrazione` non esiste.

- [ ] **Step 3: Implementare `src/ai/estrazione.ts`**

```ts
// src/ai/estrazione.ts
import { z } from 'zod'

const SchemaCampiEstratti = z.object({
  cliente: z.object({
    nome: z.string(),
    comune: z.string().optional(),
    provincia: z.string().optional(),
  }),
  protocollo: z.string().optional(),
  superfici: z.array(z.object({ piano: z.string(), valoreLordo: z.string() })).default([]),
  tipoCopertura: z.enum(['piano', 'falde']).optional(),
  finituraEsterna: z.enum(['intonaco', 'rivestimento']).optional(),
  pacchetto: z.enum(['grezzo', 'grezzo avanzato', 'chiavi in mano']).optional(),
  campiMancanti: z.array(z.string()).default([]),
})

export type CampiEstratti = z.infer<typeof SchemaCampiEstratti>

export interface ClienteEstrazione {
  estrai(testo: string): Promise<string>
}

export async function estraiCampi(testo: string, cliente: ClienteEstrazione): Promise<CampiEstratti> {
  const rispostaGrezza = await cliente.estrai(testo)

  let parsato: unknown
  try {
    parsato = JSON.parse(rispostaGrezza)
  } catch {
    throw new Error(`Estrazione fallita: risposta non è JSON valido: ${rispostaGrezza.slice(0, 200)}`)
  }

  const risultato = SchemaCampiEstratti.safeParse(parsato)
  if (!risultato.success) {
    throw new Error(`Estrazione fallita: campi non validi — ${risultato.error.message}`)
  }

  return risultato.data
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- estrazione`
Expected: PASS

- [ ] **Step 5: Implementare il client reale Anthropic (senza test di rete)**

```ts
// aggiunta a src/ai/estrazione.ts
import Anthropic from '@anthropic-ai/sdk'

const PROMPT_SISTEMA = `Estrai dal testo dell'utente i campi di un preventivo per case in legno FBE WoodLiving.
Rispondi SOLO con un oggetto JSON con questa forma, senza markdown:
{
  "cliente": { "nome": string, "comune"?: string, "provincia"?: string },
  "protocollo"?: string,
  "superfici": [{ "piano": string, "valoreLordo": string }],
  "tipoCopertura"?: "piano" | "falde",
  "finituraEsterna"?: "intonaco" | "rivestimento",
  "pacchetto"?: "grezzo" | "grezzo avanzato" | "chiavi in mano",
  "campiMancanti": string[]
}
Se un campo non è menzionato nel testo, ometterlo o aggiungerlo a campiMancanti. Non inventare valori.`

export class ClienteEstrazioneAnthropic implements ClienteEstrazione {
  private client: Anthropic

  constructor(apiKey: string = process.env.ANTHROPIC_API_KEY ?? '') {
    this.client = new Anthropic({ apiKey })
  }

  async estrai(testo: string): Promise<string> {
    const messaggio = await this.client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: PROMPT_SISTEMA,
      messages: [{ role: 'user', content: testo }],
    })
    const blocco = messaggio.content[0]
    return blocco.type === 'text' ? blocco.text : ''
  }
}
```

- [ ] **Step 6: Verificare che la suite completa passi ancora**

Run: `npm test`
Expected: PASS su tutti i moduli finora scritti.

- [ ] **Step 7: Commit**

```bash
git add src/ai/estrazione.ts src/ai/estrazione.test.ts
git commit -m "feat(ai): estrazione campi da testo libero, client Anthropic dietro interfaccia testabile"
```

---

### Task 13: Componenti preview — pagine 4, 5, 6, abaco serramenti

**Files:**
- Create: `src/documento/preview/PaginaCaratteristiche.tsx`
- Create: `src/documento/preview/PaginaPrezzi.tsx`
- Create: `src/documento/preview/PaginaCondizioni.tsx`
- Create: `src/documento/preview/PaginaAbacoSerramenti.tsx`
- Create: `src/documento/preview/print.css`
- Test: `src/documento/preview/formattazione.test.ts`

**Interfaces:**
- Consuma: `RisultatoCalcolo`, `VoceValorizzata` (Task 8); `SuperficiePiano` (Task 4); output di `generaAbacoSerramenti()` (Task 10).
- Produce: `formattaImportoItaliano()` (usata da tutti i componenti pagina) e i quattro componenti React, usati da Task 14 (wizard).

Il formato importi italiano (`96 100,00 €`, vincolo globale) è l'unica logica non banale qui, e va testata come funzione pura separata dai componenti — i componenti React restano dichiarativi.

- [ ] **Step 1: Scrivere il test di formattazione**

```ts
// src/documento/preview/formattazione.test.ts
import { describe, expect, it } from 'vitest'
import { formattaImportoItaliano } from './formattazione'

describe('formattaImportoItaliano', () => {
  it('formatta 96100 come "96 100,00 €"', () => {
    expect(formattaImportoItaliano(96100)).toBe('96 100,00 €')
  })

  it('formatta 300000 come "300 000,00 €"', () => {
    expect(formattaImportoItaliano(300000)).toBe('300 000,00 €')
  })

  it('lascia passare invariati i valori testuali', () => {
    expect(formattaImportoItaliano('comprese')).toBe('comprese')
    expect(formattaImportoItaliano('OMAGGIO')).toBe('OMAGGIO')
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- formattazione`
Expected: FAIL

- [ ] **Step 3: Implementare `src/documento/preview/formattazione.ts`**

```ts
// src/documento/preview/formattazione.ts
export function formattaImportoItaliano(valore: number | string): string {
  if (typeof valore === 'string') return valore
  const parti = valore.toFixed(2).split('.')
  const interi = parti[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${interi},${parti[1]} €`
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- formattazione`
Expected: PASS

- [ ] **Step 5: Creare `src/documento/preview/print.css`**

```css
/* src/documento/preview/print.css */
.pagina-a4 {
  width: 210mm;
  min-height: 297mm;
  padding: 20mm;
  background: white;
  color: black;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
  margin: 0 auto 16px auto;
  font-family: Georgia, serif;
}

.pagina-a4 table {
  width: 100%;
  border-collapse: collapse;
}

.pagina-a4 td {
  padding: 4px 8px;
  vertical-align: top;
}

.pagina-a4 .importo {
  text-align: right;
  white-space: nowrap;
}

@media print {
  .pagina-a4 {
    box-shadow: none;
    margin: 0;
  }
}
```

- [ ] **Step 6: Implementare `PaginaCaratteristiche.tsx`**

```tsx
// src/documento/preview/PaginaCaratteristiche.tsx
import type { SuperficiePiano } from '@/domain/geometria'

interface Props {
  sistemaCostruttivo: string
  tetto: string
  mantoCopertura: string
  finituraEsterna: string
  pacchetto: string
  superfici: SuperficiePiano[]
  superficieGarage: string
}

export function PaginaCaratteristiche({
  sistemaCostruttivo,
  tetto,
  mantoCopertura,
  finituraEsterna,
  pacchetto,
  superfici,
  superficieGarage,
}: Props) {
  return (
    <div className="pagina-a4">
      <h2>Preventivo</h2>
      <h3>CARATTERISTICHE STRUTTURA</h3>
      <table>
        <tbody>
          <tr><td>SISTEMA COSTRUTTIVO</td><td>{sistemaCostruttivo}</td></tr>
          <tr><td>TETTO</td><td>{tetto}</td></tr>
          <tr><td>MANTO DI COPERTURA</td><td>{mantoCopertura}</td></tr>
          <tr><td>FINITURA ESTERNA</td><td>{finituraEsterna}</td></tr>
          <tr><td>PACCHETTO DI CONSEGNA</td><td>{pacchetto}</td></tr>
        </tbody>
      </table>
      <h3>CARATTERISTICHE FABBRICATO</h3>
      <table>
        <tbody>
          {superfici.map((s) => (
            <tr key={s.piano}>
              <td>{s.piano}</td>
              <td>Sup. lorda</td>
              <td className="importo">{s.valoreLordo}</td>
              <td>Mq</td>
            </tr>
          ))}
          <tr>
            <td>Garage</td>
            <td>Sup. lorda</td>
            <td className="importo">{superficieGarage}</td>
            <td>Mq</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 7: Implementare `PaginaPrezzi.tsx`**

```tsx
// src/documento/preview/PaginaPrezzi.tsx
import type { RisultatoCalcolo } from '@/domain/calcolo'
import { formattaImportoItaliano } from './formattazione'

interface Props {
  risultato: RisultatoCalcolo
}

export function PaginaPrezzi({ risultato }: Props) {
  const vociGrezzo = risultato.vociValorizzate.filter((v) => v.gruppo === 'grezzo')
  const vociPostSconto = risultato.vociValorizzate.filter((v) => v.gruppo === 'post_sconto')

  return (
    <div className="pagina-a4">
      <table>
        <tbody>
          {vociGrezzo.map((v) => (
            <tr key={v.id} data-provenienza={v.provenienza}>
              <td>{v.numero}</td>
              <td>{v.descrizione}</td>
              <td className="importo">{formattaImportoItaliano(v.importo)}</td>
            </tr>
          ))}
          <tr><td /><td><strong>Listino {new Date().getFullYear()}</strong></td><td className="importo">{formattaImportoItaliano(risultato.listinoTotale)}</td></tr>
          {risultato.sconti.map((s) => (
            <tr key={s.ordine}>
              <td />
              <td>SCONTO RISERVATO: {(s.percentuale * 100).toFixed(0)}% {s.causale}</td>
              <td className="importo">- {formattaImportoItaliano(s.importoCalcolato)}</td>
            </tr>
          ))}
          <tr><td /><td>Arrotondamento</td><td className="importo">- {formattaImportoItaliano(risultato.arrotondamento)}</td></tr>
          <tr><td /><td><strong>PARZIALE AL GREZZO AVANZATO esclusa I.V.A.</strong></td><td className="importo">{formattaImportoItaliano(risultato.parziale)}</td></tr>
          <tr><td /><td>COSTI SICUREZZA: SICUREZZA costo {formattaImportoItaliano(risultato.sicurezza.costoDichiarato)}</td><td className="importo">{formattaImportoItaliano(risultato.sicurezza.valorizzata)}</td></tr>
          {vociPostSconto.map((v) => (
            <tr key={v.id} data-provenienza={v.provenienza}>
              <td>{v.numero}</td>
              <td>{v.descrizione}</td>
              <td className="importo">{formattaImportoItaliano(v.importo)}</td>
            </tr>
          ))}
          <tr><td /><td><strong>TOTALE AL NETTO esclusa I.V.A.</strong></td><td className="importo">{formattaImportoItaliano(risultato.totaleNetto)}</td></tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 8: Implementare `PaginaCondizioni.tsx` e `PaginaAbacoSerramenti.tsx`**

```tsx
// src/documento/preview/PaginaCondizioni.tsx
interface Sal {
  percentuale: number
  milestone: string
}

interface Props {
  caparra: string
  sal: Sal[]
  consegna: string
  validita: string
}

export function PaginaCondizioni({ caparra, sal, consegna, validita }: Props) {
  return (
    <div className="pagina-a4">
      <h3>Pagamento</h3>
      <table>
        <tbody>
          <tr><td>{caparra}</td><td>Caparra confirmatoria da restituire al SAL 7</td></tr>
          {sal.map((s, i) => (
            <tr key={i}><td>{(s.percentuale * 100).toFixed(0)}%</td><td>{s.milestone}</td></tr>
          ))}
        </tbody>
      </table>
      <p>Consegna: {consegna}</p>
      <p>Validità offerta: {validita}</p>
      <p>IVA: esclusa dai prezzi sopra indicati</p>
    </div>
  )
}
```

```tsx
// src/documento/preview/PaginaAbacoSerramenti.tsx
interface Props {
  abaco: string
}

export function PaginaAbacoSerramenti({ abaco }: Props) {
  return (
    <div className="pagina-a4">
      <h3>Serramenti e portoncino d'ingresso</h3>
      <p>{abaco}</p>
    </div>
  )
}
```

- [ ] **Step 9: Verificare che il progetto compili**

Run: `npm run typecheck`
Expected: nessun errore.

- [ ] **Step 10: Commit**

```bash
git add src/documento/preview
git commit -m "feat(documento): componenti preview A4 per pagine 4, 5, 6 e abaco serramenti"
```

---

### Task 14: Form strutturato a 5 step + pannello preview live

**Files:**
- Create: `src/app/preventivi/nuovo/page.tsx`
- Create: `src/app/preventivi/nuovo/FormStrutturato.tsx`
- Create: `src/app/preventivi/nuovo/PannelloPreview.tsx`
- Test: `src/app/preventivi/nuovo/stato-form.test.ts`

**Interfaces:**
- Consuma: `eseguiCalcolo()` (Task 8), `generaAbacoSerramenti()` (Task 10), `verificaCoerenza()` (Task 11), i componenti di Task 13.
- Produce: `StatoForm`, `inputCalcoloDaStato()` (usato da Task 15 per popolare il form dall'estrazione AI, e da Task 17 per l'export).

Per restare testabile senza Testing Library/jsdom (fuori scope in questo prototipo), la logica di trasformazione stato-form → `InputCalcolo` è isolata in una funzione pura testata direttamente; il componente React la usa ma non viene testato a sua volta in questo task.

- [ ] **Step 1: Scrivere il test della trasformazione stato → input**

```ts
// src/app/preventivi/nuovo/stato-form.test.ts
import { describe, expect, it } from 'vitest'
import { inputCalcoloDaStato, type StatoForm } from './stato-form'

const STATO_CRIVELLARO: StatoForm = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  superfici: [
    { piano: 'Piano Terra', valoreLordo: '134' },
    { piano: 'Portico', valoreLordo: '13+14' },
    { piano: 'Garage', valoreLordo: '41' },
  ],
  serramenti: [{ n: 1, piano: 'PT', tipologia: 'porta di ingresso', b: 1, h: 2.2 }],
  perimetro: 60,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  overrides: {},
  totaleTarget: 300000,
}

describe('inputCalcoloDaStato', () => {
  it('deriva superficiLordeTotale e superficieGarage dalle superfici del form', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.geometria.superficiLordeTotale).toBe(161)
    expect(input.geometria.superficieGarage).toBe(41)
  })

  it('deriva numeroPianiAbitativi per la configurazione voci', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.configurazione.numeroPianiAbitativi).toBe(1)
  })

  it('imposta arrotondamento come risoluzione sul totale target', () => {
    const input = inputCalcoloDaStato(STATO_CRIVELLARO)
    expect(input.arrotondamento).toEqual({ risolviPerTotale: 300000 })
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- stato-form`
Expected: FAIL — `./stato-form` non esiste.

- [ ] **Step 3: Implementare `src/app/preventivi/nuovo/stato-form.ts`**

```ts
// src/app/preventivi/nuovo/stato-form.ts
import { totaleSuperficiLorde, superficieGarage, numeroPianiAbitativi, totaliSerramenti, type SuperficiePiano, type Serramento } from '@/domain/geometria'
import { CATALOGO_VOCI, type LivelloModulo, type Modulo } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'
import type { InputCalcolo, ParametriSconto } from '@/domain/calcolo'

export interface StatoForm {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  superfici: SuperficiePiano[]
  serramenti: Serramento[]
  perimetro: number
  livelli: Record<Modulo, LivelloModulo>
  sconti: ParametriSconto[]
  overrides: Record<string, number | string>
  totaleTarget: number
}

export function inputCalcoloDaStato(stato: StatoForm): InputCalcolo {
  const { areaLordaTotale, numero } = totaliSerramenti(stato.serramenti)

  return {
    catalogo: CATALOGO_VOCI,
    configurazione: {
      livelli: stato.livelli,
      numeroPianiAbitativi: numeroPianiAbitativi(stato.superfici),
      superficieGarage: superficieGarage(stato.superfici),
    },
    listino: LISTINO_2026,
    geometria: {
      superficiLordeTotale: totaleSuperficiLorde(stato.superfici),
      superficieGarage: superficieGarage(stato.superfici),
      perimetro: stato.perimetro,
      serramenti: { areaLordaTotale, numero },
    },
    overrides: stato.overrides,
    sconti: stato.sconti,
    sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
    arrotondamento: { risolviPerTotale: stato.totaleTarget },
  }
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- stato-form`
Expected: PASS

- [ ] **Step 5: Implementare `PannelloPreview.tsx`**

```tsx
// src/app/preventivi/nuovo/PannelloPreview.tsx
'use client'

import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { generaAbacoSerramenti } from '@/ai/abaco'
import { PaginaCaratteristiche } from '@/documento/preview/PaginaCaratteristiche'
import { PaginaPrezzi } from '@/documento/preview/PaginaPrezzi'
import { PaginaAbacoSerramenti } from '@/documento/preview/PaginaAbacoSerramenti'
import type { StatoForm } from './stato-form'

interface Props {
  stato: StatoForm
  input: InputCalcolo
}

export function PannelloPreview({ stato, input }: Props) {
  const risultato = eseguiCalcolo(input)
  const abaco = generaAbacoSerramenti(stato.serramenti)

  return (
    <div>
      <PaginaCaratteristiche
        sistemaCostruttivo="MassivHolzMauer® (M.H.M.)"
        tetto="Tetto con travi e perline in abete"
        mantoCopertura="Tegole in cemento"
        finituraEsterna="Intonaco"
        pacchetto="Grezzo avanzato"
        superfici={stato.superfici.filter((s) => s.piano !== 'Garage')}
        superficieGarage={stato.superfici.find((s) => s.piano === 'Garage')?.valoreLordo ?? ''}
      />
      <PaginaPrezzi risultato={risultato} />
      <PaginaAbacoSerramenti abaco={abaco} />
    </div>
  )
}
```

- [ ] **Step 6: Implementare `FormStrutturato.tsx` (5 step)**

```tsx
// src/app/preventivi/nuovo/FormStrutturato.tsx
'use client'

import { useState } from 'react'
import type { StatoForm } from './stato-form'

const STATO_INIZIALE: StatoForm = {
  cliente: { nome: '', comune: '', provincia: '' },
  protocollo: '',
  superfici: [],
  serramenti: [],
  perimetro: 0,
  livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' },
  sconti: [],
  overrides: {},
  totaleTarget: 0,
}

interface Props {
  statoIniziale?: Partial<StatoForm>
  onCambiamento: (stato: StatoForm) => void
}

export function FormStrutturato({ statoIniziale, onCambiamento }: Props) {
  const [step, setStep] = useState(0)
  const [stato, setStato] = useState<StatoForm>({ ...STATO_INIZIALE, ...statoIniziale })

  function aggiorna(parziale: Partial<StatoForm>) {
    const nuovo = { ...stato, ...parziale }
    setStato(nuovo)
    onCambiamento(nuovo)
  }

  const STEP_TITOLI = ['Anagrafica', 'Configurazione', 'Geometria', 'Prezzi', 'Condizioni']

  return (
    <div>
      <nav>
        {STEP_TITOLI.map((titolo, i) => (
          <button key={titolo} onClick={() => setStep(i)} aria-current={i === step}>
            {i + 1}. {titolo}
          </button>
        ))}
      </nav>
      {step === 0 && (
        <fieldset>
          <label>
            Cliente
            <input value={stato.cliente.nome} onChange={(e) => aggiorna({ cliente: { ...stato.cliente, nome: e.target.value } })} />
          </label>
          <label>
            Protocollo
            <input value={stato.protocollo} onChange={(e) => aggiorna({ protocollo: e.target.value })} />
          </label>
        </fieldset>
      )}
      {/* step 1-4: campi analoghi per configurazione, geometria, prezzi, condizioni — stesso pattern controlled-input su `stato` */}
    </div>
  )
}
```

Nota per chi implementa: gli step 1-4 seguono lo stesso pattern del blocco `step === 0` — un `fieldset` con input controllati che chiamano `aggiorna()`. Non li scrivo tutti qui per non gonfiare il piano con codice ripetitivo; il criterio di completamento del task è che ogni campo di `StatoForm` sia editabile da almeno uno step.

- [ ] **Step 7: Implementare `page.tsx` che collega form e preview**

```tsx
// src/app/preventivi/nuovo/page.tsx
'use client'

import { useState } from 'react'
import { FormStrutturato } from './FormStrutturato'
import { PannelloPreview } from './PannelloPreview'
import { inputCalcoloDaStato, type StatoForm } from './stato-form'

export default function NuovoPreventivo() {
  const [stato, setStato] = useState<StatoForm | null>(null)

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      <div style={{ flex: 1 }}>
        <FormStrutturato onCambiamento={setStato} />
      </div>
      <div style={{ flex: 1 }}>
        {stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verificare che il progetto compili e che i test passino**

Run: `npm run typecheck && npm test`
Expected: nessun errore, tutti i test verdi.

- [ ] **Step 9: Verifica manuale nel browser**

Run: `npm run dev`, aprire `http://localhost:3000/preventivi/nuovo`, compilare lo step Anagrafica e verificare che digitando nel campo Cliente non ci siano errori console.

- [ ] **Step 10: Commit**

```bash
git add src/app/preventivi/nuovo
git commit -m "feat(wizard): form strutturato 5 step con preview live collegata al motore di calcolo"
```

---

### Task 15: Chat di apertura — estrazione campi collegata al form

**Files:**
- Create: `src/app/preventivi/nuovo/ChatApertura.tsx`
- Modify: `src/app/preventivi/nuovo/page.tsx`
- Test: `src/app/preventivi/nuovo/mappatura-estrazione.test.ts`

**Interfaces:**
- Consuma: `CampiEstratti`, `estraiCampi()`, `ClienteEstrazioneAnthropic` (Task 12); `StatoForm` (Task 14).
- Produce: `statoFormDaCampiEstratti()` — mappa `CampiEstratti` (i campi che l'LLM può individuare) in un `Partial<StatoForm>` da passare al form come stato iniziale.

- [ ] **Step 1: Scrivere il test di mappatura**

```ts
// src/app/preventivi/nuovo/mappatura-estrazione.test.ts
import { describe, expect, it } from 'vitest'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import type { CampiEstratti } from '@/ai/estrazione'

describe('statoFormDaCampiEstratti', () => {
  it('mappa i campi estratti nella forma attesa da StatoForm', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      superfici: [{ piano: 'Piano Terra', valoreLordo: '134' }],
      tipoCopertura: 'falde',
      finituraEsterna: 'intonaco',
      pacchetto: 'grezzo avanzato',
      campiMancanti: ['progettista'],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.cliente).toEqual({ nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' })
    expect(parziale.protocollo).toBe('2026059')
    expect(parziale.superfici).toEqual([{ piano: 'Piano Terra', valoreLordo: '134' }])
  })

  it('non imposta campi non presenti nell\'estrazione, lasciandoli da compilare nel form', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Solo Nome' },
      superfici: [],
      campiMancanti: ['comune', 'protocollo'],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.protocollo).toBeUndefined()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- mappatura-estrazione`
Expected: FAIL

- [ ] **Step 3: Implementare `src/app/preventivi/nuovo/mappatura-estrazione.ts`**

```ts
// src/app/preventivi/nuovo/mappatura-estrazione.ts
import type { CampiEstratti } from '@/ai/estrazione'
import type { StatoForm } from './stato-form'

export function statoFormDaCampiEstratti(campi: CampiEstratti): Partial<StatoForm> {
  const parziale: Partial<StatoForm> = {
    cliente: {
      nome: campi.cliente.nome,
      comune: campi.cliente.comune ?? '',
      provincia: campi.cliente.provincia ?? '',
    },
    superfici: campi.superfici,
  }

  if (campi.protocollo) parziale.protocollo = campi.protocollo

  return parziale
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- mappatura-estrazione`
Expected: PASS

- [ ] **Step 5: Implementare `ChatApertura.tsx`**

```tsx
// src/app/preventivi/nuovo/ChatApertura.tsx
'use client'

import { useState } from 'react'
import { estraiCampi } from '@/ai/estrazione'
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
    <div>
      <textarea
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder="Descrivi il progetto in una frase: cliente, località, superfici, pacchetto..."
      />
      <button onClick={invia} disabled={caricamento || testo.trim() === ''}>
        {caricamento ? 'Sto leggendo...' : 'Compila dal testo'}
      </button>
      {errore && <p role="alert">{errore}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Creare l'endpoint `/api/estrazione`**

```ts
// src/app/api/estrazione/route.ts
import { NextResponse } from 'next/server'
import { estraiCampi, ClienteEstrazioneAnthropic } from '@/ai/estrazione'

export async function POST(richiesta: Request) {
  const { testo } = await richiesta.json()
  try {
    const campi = await estraiCampi(testo, new ClienteEstrazioneAnthropic())
    return NextResponse.json(campi)
  } catch (errore) {
    return NextResponse.json({ errore: errore instanceof Error ? errore.message : 'Errore' }, { status: 400 })
  }
}
```

- [ ] **Step 7: Collegare `ChatApertura` in `page.tsx`, sopra il form**

```tsx
// modifica a src/app/preventivi/nuovo/page.tsx
'use client'

import { useState } from 'react'
import { ChatApertura } from './ChatApertura'
import { FormStrutturato } from './FormStrutturato'
import { PannelloPreview } from './PannelloPreview'
import { inputCalcoloDaStato, type StatoForm } from './stato-form'

export default function NuovoPreventivo() {
  const [statoIniziale, setStatoIniziale] = useState<Partial<StatoForm>>({})
  const [stato, setStato] = useState<StatoForm | null>(null)

  return (
    <div>
      <ChatApertura onEstrazioneCompletata={(parziale) => setStatoIniziale(parziale)} />
      <div style={{ display: 'flex', gap: '24px' }}>
        <div style={{ flex: 1 }}>
          <FormStrutturato statoIniziale={statoIniziale} onCambiamento={setStato} />
        </div>
        <div style={{ flex: 1 }}>
          {stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verificare tipi e test**

Run: `npm run typecheck && npm test`
Expected: nessun errore.

- [ ] **Step 9: Commit**

```bash
git add src/app/preventivi/nuovo src/app/api/estrazione
git commit -m "feat(wizard): chat di apertura con estrazione campi, precompila il form strutturato"
```

---

### Task 16: Preparazione del master `.docx` per l'export finale

Attività prevalentemente manuale su un file Word, condizionata dall'esito di Task 2. Se lo spike ha dato verdetto RIPIEGA, questo task cambia (va sostituito con la costruzione di un template HTML→PDF): fermarsi e ridiscutere con l'utente prima di procedere, come indicato a fine Task 2.

**Files:**
- Create: `template/Offerta MHM master.docx`
- Create: `template/PLACEHOLDER.md` (elenco dei placeholder e a cosa corrispondono)

**Interfaces:**
- Produce: il master con placeholder, consumato da Task 17.

- [ ] **Step 1: Copiare il master di partenza**

```bash
cp "Documentazione addestramento/Offerta MHM rev.00_.docx" "template/Offerta MHM master.docx"
```

- [ ] **Step 2: Sostituire in Word/LibreOffice tutti i campi variabili con placeholder**, seguendo l'elenco della spec §4:

Copertina: `{cliente.nome}`, `{cliente.comune}`, `{cliente.provincia}`, `{protocollo}`, `{revisione}` — **e rimuovere il residuo `PROT. 000-22 REV.00`** (bug osservato in entrambi i documenti originali, spec §3.8).

Pag. 4: `{sistemaCostruttivo}`, `{tetto}`, `{mantoCopertura}`, `{finituraEsterna}`, `{pacchettoConsegna}`, e per ogni riga di superficie un placeholder `{superficie.PianoTerra}` ecc.

Pag. 5: **ricostruire la tabella prezzi come tabella Word nativa** (non più immagine né oggetto Excel incorporato), con una riga ripetuta via blocco `{#voci}...{/voci}` di docxtemplater per il ciclo sulle voci, e placeholder singoli per `{listinoTotale}`, `{sconto1.percentuale}`, `{sconto1.importo}`, `{sconto2.percentuale}`, `{sconto2.importo}`, `{arrotondamento}`, `{parziale}`, `{sicurezza.valorizzata}`, `{totaleNetto}`.

Pag. 6: `{caparra}`, blocco `{#sal}...{/sal}` per le milestone, `{consegna}`, `{validita}`.

Pagg. 19-20: `{abacoSerramenti}`.

- [ ] **Step 3: Documentare i placeholder in `template/PLACEHOLDER.md`**

```markdown
# Placeholder del master

| Placeholder | Pagina | Sorgente in RisultatoCalcolo/StatoForm |
|---|---|---|
| `{cliente.nome}` | 1 | `stato.cliente.nome` |
| `{cliente.comune}` | 1 | `stato.cliente.comune` |
| `{protocollo}` | 1, header | `stato.protocollo` |
| `{sistemaCostruttivo}` | 4 | costante 'MassivHolzMauer® (M.H.M.)' |
| `{#voci}{numero} {descrizione} {importo}{/voci}` | 5 | `risultato.vociValorizzate` |
| `{listinoTotale}` | 5 | `risultato.listinoTotale` |
| `{arrotondamento}` | 5 | `risultato.arrotondamento` |
| `{parziale}` | 5 | `risultato.parziale` |
| `{totaleNetto}` | 5 | `risultato.totaleNetto` |
| `{abacoSerramenti}` | 19 | output di `generaAbacoSerramenti()` |

(completare la tabella durante la preparazione del master con ogni placeholder effettivamente inserito)
```

- [ ] **Step 4: Ripetere lo spike del Task 2 sul master definitivo**

Run: `npx tsx template/spike/spike.ts` (adattato a puntare a `template/Offerta MHM master.docx` e ai placeholder reali elencati in `PLACEHOLDER.md`)
Expected: nessuna eccezione, output leggibile con i valori di test al posto dei placeholder.

- [ ] **Step 5: Commit**

```bash
git add "template/Offerta MHM master.docx" template/PLACEHOLDER.md
git commit -m "feat(template): master docx con placeholder e tabella prezzi nativa"
```

---

### Task 17: `documento/export-docx.ts` — generazione del documento finale

**Files:**
- Create: `src/documento/export-docx.ts`
- Test: `src/documento/export-docx.test.ts`

**Interfaces:**
- Consuma: `RisultatoCalcolo` (Task 8), `StatoForm` (Task 14), output di `generaAbacoSerramenti()` (Task 10), il master preparato in Task 16.
- Produce: `esportaOfferta()` — punto di chiusura del progetto: dato un preventivo completo, produce il `.docx` finale.

- [ ] **Step 1: Scrivere il test end-to-end con il golden case Crivellaro**

```ts
// src/documento/export-docx.test.ts
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import PizZip from 'pizzip'
import { esportaOfferta } from './export-docx'
import { eseguiCalcolo, type InputCalcolo } from '@/domain/calcolo'
import { CATALOGO_VOCI } from '@/domain/voci'
import { LISTINO_2026 } from '@/domain/listino'

const INPUT_CRIVELLARO: InputCalcolo = {
  catalogo: CATALOGO_VOCI,
  configurazione: { livelli: { struttura: 'completo', involucro: 'completo', finiture: 'impoverito' }, numeroPianiAbitativi: 1, superficieGarage: 41 },
  listino: LISTINO_2026,
  geometria: { superficiLordeTotale: 161, superficieGarage: 41, perimetro: 60, serramenti: { areaLordaTotale: 30.5, numero: 11 } },
  overrides: {
    'pareti-mhm': 96100, 'trave-larice': 5800, 'copertura-falda': 63600, cappotto: 20300,
    'cartongesso-q2': 15500, 'assistenza-cartongessisti': 2200, 'infissi-pvc': 19300,
    monoblocchi: 10200, 'progettazione-esecutiva': 4000, 'opere-chiavi-in-mano': 89100, garage: 20000,
  },
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }, { percentuale: 0.1, causale: 'per conferme entro il 30.06.2026' }],
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' },
  arrotondamento: { risolviPerTotale: 300000 },
}

describe('esportaOfferta — golden case Crivellaro', () => {
  it('produce un .docx che contiene il totale netto formattato correttamente', () => {
    const risultato = eseguiCalcolo(INPUT_CRIVELLARO)
    const percorsoOutput = path.resolve(import.meta.dirname, '__output_test__.docx')

    esportaOfferta({
      cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
      protocollo: '2026059',
      risultato,
      abacoSerramenti: 'n. 1 portoncini di ingresso dim. standard 100x220;',
      percorsoMaster: path.resolve(import.meta.dirname, '../../template/Offerta MHM master.docx'),
      percorsoOutput,
    })

    const buffer = fs.readFileSync(percorsoOutput)
    const zip = new PizZip(buffer)
    const documentoXml = zip.file('word/document.xml')!.asText()

    expect(documentoXml).toContain('Crivellaro Mariano')
    expect(documentoXml).toContain('300 000,00')
    expect(documentoXml).not.toContain('{cliente.nome}')
    expect(documentoXml).not.toContain('PROT. 000-22 REV.00')

    fs.unlinkSync(percorsoOutput)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npm test -- export-docx`
Expected: FAIL — `./export-docx` non esiste (o il file master non esiste ancora se Task 16 non è completo: in tal caso questo task è bloccato su Task 16, non procedere).

- [ ] **Step 3: Implementare `src/documento/export-docx.ts`**

```ts
// src/documento/export-docx.ts
import fs from 'node:fs'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import type { RisultatoCalcolo } from '@/domain/calcolo'
import { formattaImportoItaliano } from './preview/formattazione'

interface InputEsportazione {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  risultato: RisultatoCalcolo
  abacoSerramenti: string
  percorsoMaster: string
  percorsoOutput: string
}

export function esportaOfferta(input: InputEsportazione): void {
  const contenuto = fs.readFileSync(input.percorsoMaster, 'binary')
  const zip = new PizZip(contenuto)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

  doc.render({
    cliente: input.cliente,
    protocollo: input.protocollo,
    voci: input.risultato.vociValorizzate.map((v) => ({
      numero: v.numero,
      descrizione: v.descrizione,
      importo: formattaImportoItaliano(v.importo),
    })),
    listinoTotale: formattaImportoItaliano(input.risultato.listinoTotale),
    sconti: input.risultato.sconti.map((s) => ({
      percentuale: `${(s.percentuale * 100).toFixed(0)}%`,
      causale: s.causale,
      importo: formattaImportoItaliano(s.importoCalcolato),
    })),
    arrotondamento: formattaImportoItaliano(input.risultato.arrotondamento),
    parziale: formattaImportoItaliano(input.risultato.parziale),
    sicurezzaCosto: formattaImportoItaliano(input.risultato.sicurezza.costoDichiarato),
    sicurezzaValorizzata: formattaImportoItaliano(input.risultato.sicurezza.valorizzata),
    totaleNetto: formattaImportoItaliano(input.risultato.totaleNetto),
    abacoSerramenti: input.abacoSerramenti,
  })

  const buffer = doc.getZip().generate({ type: 'nodebuffer' })
  fs.writeFileSync(input.percorsoOutput, buffer)
}
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npm test -- export-docx`
Expected: PASS. Se fallisce per placeholder non trovati nel master, tornare a Task 16 e verificare che i nomi dei placeholder in `PLACEHOLDER.md` corrispondano esattamente alle chiavi passate a `doc.render()` qui sopra (`voci`, `sconti`, `totaleNetto`, ecc. — sono nomi di variabile, non testo libero, e devono coincidere carattere per carattere con quanto scritto nel `.docx`).

- [ ] **Step 5: Eseguire l'intera suite del progetto**

Run: `npm test`
Expected: PASS su tutti i moduli — domain, ai, documento.

- [ ] **Step 6: Verifica manuale finale**

Aprire il `.docx` prodotto da un export reale (non il file temporaneo di test) e confrontarlo pagina per pagina con `Offerta MHM rev.04_crivellaro.pdf`: stessa impaginazione sulle pagine boilerplate, stessi importi sulle pagine 4/5/6/19.

- [ ] **Step 7: Commit**

```bash
git add src/documento/export-docx.ts src/documento/export-docx.test.ts
git commit -m "feat(documento): export docx finale, golden case Crivellaro verificato end-to-end"
```

---

## Self-Review

**Copertura della spec:** ogni sezione della spec (§3 vincoli, §4 struttura documento, §5 moduli, §6 listino, §7 architettura, §8 modello dati, §9 wizard, §10 preview/export, §11 verifica) ha un task corrispondente: vincoli → Task 7-8; struttura documento → Task 13/16; moduli → Task 5; listino → Task 6; architettura → Task 1; modello dati → Task 9; wizard → Task 12/14/15; preview/export → Task 13/16/17; verifica → golden case ripetuto nei Task 3/4/5/7/8/17.

**Scan placeholder:** nessun "TBD"/"da implementare" nei blocchi di codice. Le uniche omissioni dichiarate sono intenzionali e motivate: gli step 1-4 di `FormStrutturato` (Task 14, ripetitivi per costruzione — criterio di completamento esplicito) e l'API esatta del driver adapter Prisma per SQLite (Task 9, dipende dalla versione installata al momento dell'esecuzione, non verificabile ora).

**Coerenza dei tipi:** `VoceValorizzata`, `RisultatoCalcolo`, `InputCalcolo`, `StatoForm`, `CampiEstratti` sono definiti una sola volta (rispettivamente Task 8, 8, 14, 12) e riusati per nome identico in tutti i task successivi che li consumano — verificato incrociando ogni `import` con la sua definizione.

**Fuori scope, confermato coerente con la spec §12:** parsing del computo Primus, lettura DWG, calcolo IVA, conversione automatica docx→PDF (Task 17 produce solo il `.docx`; la spec stessa la mostra come passo manuale a valle).
