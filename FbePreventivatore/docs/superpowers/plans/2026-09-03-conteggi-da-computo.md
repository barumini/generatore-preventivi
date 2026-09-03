# Conteggi da computo metrico — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una pagina autonoma che, caricato il PDF di un computo metrico Primus, mostra in chiaro i passaggi con cui si ricavano gli importi delle voci di `Conteggi Master.xlsx` e li riconcilia col totale del computo.

**Architecture:** Tre strati. Il dominio (`src/domain/computo/`) è TypeScript puro e riceve frammenti di testo posizionati, non PDF: estrae le voci, applica dieci regole, riconcilia. Un adattatore sottile fuori dal dominio (`leggi-pdf.ts`) usa `pdfjs-dist` nel browser per produrre quei frammenti. La pagina (`src/app/preventivi/conteggi/`) è client-side: il PDF non viene caricato su nessun server.

**Tech Stack:** TypeScript, Next.js 16 (App Router), React 19, vitest (environment `node`), `pdfjs-dist` 5.6.205, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-01-conteggi-da-computo-design.md`

## Global Constraints

- `src/domain/` è TypeScript puro: nessun import di React, Prisma, `next/*` o rete (CLAUDE.md).
- Ogni importo si arrotonda al centesimo **prima** di entrare in una somma, con `arrotondaCentesimi` di `src/domain/calcolo.ts` (`Math.round(v * 100) / 100`, half-up sui positivi).
- `COSTI_SICUREZZA_FORFETTARI = 23_300`, costante nominata in un solo punto.
- Un importo non è sempre un numero: `'compresa'` non entra nelle somme (CLAUDE.md #5).
- Nessun id di voce è un numero di posizione: si usano id stabili (`pareti-mhm`, `trave-base`, …) — CLAUDE.md #4.
- Le voci del computo si indirizzano per **codice tariffa**, mai per numero d'ordine.
- Formato importi italiano: `96 100,00 €` (spazio migliaia, virgola decimale).
- Test: `vitest`, file `*.test.ts` accanto al modulo, `import { describe, expect, it } from 'vitest'`.
- Commit in italiano, imperativo, con `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Nessun numero compare senza il suo perché.** Ogni importo mostrato deve essere
  ricostruibile leggendo la sua scheda, senza aprire il computo e senza conoscere il
  codice: la `formula` porta i valori già sostituiti in formato italiano (non i codici
  categoria), i prodotti intermedi compaiono fra i `passaggi`, e nessuna quantità entra in
  un risultato senza essere prima elencata. Un numero che appare dal nulla è un difetto,
  anche quando è aritmeticamente giusto.

## Trasparenza dei conteggi

Requisito esplicito del committente, e ragione d'essere della pagina: l'utente deve poter
verificare ogni cifra senza fidarsi. Tre conseguenze che attraversano i task:

1. **Formule sostituite, non simboliche.** `(184,18 × 220 + 68.428,78) / 2`, non
   `(184.18 × 220 + M:001.003) / 2`. Il codice categoria resta nei `passaggi`, dove
   accanto c'è il suo valore; nella formula ci vanno i numeri. Serve un formattatore
   condiviso fra dominio e interfaccia — `src/domain/computo/formatta-numero.ts`, creato
   nel Task 4 e riusato dal Task 8 — perché il dominio non può importare dalla cartella
   dell'app e duplicare la formattazione porterebbe a due convenzioni divergenti.
2. **Prodotti intermedi fra i passaggi.** Dove una regola moltiplica prima di combinare,
   il prodotto è un passaggio a sé: la copertura mostra `184,18 mq × 220 = 40.519,60`, non
   solo i mq. È già così nel cartongesso; va reso uniforme in copertura e cappotto.
3. **Il delta di pareggio è un passaggio delle pareti.** È il numero più grande che la
   pagina produce e l'unico che non viene dal computo: senza un passaggio che lo dichiari,
   la scheda delle pareti mostrerebbe `M:001.001 = 105.987,63` e poi un totale di
   `127.543,28` senza spiegare i 21.555,65 di differenza. Lo aggiunge `eseguiConteggio`
   nel Task 7, che è l'unico punto che conosce il delta.

## Dati di riferimento (verificati)

I due computi reali, estratti e parsati durante la validazione della spec:

| | Dacroce rev.03 | Crivellaro rev.04 |
|---|---:|---:|
| frammenti di testo | 2625 | 2659 |
| voci | 166 | 166 |
| categorie riepilogo | 8 | 8 |
| TOTALE computo | 323.643,58 | 260.260,99 |

Riepilogo strutturale:

| Codice | Dacroce | Crivellaro |
|---|---:|---:|
| `M:001.001` PARETI IN LEGNO | 105.987,63 | 79.500,82 |
| `M:001.002` SOLAIO | 15.240,96 | 0,00 |
| `M:001.003` COPERTURA | 68.428,78 | 76.701,12 |
| `M:001.004` CAPPOTTO | 25.684,61 | 25.264,43 |
| `M:001.005` CARTONGESSO | 23.612,10 | 19.337,12 |
| `M:001.007` INFISSI | 57.337,00 | 32.105,00 |
| `M:001.020` COSTI SICUREZZA | 23.352,50 | 23.352,50 |
| `M:001.021` TRASPORTI | 4.000,00 | 4.000,00 |

Quantità intermedie:

| Quantità | Dacroce | Crivellaro |
|---|---:|---:|
| mq copertura a falda (`104.02.000`, riga `/FALDA/`) | 184,18 | 186,35 |
| mq copertura piana (`104.02.011`) | 0,00 | 0,00 |
| mq cappotto (`204.03.08`) | 195,16 | 191,58 |
| mq cartongesso (`107.04.01`) | 531,10 | 432,46 |
| mq infissi gruppo 1 | 43,66 | 28,30 |
| pezzi infissi gruppo 2 | 14 | 11 |
| pezzi portoncini (`109.04.07`) | 2 | 1 |

Importi attesi per voce, e riconciliazione:

| Voce | Dacroce | Crivellaro |
|---|---:|---:|
| `trave-base` | 10.104,24 | 5.843,70 |
| `solaio-interpiano` | 15.240,96 | `'compresa'` |
| `copertura-falda` | 54.474,19 | 58.849,06 |
| `cappotto` | 21.624,51 | 21.253,32 |
| `cartongesso` | 18.975,90 | 15.506,77 |
| `assistenza-cartongessisti` | 2.655,50 | 2.162,30 |
| `infissi` | 31.230,00 | 19.250,00 |
| `monoblocchi` | 14.495,00 | 9.450,00 |
| `consulenza-esecutiva` | 4.000,00 | 4.000,00 |
| **somma voci** (pareti a `M:001.001`) | **278.787,93** | **215.815,97** |
| target (TOTALE − 23.300) | 300.343,58 | 236.960,99 |
| delta di pareggio | 21.555,65 | 21.145,02 |
| `pareti-mhm` a pareggio | 127.543,28 | 100.645,84 |

Le sette tariffe che compaiono due volte in **entrambi** i computi: `103.02.09`,
`104.01.015`, `104.01.016`, `104.02.000`, `104.02.006`, `104.02.018`, `104.02.021`.
Delle tariffe usate dalle regole, solo `104.02.000` è fra queste.

## File Structure

**Dominio** — `src/domain/computo/`

| File | Responsabilità |
|---|---|
| `frammenti.ts` | il tipo `FrammentoTesto`. Nessuna logica: è il contratto fra adattatore e dominio |
| `estrai-voci.ts` | da `FrammentoTesto[]` a `Computo` (voci + riepilogo + totale) e verifica d'integrità |
| `accesso.ts` | lettura del `Computo` per tariffa: liste, somme, `voceUnica` |
| `regole-conteggio.ts` | le dieci regole, ciascuna restituisce una `VoceConteggiata` con i suoi passaggi |
| `conteggio.ts` | orchestrazione: applica le regole in ordine master, riconcilia, raccoglie gli avvisi |
| `fixtures/dacroce.json`, `fixtures/crivellaro.json` | i frammenti dei due computi reali (~138 KB l'uno) |

**Adattatore e script** — fuori dal dominio

| File | Responsabilità |
|---|---|
| `src/app/preventivi/conteggi/leggi-pdf.ts` | `pdfjs-dist` nel browser: da `File` a `FrammentoTesto[]` |
| `scripts/genera-fixture-computo.ts` | rigenera le fixture dai PDF in `Documentazione addestramento/` |

**Interfaccia** — `src/app/preventivi/conteggi/`

| File | Responsabilità |
|---|---|
| `page.tsx` | guscio della pagina, stato del computo caricato |
| `CaricamentoComputo.tsx` | area di drop, esito dell'estrazione, tabella del riepilogo |
| `SchedaVoce.tsx` | una voce: sorgenti lette, formula, importo, correzione manuale |
| `Riconciliazione.tsx` | somma, target, delta, tabella master finale |
| `formatta.ts` | formato importi e quantità italiano |

**Modifiche a file esistenti**

| File | Modifica |
|---|---|
| `src/domain/calcolo.ts:11` | esporta `arrotondaCentesimi` (oggi privata) |
| `package.json` | dipendenza `pdfjs-dist`, script `predev`/`prebuild` che copia il worker |
| `.gitignore` | `public/pdf.worker.min.mjs` (rigenerabile, 1,2 MB) |

---

### Task 1: Adattatore PDF e fixture dei due computi

Tutto il resto del piano testa il dominio contro queste fixture, quindi vengono per prime.
`pdfjs-dist` è già installata (`package.json` e `package-lock.json` risultano modificati):
questo task ne consolida la configurazione e committa il risultato.

**Files:**
- Create: `src/domain/computo/frammenti.ts`
- Create: `src/app/preventivi/conteggi/leggi-pdf.ts`
- Create: `scripts/genera-fixture-computo.ts`
- Create: `src/domain/computo/fixtures/dacroce.json`, `src/domain/computo/fixtures/crivellaro.json`
- Modify: `package.json`, `.gitignore`
- Test: `src/domain/computo/fixtures.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `FrammentoTesto { pagina: number; x: number; y: number; testo: string }`;
  `frammentiDaPdf(sorgente: ArrayBuffer): Promise<FrammentoTesto[]>`.

- [ ] **Step 1: Il contratto fra adattatore e dominio**

`src/domain/computo/frammenti.ts`:

```ts
/**
 * Un frammento di testo posizionato in un PDF: quanto basta al dominio per
 * ricostruire la griglia di un computo Primus senza sapere nulla dei PDF.
 *
 * `x` e `y` sono in punti tipografici, origine in basso a sinistra della pagina
 * (convenzione PDF, non CSS): y cresce verso l'alto. Sono arrotondati
 * all'intero — le soglie di colonna distano decine di punti, i decimali non
 * servono e raddoppierebbero il peso delle fixture.
 */
export interface FrammentoTesto {
  pagina: number
  x: number
  y: number
  testo: string
}
```

- [ ] **Step 2: L'adattatore pdfjs**

`src/app/preventivi/conteggi/leggi-pdf.ts`. Il worker si serve da `public/`: è
l'unico modo che non dipende da come il bundler risolve gli URL dei worker.

```ts
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/build/pdf.mjs'
import type { FrammentoTesto } from '@/domain/computo/frammenti'

// Copiato in public/ da `npm run copia-worker-pdf` (predev/prebuild).
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export async function frammentiDaPdf(sorgente: ArrayBuffer): Promise<FrammentoTesto[]> {
  const documento = await getDocument({ data: new Uint8Array(sorgente) }).promise
  const frammenti: FrammentoTesto[] = []
  for (let pagina = 1; pagina <= documento.numPages; pagina++) {
    const contenuto = await (await documento.getPage(pagina)).getTextContent()
    for (const elemento of contenuto.items) {
      const testo = 'str' in elemento ? elemento.str.trim() : ''
      if (!testo) continue
      const trasformazione = (elemento as { transform: number[] }).transform
      frammenti.push({
        pagina,
        x: Math.round(trasformazione[4]),
        y: Math.round(trasformazione[5]),
        testo,
      })
    }
  }
  return frammenti
}
```

- [ ] **Step 3: Script di rigenerazione delle fixture**

`scripts/genera-fixture-computo.ts`. Gira in Node, quindi usa la build `legacy`
e non ha bisogno del worker.

```ts
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { FrammentoTesto } from '../src/domain/computo/frammenti'

const RADICE = resolve(import.meta.dirname, '..')
const COMPUTI = [
  ['dacroce', 'Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF'],
  ['crivellaro', 'Documentazione addestramento/Computo Crivellaro rev04.PDF.pdf'],
] as const

for (const [nome, percorso] of COMPUTI) {
  const dati = new Uint8Array(readFileSync(resolve(RADICE, percorso)))
  const documento = await getDocument({ data: dati }).promise
  const frammenti: FrammentoTesto[] = []
  for (let pagina = 1; pagina <= documento.numPages; pagina++) {
    const contenuto = await (await documento.getPage(pagina)).getTextContent()
    for (const elemento of contenuto.items) {
      const testo = 'str' in elemento ? elemento.str.trim() : ''
      if (!testo) continue
      const t = (elemento as { transform: number[] }).transform
      frammenti.push({ pagina, x: Math.round(t[4]), y: Math.round(t[5]), testo })
    }
  }
  const uscita = resolve(RADICE, `src/domain/computo/fixtures/${nome}.json`)
  mkdirSync(dirname(uscita), { recursive: true })
  writeFileSync(uscita, JSON.stringify(frammenti))
  console.log(`${nome}: ${frammenti.length} frammenti -> ${uscita}`)
}
```

- [ ] **Step 4: Script npm e gitignore**

In `package.json`, dentro `"scripts"`:

```json
"copia-worker-pdf": "cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs",
"predev": "npm run copia-worker-pdf",
"prebuild": "npm run copia-worker-pdf",
"genera-fixture-computo": "tsx scripts/genera-fixture-computo.ts"
```

In coda a `.gitignore`:

```
# worker di pdf.js copiato in public/ da `npm run copia-worker-pdf`
# (1,2 MB, rigenerabile da node_modules)
public/pdf.worker.min.mjs
```

- [ ] **Step 5: Genera le fixture**

```bash
npm run copia-worker-pdf && npm run genera-fixture-computo
```

Atteso: `dacroce: 2625 frammenti`, `crivellaro: 2659 frammenti`.

- [ ] **Step 6: Scrivi il test delle fixture**

`src/domain/computo/fixtures.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import dacroce from './fixtures/dacroce.json'
import crivellaro from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const CASI: Array<[string, FrammentoTesto[], number]> = [
  ['dacroce', dacroce as FrammentoTesto[], 2625],
  ['crivellaro', crivellaro as FrammentoTesto[], 2659],
]

describe('fixture dei computi reali', () => {
  it.each(CASI)('%s ha il numero di frammenti attesi', (_nome, frammenti, attesi) => {
    expect(frammenti).toHaveLength(attesi)
  })

  it.each(CASI)('%s copre 25 pagine e non ha frammenti vuoti', (_nome, frammenti) => {
    expect(Math.max(...frammenti.map((f) => f.pagina))).toBe(25)
    expect(frammenti.every((f) => f.testo.trim().length > 0)).toBe(true)
  })

  it('conserva la griglia di Primus: la riga SOMMANO porta i numeri in colonne distinte', () => {
    const frammenti = dacroce as FrammentoTesto[]
    const sommano = frammenti.find((f) => f.pagina === 2 && f.testo.startsWith('SOMMANO'))
    expect(sommano).toBeDefined()
    const stessaRiga = frammenti
      .filter((f) => f.pagina === 2 && Math.abs(f.y - sommano!.y) <= 2)
      .sort((a, b) => a.x - b.x)
    // quantità ~x460, prezzo unitario ~x504, totale ~x562
    expect(stessaRiga.map((f) => f.testo)).toEqual(['SOMMANO m', '0,00', '4,29', '0,00'])
  })
})
```

- [ ] **Step 7: Esegui i test**

Run: `npx vitest run src/domain/computo/fixtures.test.ts`
Expected: PASS, 5 test.

- [ ] **Step 8: Verifica che il dominio resti puro**

Run: `npx tsc --noEmit`
Expected: nessun errore. `frammenti.ts` non importa nulla.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore \
  src/domain/computo/frammenti.ts src/domain/computo/fixtures.test.ts \
  src/domain/computo/fixtures/dacroce.json src/domain/computo/fixtures/crivellaro.json \
  src/app/preventivi/conteggi/leggi-pdf.ts scripts/genera-fixture-computo.ts
git commit -m "feat: adattatore pdfjs e fixture dei due computi reali

Il dominio riceve frammenti di testo posizionati, non PDF: cosi' i test
restano puri e non dipendono dai PDF in Documentazione addestramento,
che non sono versionati.

Il worker di pdf.js si serve da public/ perche' e' l'unico modo che non
dipende da come il bundler risolve gli URL dei worker; lo copia uno
script npm su predev e prebuild, ed e' escluso da git come i binari
rigenerabili dello spike template.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Estrazione delle voci e del riepilogo

**Files:**
- Create: `src/domain/computo/estrai-voci.ts`
- Test: `src/domain/computo/estrai-voci.test.ts`

**Interfaces:**
- Consumes: `FrammentoTesto` da `./frammenti`.
- Produces:
  ```ts
  interface VoceComputo {
    numero: number; tariffa: string | null; categoria: string | null
    descrizione: string; unita: string | null
    quantita: number | null; prezzoUnitario: number | null; totale: number | null
  }
  interface CategoriaRiepilogo { nome: string; importo: number }
  interface Computo {
    voci: VoceComputo[]
    riepilogo: Record<string, CategoriaRiepilogo>
    totale: number
  }
  interface EsitoIntegrita { coerente: boolean; totaleRiepilogo: number; totaleVoci: number }
  estraiComputo(frammenti: FrammentoTesto[]): Computo
  verificaIntegrita(computo: Computo): EsitoIntegrita
  numeroItaliano(testo: string): number | null
  ```

- [ ] **Step 1: Scrivi i test che falliscono**

`src/domain/computo/estrai-voci.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { estraiComputo, verificaIntegrita, numeroItaliano, type Computo } from './estrai-voci'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])
const CASI: Array<[string, Computo, number]> = [
  ['dacroce', dacroce, 323_643.58],
  ['crivellaro', crivellaro, 260_260.99],
]

describe('numeroItaliano', () => {
  it('legge la virgola decimale e il punto delle migliaia', () => {
    expect(numeroItaliano('4,29')).toBe(4.29)
    expect(numeroItaliano('1.373,56')).toBe(1373.56)
  })

  it("legge l'apostrofo tipografico che Primus usa per le migliaia", () => {
    expect(numeroItaliano('4´832,54')).toBe(4832.54)
    expect(numeroItaliano('260´260,99')).toBe(260260.99)
  })

  it('rifiuta ciò che non è un numero', () => {
    expect(numeroItaliano('SOMMANO')).toBeNull()
    expect(numeroItaliano('')).toBeNull()
  })
})

describe('estraiComputo', () => {
  it.each(CASI)('%s ha 166 voci, tutte con tariffa', (_nome, computo) => {
    expect(computo.voci).toHaveLength(166)
    expect(computo.voci.filter((v) => v.tariffa === null)).toEqual([])
  })

  it.each(CASI)('%s numera le voci consecutivamente da 1', (_nome, computo) => {
    expect(computo.voci.map((v) => v.numero)).toEqual(
      Array.from({ length: 166 }, (_, i) => i + 1),
    )
  })

  it.each(CASI)('%s ricompone il totale dal riepilogo', (_nome, computo, totale) => {
    expect(computo.totale).toBe(totale)
  })

  it.each(CASI)('%s pareggia le voci col riepilogo', (_nome, computo) => {
    const esito = verificaIntegrita(computo)
    expect(esito.coerente).toBe(true)
    expect(esito.totaleVoci).toBe(esito.totaleRiepilogo)
  })

  it('legge le otto categorie del riepilogo strutturale', () => {
    expect(dacroce.riepilogo['M:001.001']).toEqual({
      nome: 'PARETI IN LEGNO',
      importo: 105_987.63,
    })
    expect(dacroce.riepilogo['M:001.002'].importo).toBe(15_240.96)
    expect(crivellaro.riepilogo['M:001.002'].importo).toBe(0)
    expect(Object.keys(dacroce.riepilogo)).toHaveLength(8)
  })

  it('assegna a ogni voce la categoria in cui cade', () => {
    const voce = dacroce.voci.find((v) => v.numero === 59)!
    expect(voce.categoria).toBe('COPERTURA')
    expect(dacroce.voci.find((v) => v.numero === 2)!.categoria).toBe('PARETI IN LEGNO')
  })

  it('legge unità, quantità, prezzo unitario e totale dalla riga SOMMANO', () => {
    const voce = dacroce.voci.find((v) => v.numero === 6)!
    expect(voce.tariffa).toBe('104.01.018')
    expect(voce.unita).toBe('m')
    expect(voce.quantita).toBe(82.2)
    expect(voce.prezzoUnitario).toBe(58.79)
    expect(voce.totale).toBe(4832.54)
  })

  it('tiene distinte le voci che condividono la tariffa', () => {
    const occorrenze = crivellaro.voci.filter((v) => v.tariffa === '104.02.000')
    expect(occorrenze.map((v) => [v.numero, v.quantita])).toEqual([
      [58, 42.84],
      [59, 186.35],
    ])
    expect(occorrenze[0].descrizione).toContain('SPORTO')
    expect(occorrenze[1].descrizione).toContain('FALDA')
  })

  it('conserva la descrizione anche quando occupa più righe', () => {
    const voce = dacroce.voci.find((v) => v.numero === 20)!
    expect(voce.descrizione).toContain('PARETE ESTERNA')
    expect(voce.descrizione).toContain('11 strati')
  })
})
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run src/domain/computo/estrai-voci.test.ts`
Expected: FAIL — `Failed to resolve import "./estrai-voci"`.

- [ ] **Step 3: Implementa l'estrazione**

`src/domain/computo/estrai-voci.ts`:

```ts
import type { FrammentoTesto } from './frammenti'

export interface VoceComputo {
  numero: number
  tariffa: string | null
  categoria: string | null
  descrizione: string
  unita: string | null
  quantita: number | null
  prezzoUnitario: number | null
  totale: number | null
}

export interface CategoriaRiepilogo {
  nome: string
  importo: number
}

export interface Computo {
  voci: VoceComputo[]
  riepilogo: Record<string, CategoriaRiepilogo>
  totale: number
}

export interface EsitoIntegrita {
  coerente: boolean
  totaleRiepilogo: number
  totaleVoci: number
}

/**
 * Colonne della griglia Primus, in punti. Verificate su entrambi i computi:
 * la riga SOMMANO porta quantità, prezzo unitario e totale in tre fasce di
 * ascissa che non si sovrappongono. Sono l'unico modo di distinguerli, perché
 * come testo sono tre numeri indistinguibili.
 */
const COLONNA_QUANTITA = { da: 430, a: 485 }
const COLONNA_UNITARIO = { da: 486, a: 520 }
const COLONNA_TOTALE = { da: 535, a: Infinity }

const MARGINE_SINISTRO = 25
const COLONNA_DESCRIZIONE = { da: 55, a: 130 }
const FASCIA_CATEGORIA = { da: 100, a: 220 }

const SOLO_NUMERO = /^-?[\d´.]*\d(?:,\d+)?$/
const APERTURA_VOCE = /^(\d+)\s*\/\s*(\d+)\b/
const TARIFFA = /^(\d{3}\.\d{2}\.\d{2,3})\b\s*(.*)$/
const CATEGORIA = /^(.+?)\s+\(Cat \d+\)$/
const RIGA_RIEPILOGO = /^(M:\d{3}\.\d{3})\s+(.*?)\s+euro\s+([\d´.,]+)$/
const RIGA_SOMMANO = /^SOMMANO\s+(.+)$/

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100
}

/**
 * I numeri di Primus usano la virgola decimale e, per le migliaia, l'apostrofo
 * tipografico `´` (U+00B4) — non l'apice ASCII. Cfr. CLAUDE.md.
 */
export function numeroItaliano(testo: string): number | null {
  if (!SOLO_NUMERO.test(testo)) return null
  const valore = Number.parseFloat(
    testo.replace(/´/g, '').replace(/\./g, '').replace(',', '.'),
  )
  return Number.isFinite(valore) ? valore : null
}

interface Riga {
  pagina: number
  y: number
  frammenti: FrammentoTesto[]
}

/**
 * Raggruppa i frammenti in righe visive. Due frammenti stanno sulla stessa riga
 * se distano meno di 2 punti in ordinata: dentro una riga di Primus le celle
 * hanno la stessa y a meno del rumore di rendering, e fra righe adiacenti la
 * distanza è di circa 6 punti.
 */
function raggruppaInRighe(frammenti: FrammentoTesto[]): Riga[] {
  const gruppi = new Map<string, FrammentoTesto[]>()
  for (const frammento of frammenti) {
    const chiave = `${frammento.pagina}|${Math.round(frammento.y / 2)}`
    const gruppo = gruppi.get(chiave)
    if (gruppo) gruppo.push(frammento)
    else gruppi.set(chiave, [frammento])
  }
  return [...gruppi.values()]
    .map((gruppo) => ({
      pagina: gruppo[0].pagina,
      y: gruppo[0].y,
      frammenti: [...gruppo].sort((a, b) => a.x - b.x),
    }))
    // y decrescente: nei PDF l'origine è in basso, la prima riga ha la y più alta
    .sort((a, b) => a.pagina - b.pagina || b.y - a.y)
}

export function estraiComputo(frammenti: FrammentoTesto[]): Computo {
  const voci: VoceComputo[] = []
  const riepilogo: Record<string, CategoriaRiepilogo> = {}
  let corrente: (VoceComputo & { righeDescrizione: string[] }) | null = null
  let categoria: string | null = null

  for (const riga of raggruppaInRighe(frammenti)) {
    const testo = riga.frammenti.map((f) => f.testo).join(' ')
    const primaX = riga.frammenti[0].x

    const inRiepilogo = testo.match(RIGA_RIEPILOGO)
    if (inRiepilogo) {
      const importo = numeroItaliano(inRiepilogo[3])
      if (importo !== null) {
        riepilogo[inRiepilogo[1]] = { nome: inRiepilogo[2], importo }
      }
      continue
    }

    const intestazione = testo.match(CATEGORIA)
    if (intestazione && primaX > FASCIA_CATEGORIA.da && primaX < FASCIA_CATEGORIA.a) {
      categoria = intestazione[1]
      continue
    }

    const apertura = testo.match(APERTURA_VOCE)
    if (apertura && primaX < MARGINE_SINISTRO) {
      const resto = testo.slice(apertura[0].length).trim()
      corrente = {
        numero: Number.parseInt(apertura[1], 10),
        tariffa: null,
        categoria,
        descrizione: '',
        righeDescrizione: resto ? [resto] : [],
        unita: null,
        quantita: null,
        prezzoUnitario: null,
        totale: null,
      }
      voci.push(corrente)
      continue
    }

    if (!corrente) continue

    const conTariffa = testo.match(TARIFFA)
    if (conTariffa && primaX < MARGINE_SINISTRO) {
      corrente.tariffa = conTariffa[1]
      if (conTariffa[2].trim()) corrente.righeDescrizione.push(conTariffa[2].trim())
      continue
    }

    const sommano = riga.frammenti.find((f) => RIGA_SOMMANO.test(f.testo))
    if (sommano) {
      corrente.unita = sommano.testo.match(RIGA_SOMMANO)![1]
      for (const frammento of riga.frammenti) {
        const valore = numeroItaliano(frammento.testo)
        if (valore === null) continue
        const { x } = frammento
        if (x >= COLONNA_QUANTITA.da && x <= COLONNA_QUANTITA.a) corrente.quantita = valore
        else if (x >= COLONNA_UNITARIO.da && x <= COLONNA_UNITARIO.a) corrente.prezzoUnitario = valore
        else if (x >= COLONNA_TOTALE.da) corrente.totale = valore
      }
      continue
    }

    // Righe di descrizione che proseguono, e righe "Vedi voce n° N" che Primus
    // usa per riportare quantità da altre voci: entrambe stanno nella colonna
    // della descrizione e valgono solo finché la voce non è chiusa da SOMMANO.
    if (
      corrente.unita === null &&
      primaX >= COLONNA_DESCRIZIONE.da &&
      primaX <= COLONNA_DESCRIZIONE.a
    ) {
      corrente.righeDescrizione.push(testo)
    }
  }

  for (const voce of voci) {
    const conRighe = voce as VoceComputo & { righeDescrizione: string[] }
    voce.descrizione = conRighe.righeDescrizione.join(' ').replace(/\s+/g, ' ').trim()
    delete (conRighe as { righeDescrizione?: string[] }).righeDescrizione
  }

  const totale = arrotonda(
    Object.values(riepilogo).reduce((somma, categoria) => somma + categoria.importo, 0),
  )
  return { voci, riepilogo, totale }
}

/**
 * La somma dei totali di voce deve pareggiare il totale del riepilogo. Se non
 * pareggia l'estrazione ha perso o duplicato qualcosa, e va detto: un conteggio
 * su un computo letto male produrrebbe numeri plausibili e sbagliati.
 */
export function verificaIntegrita(computo: Computo): EsitoIntegrita {
  const totaleVoci = arrotonda(
    computo.voci.reduce((somma, voce) => somma + (voce.totale ?? 0), 0),
  )
  return { coerente: totaleVoci === computo.totale, totaleRiepilogo: computo.totale, totaleVoci }
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/domain/computo/estrai-voci.test.ts`
Expected: PASS, 13 test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/computo/estrai-voci.ts src/domain/computo/estrai-voci.test.ts
git commit -m "feat: estrae voci e riepilogo da un computo Primus

Riconosce la griglia per ascissa: quantita', prezzo unitario e totale
stanno in tre fasce di colonna che non si sovrappongono, ed e' l'unico
modo di distinguerli perche' come testo sono tre numeri identici.

I test verificano su entrambi i computi che le 166 voci pareggino al
centesimo il totale del riepilogo: un'estrazione che perde una voce
produrrebbe altrimenti numeri plausibili e sbagliati.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Accesso al computo per tariffa

**Files:**
- Create: `src/domain/computo/accesso.ts`
- Test: `src/domain/computo/accesso.test.ts`

**Interfaces:**
- Consumes: `Computo`, `VoceComputo` da `./estrai-voci`.
- Produces:
  ```ts
  vociPerTariffa(computo: Computo, tariffa: string): VoceComputo[]
  sommaTotali(computo: Computo, ...tariffe: string[]): number
  sommaQuantita(computo: Computo, ...tariffe: string[]): number
  voceUnica(computo: Computo, tariffa: string, filtroDescrizione?: RegExp): VoceComputo
  class VoceNonUnivocaError extends Error
  ```

- [ ] **Step 1: Scrivi i test che falliscono**

`src/domain/computo/accesso.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { estraiComputo } from './estrai-voci'
import {
  vociPerTariffa,
  sommaTotali,
  sommaQuantita,
  voceUnica,
  VoceNonUnivocaError,
} from './accesso'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])

/** Le sette tariffe che compaiono due volte in entrambi i computi. */
const RIPETUTE = [
  '103.02.09', '104.01.015', '104.01.016', '104.02.000',
  '104.02.006', '104.02.018', '104.02.021',
]

describe('vociPerTariffa', () => {
  it('restituisce tutte le occorrenze, non la prima', () => {
    expect(vociPerTariffa(crivellaro, '104.02.000').map((v) => v.numero)).toEqual([58, 59])
  })

  it('restituisce una lista vuota per una tariffa assente', () => {
    expect(vociPerTariffa(dacroce, '999.99.99')).toEqual([])
  })

  it.each([
    ['dacroce', dacroce],
    ['crivellaro', crivellaro],
  ])('in %s le sette tariffe ripetute hanno due occorrenze ciascuna', (_nome, computo) => {
    for (const tariffa of RIPETUTE) {
      expect(vociPerTariffa(computo, tariffa)).toHaveLength(2)
    }
  })

  it('non disambigua per categoria: 104.02.021 sta in due categorie diverse', () => {
    const occorrenze = vociPerTariffa(dacroce, '104.02.021')
    expect(occorrenze.map((v) => v.categoria)).toEqual(['PARETI IN LEGNO', 'COPERTURA'])
    expect(occorrenze.every((v) => (v.quantita ?? 0) > 0)).toBe(true)
  })
})

describe('sommaTotali', () => {
  it('somma su più tariffe e su più occorrenze', () => {
    expect(sommaTotali(dacroce, '109.04.12', '109.04.13', '109.04.14')).toBe(14_495)
    expect(sommaTotali(crivellaro, '109.04.12', '109.04.13', '109.04.14')).toBe(9_450)
  })

  it('vale zero se nessuna tariffa è presente', () => {
    expect(sommaTotali(dacroce, '999.99.99')).toBe(0)
  })
})

describe('sommaQuantita', () => {
  it('somma le quantità di tutte le occorrenze', () => {
    // falda 186,35 + sporto 42,84: non è la quantità che serve alla regola
    // copertura, ed è esattamente per questo che la regola usa voceUnica
    expect(sommaQuantita(crivellaro, '104.02.000')).toBe(229.19)
  })

  it('legge la superficie del cappotto e del cartongesso', () => {
    expect(sommaQuantita(dacroce, '204.03.08')).toBe(195.16)
    expect(sommaQuantita(dacroce, '107.04.01')).toBe(531.1)
    expect(sommaQuantita(crivellaro, '204.03.08')).toBe(191.58)
    expect(sommaQuantita(crivellaro, '107.04.01')).toBe(432.46)
  })
})

describe('voceUnica', () => {
  it('sceglie la riga a falda fra due che condividono la tariffa', () => {
    expect(voceUnica(crivellaro, '104.02.000', /FALDA/).quantita).toBe(186.35)
    expect(voceUnica(dacroce, '104.02.000', /FALDA/).quantita).toBe(184.18)
  })

  it('funziona senza filtro quando la tariffa compare una volta sola', () => {
    expect(voceUnica(dacroce, '107.04.01').quantita).toBe(531.1)
  })

  it('solleva se le corrispondenze sono più di una', () => {
    expect(() => voceUnica(crivellaro, '104.02.000')).toThrow(VoceNonUnivocaError)
    expect(() => voceUnica(crivellaro, '104.02.000')).toThrow(/2 voci/)
  })

  it('solleva se non ci sono corrispondenze', () => {
    expect(() => voceUnica(dacroce, '999.99.99')).toThrow(VoceNonUnivocaError)
    expect(() => voceUnica(dacroce, '104.02.000', /PIANA/)).toThrow(VoceNonUnivocaError)
  })
})
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run src/domain/computo/accesso.test.ts`
Expected: FAIL — `Failed to resolve import "./accesso"`.

- [ ] **Step 3: Implementa l'accesso**

`src/domain/computo/accesso.ts`:

```ts
import type { Computo, VoceComputo } from './estrai-voci'

/**
 * Una tariffa non identifica una voce sola. In entrambi i computi analizzati
 * sette tariffe compaiono due volte, perché il computista apre più righe di
 * misurazione sullo stesso articolo di prezzario quando vuole tenere separate
 * quantità con destinazioni diverse — la falda dallo sporto, le pareti dalle
 * velette. Nemmeno la categoria disambigua: `104.02.021` ha una riga in
 * PARETI IN LEGNO e una in COPERTURA, entrambe con quantità.
 *
 * Perciò l'accesso restituisce sempre una lista, e ogni regola dichiara se
 * somma le occorrenze o ne vuole una precisa.
 */
export function vociPerTariffa(computo: Computo, tariffa: string): VoceComputo[] {
  return computo.voci.filter((voce) => voce.tariffa === tariffa)
}

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100
}

export function sommaTotali(computo: Computo, ...tariffe: string[]): number {
  const cercate = new Set(tariffe)
  return arrotonda(
    computo.voci
      .filter((voce) => voce.tariffa !== null && cercate.has(voce.tariffa))
      .reduce((somma, voce) => somma + (voce.totale ?? 0), 0),
  )
}

export function sommaQuantita(computo: Computo, ...tariffe: string[]): number {
  const cercate = new Set(tariffe)
  return arrotonda(
    computo.voci
      .filter((voce) => voce.tariffa !== null && cercate.has(voce.tariffa))
      .reduce((somma, voce) => somma + (voce.quantita ?? 0), 0),
  )
}

export class VoceNonUnivocaError extends Error {
  constructor(tariffa: string, filtro: RegExp | undefined, trovate: number) {
    const conFiltro = filtro ? ` con descrizione ${filtro}` : ''
    super(
      `Attesa una sola voce per la tariffa ${tariffa}${conFiltro}, trovate ${trovate} voci. ` +
        'Il computo non segue il template FBE atteso: verificarlo prima di fidarsi del conteggio.',
    )
    this.name = 'VoceNonUnivocaError'
  }
}

/**
 * Per le regole che puntano a una lavorazione precisa e non all'aggregato.
 * Solleva invece di scegliere: su un computo fuori standard è meglio fermarsi
 * che produrre in silenzio un importo sbagliato.
 */
export function voceUnica(
  computo: Computo,
  tariffa: string,
  filtroDescrizione?: RegExp,
): VoceComputo {
  const candidate = vociPerTariffa(computo, tariffa).filter(
    (voce) => !filtroDescrizione || filtroDescrizione.test(voce.descrizione),
  )
  if (candidate.length !== 1) {
    throw new VoceNonUnivocaError(tariffa, filtroDescrizione, candidate.length)
  }
  return candidate[0]
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/domain/computo/accesso.test.ts`
Expected: PASS, 13 test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/computo/accesso.ts src/domain/computo/accesso.test.ts
git commit -m "feat: accesso al computo per tariffa, con voceUnica che solleva

Una tariffa non identifica una voce sola: in entrambi i computi sette
tariffe compaiono due volte, e la 104.02.021 le ripete in due categorie
diverse, quindi nemmeno la categoria disambigua.

L'accesso restituisce sempre una lista e ogni regola dichiara se somma
le occorrenze o ne vuole una precisa. voceUnica solleva quando le
corrispondenze non sono esattamente una: su un computo fuori standard e'
meglio fermarsi che produrre in silenzio un importo sbagliato.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Tipi delle voci conteggiate e regole dirette

Le quattro regole che leggono un valore senza combinarlo: pareti, solaio, trave, consulenza.

**Emendamento — trasparenza.** Rispetto al codice mostrato negli step, aggiungi anche
`src/domain/computo/formatta-numero.ts`, e usalo nelle `formula` di questo e dei task
successivi. È nel dominio, non nella cartella dell'app, perché sia le regole sia
l'interfaccia (Task 8) devono formattare i numeri allo stesso modo:

```ts
/**
 * Formato numerico italiano: spazio per le migliaia, virgola decimale.
 * `toLocaleString('it-IT')` userebbe il punto per le migliaia, quindi si sostituisce.
 * Vive nel dominio perché le formule delle regole e l'interfaccia devono concordare:
 * due formattatori separati divergerebbero alla prima modifica.
 */
export function numeroIt(valore: number, decimali = 2): string {
  return valore
    .toLocaleString('it-IT', {
      minimumFractionDigits: decimali,
      maximumFractionDigits: decimali,
      // Senza `useGrouping: 'always'` l'ICU di it-IT omette il separatore quando la
      // parte intera ha 4 cifre: 1070 uscirebbe "1070,00" invece di "1 070,00", e il
      // golden case di CLAUDE.md ha un arrotondamento di esattamente -1.070,00.
      useGrouping: 'always',
    })
    .replace(/\./g, ' ')
}

/** Come `numeroIt`, ma senza decimali quando il valore è intero (per quantità e pezzi). */
export function quantitaIt(valore: number): string {
  return numeroIt(valore, Number.isInteger(valore) ? 0 : 2)
}
```

Con un test `src/domain/computo/formatta-numero.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { numeroIt, quantitaIt } from './formatta-numero'

describe('numeroIt', () => {
  it('usa lo spazio per le migliaia e la virgola decimale', () => {
    expect(numeroIt(68_428.78)).toBe('68 428,78')
    expect(numeroIt(105_987.63)).toBe('105 987,63')
    expect(numeroIt(220, 0)).toBe('220')
  })

  it('separa le migliaia anche quando la parte intera ha 4 cifre', () => {
    // È il caso che `useGrouping: 'always'` risolve: l'ICU di it-IT altrimenti
    // omette il separatore proprio qui, e sono valori reali — la trave alla base
    // di Crivellaro vale 5.843,70 e l'arrotondamento del golden case −1.070,00.
    expect(numeroIt(1_070)).toBe('1 070,00')
    expect(numeroIt(5_843.7)).toBe('5 843,70')
    expect(numeroIt(9_999.99)).toBe('9 999,99')
  })

  it('non separa sotto il migliaio', () => {
    expect(numeroIt(543.2)).toBe('543,20')
  })

  it('tratta i decimali come limite, non solo come minimo', () => {
    expect(numeroIt(1_234.5, 0)).toBe('1 235')
  })
})

describe('quantitaIt', () => {
  it('omette i decimali sugli interi', () => {
    expect(quantitaIt(14)).toBe('14')
    expect(quantitaIt(184.18)).toBe('184,18')
  })
})
```

In `regolaParetiBase`, passa l'importo per `arrotondaCentesimi` come già fa `regolaSolaio`:
il vincolo globale sull'arrotondamento è incondizionato, e quell'importo finisce in una
somma a valle. Sui due computi è innocuo — le categorie del riepilogo sono già pulite al
centesimo — ma l'asimmetria fra le due regole non ha ragione di esistere.

E nelle tre regole che hanno una `formula` simbolica, sostituisci i codici con i valori:

- `regolaParetiBase`: `formula: \`categoria PARETI IN LEGNO: ${numeroIt(importo)} €\``
- `regolaSolaio`: `formula: \`categoria SOLAIO: ${numeroIt(importo)} €\``
- `regolaTraveBase`: `formula: \`somma di 11 tariffe: ${numeroIt(totale)} €\`` (dove `totale`
  è il valore che assegni a `importo`)
- `regolaConsulenza`: resta `'importo fisso'`, che è già esplicito.

Aggiungi un test che le formule non contengano codici categoria grezzi:

```ts
it('le formule portano i valori, non i codici categoria', () => {
  for (const voce of [regolaParetiBase(dacroce), regolaSolaio(dacroce), regolaTraveBase(dacroce)]) {
    expect(voce.formula).not.toMatch(/M:001\.\d{3}/)
  }
  expect(regolaParetiBase(dacroce).formula).toContain('105 987,63')
})
```

**Files:**
- Modify: `src/domain/calcolo.ts:11` (esporta `arrotondaCentesimi`)
- Create: `src/domain/computo/regole-conteggio.ts`
- Test: `src/domain/computo/regole-conteggio.test.ts`

**Interfaces:**
- Consumes: `Computo` da `./estrai-voci`; `sommaTotali` da `./accesso`; `arrotondaCentesimi` da `../calcolo`.
- Produces:
  ```ts
  interface Passaggio {
    etichetta: string
    origine: { tariffa?: string; numeroVoce?: number; categoria?: string }
    valore: number
    unita: 'mq' | 'nr' | 'eur'
  }
  type ImportoConteggiato = number | 'compresa'
  interface VoceConteggiata {
    idMaster: string
    descrizione: string
    passaggi: Passaggio[]
    formula: string
    importo: ImportoConteggiato
    provenienza: 'calcolato' | 'manuale' | 'fisso'
  }
  const TARIFFE_TRAVE_BASE: readonly string[]
  regolaParetiBase(computo: Computo): VoceConteggiata
  regolaTraveBase(computo: Computo): VoceConteggiata
  regolaSolaio(computo: Computo): VoceConteggiata
  regolaConsulenza(): VoceConteggiata
  ```

- [ ] **Step 1: Scrivi i test che falliscono**

`src/domain/computo/regole-conteggio.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { estraiComputo } from './estrai-voci'
import {
  regolaParetiBase,
  regolaTraveBase,
  regolaSolaio,
  regolaConsulenza,
  TARIFFE_TRAVE_BASE,
} from './regole-conteggio'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])

describe('regolaParetiBase', () => {
  it('legge la categoria PARETI IN LEGNO', () => {
    expect(regolaParetiBase(dacroce).importo).toBe(105_987.63)
    expect(regolaParetiBase(crivellaro).importo).toBe(79_500.82)
  })

  it('dichiara la provenienza e la sorgente', () => {
    const voce = regolaParetiBase(dacroce)
    expect(voce.idMaster).toBe('pareti-mhm')
    expect(voce.provenienza).toBe('calcolato')
    expect(voce.passaggi[0].origine.categoria).toBe('M:001.001')
  })
})

describe('regolaTraveBase', () => {
  it('somma le undici tariffe dell’assieme di base', () => {
    expect(regolaTraveBase(dacroce).importo).toBe(10_104.24)
    expect(regolaTraveBase(crivellaro).importo).toBe(5_843.70)
  })

  it('esclude la posa cordolo 104.01.024', () => {
    expect(TARIFFE_TRAVE_BASE).not.toContain('104.01.024')
    expect(TARIFFE_TRAVE_BASE).toHaveLength(11)
  })

  it('mostra un passaggio per ogni tariffa che contribuisce', () => {
    const voce = regolaTraveBase(dacroce)
    expect(voce.passaggi).toHaveLength(11)
    expect(voce.passaggi.map((p) => p.origine.tariffa)).toEqual([...TARIFFE_TRAVE_BASE])
  })
})

describe('regolaSolaio', () => {
  it('legge la categoria SOLAIO', () => {
    expect(regolaSolaio(dacroce).importo).toBe(15_240.96)
  })

  it("diventa 'compresa' quando la categoria vale zero", () => {
    expect(regolaSolaio(crivellaro).importo).toBe('compresa')
  })
})

describe('regolaConsulenza', () => {
  it('vale sempre 4.000 e non dipende dal computo', () => {
    const voce = regolaConsulenza()
    expect(voce.importo).toBe(4_000)
    expect(voce.provenienza).toBe('fisso')
    expect(voce.passaggi).toEqual([])
  })
})
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run src/domain/computo/regole-conteggio.test.ts`
Expected: FAIL — `Failed to resolve import "./regole-conteggio"`.

- [ ] **Step 3: Esporta arrotondaCentesimi**

In `src/domain/calcolo.ts`, riga 11, aggiungi `export`:

```ts
export function arrotondaCentesimi(valore: number): number {
  return Math.round(valore * 100) / 100
}
```

- [ ] **Step 4: Implementa i tipi e le quattro regole dirette**

`src/domain/computo/regole-conteggio.ts`:

```ts
import { arrotondaCentesimi } from '../calcolo'
import type { Computo } from './estrai-voci'
import { sommaTotali } from './accesso'

export interface Passaggio {
  etichetta: string
  origine: { tariffa?: string; numeroVoce?: number; categoria?: string }
  valore: number
  unita: 'mq' | 'nr' | 'eur'
}

/** Vincolo CLAUDE.md #5: solo i numeri entrano nelle somme. */
export type ImportoConteggiato = number | 'compresa'

export interface VoceConteggiata {
  /** Id stabile, mai un numero di posizione — vincolo CLAUDE.md #4. */
  idMaster: string
  descrizione: string
  passaggi: Passaggio[]
  formula: string
  importo: ImportoConteggiato
  /** Vincolo CLAUDE.md #7: ogni importo dichiara da dove viene. */
  provenienza: 'calcolato' | 'manuale' | 'fisso'
}

function importoCategoria(computo: Computo, codice: string): number {
  return computo.riepilogo[codice]?.importo ?? 0
}

/**
 * Una voce che risulta zero non mostra `0,00` ma `compresa`: la riga resta nel
 * preventivo e dice al cliente che la lavorazione è contemplata.
 */
function zeroDiventaCompresa(valore: number): ImportoConteggiato {
  return valore === 0 ? 'compresa' : valore
}

export function regolaParetiBase(computo: Computo): VoceConteggiata {
  const importo = importoCategoria(computo, 'M:001.001')
  return {
    idMaster: 'pareti-mhm',
    descrizione: 'Pareti strutturali in legno "M.H.M."',
    passaggi: [
      {
        etichetta: 'categoria PARETI IN LEGNO',
        origine: { categoria: 'M:001.001' },
        valore: importo,
        unita: 'eur',
      },
    ],
    formula: 'M:001.001',
    importo,
    provenienza: 'calcolato',
  }
}

/**
 * L'assieme della trave di base. L'istruzione originale diceva «il totale a
 * pagina 2 più 104.01.022 e 104.01.023», ma dove cade il salto di pagina lo
 * decide Primus: in Crivellaro quel subtotale è 4.697,52, in Dacroce 8.208,13,
 * e in entrambi la pagina si chiude sulla voce 9 solo per coincidenza. Le
 * undici tariffe sono lo stesso insieme, indipendente dall'impaginazione.
 *
 * Esclude `104.01.024`, la posa cordolo, che in entrambi i computi cade oltre.
 */
export const TARIFFE_TRAVE_BASE = [
  '106.01.01', '106.01.02', '106.01.03', '106.01.04',
  '104.01.017', '104.01.018', '104.01.019', '104.01.020',
  '104.01.021', '104.01.022', '104.01.023',
] as const

export function regolaTraveBase(computo: Computo): VoceConteggiata {
  const passaggi: Passaggio[] = TARIFFE_TRAVE_BASE.map((tariffa) => ({
    etichetta: computo.voci.find((v) => v.tariffa === tariffa)?.descrizione.slice(0, 60) ?? tariffa,
    origine: { tariffa },
    valore: sommaTotali(computo, tariffa),
    unita: 'eur' as const,
  }))
  return {
    idMaster: 'trave-larice',
    descrizione: 'Trave alla base in larice',
    passaggi,
    formula: 'Σ totali 106.01.01–04 + 104.01.017–023',
    importo: sommaTotali(computo, ...TARIFFE_TRAVE_BASE),
    provenienza: 'calcolato',
  }
}

export function regolaSolaio(computo: Computo): VoceConteggiata {
  const importo = importoCategoria(computo, 'M:001.002')
  return {
    idMaster: 'solaio-interpiano',
    descrizione: 'Solaio interpiano in legno lato inferiore a vista (escluso scala)',
    passaggi: [
      {
        etichetta: 'categoria SOLAIO',
        origine: { categoria: 'M:001.002' },
        valore: importo,
        unita: 'eur',
      },
    ],
    formula: 'M:001.002',
    importo: zeroDiventaCompresa(arrotondaCentesimi(importo)),
    provenienza: 'calcolato',
  }
}

export const CONSULENZA_ESECUTIVA = 4_000

export function regolaConsulenza(): VoceConteggiata {
  return {
    idMaster: 'progettazione-esecutiva',
    descrizione: 'Consulenza progettazione esecutiva di produzione',
    passaggi: [],
    formula: 'importo fisso',
    importo: CONSULENZA_ESECUTIVA,
    provenienza: 'fisso',
  }
}
```

- [ ] **Step 5: Esegui i test**

Run: `npx vitest run src/domain/computo/regole-conteggio.test.ts`
Expected: PASS, 8 test.

- [ ] **Step 6: Verifica che i test esistenti non si rompano**

Run: `npm test`
Expected: PASS su tutta la suite. `arrotondaCentesimi` cambia solo visibilità.

- [ ] **Step 7: Commit**

```bash
git add src/domain/calcolo.ts src/domain/computo/regole-conteggio.ts src/domain/computo/regole-conteggio.test.ts
git commit -m "feat: tipi delle voci conteggiate e le quattro regole dirette

La trave alla base e' ancorata alle undici tariffe dell'assieme, non al
subtotale di pagina 2: dove cada il salto di pagina lo decide Primus, e
in entrambi i computi quella pagina si chiude sulla voce 9 solo per
coincidenza.

Una voce che risulta zero diventa 'compresa' invece di 0,00, cosi' la
riga resta nel preventivo e dice al cliente che la lavorazione e'
contemplata: e' il caso del solaio in Crivellaro.

Esporta arrotondaCentesimi da calcolo.ts, finora privata.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Regole con media sul riepilogo

Copertura e cappotto: una quantità dal computo, moltiplicata per un prezzo, mediata con
l'importo della categoria corrispondente.

**Emendamento — trasparenza.** Sono le due regole dove il buco era più visibile: mostravano
i mq e la categoria, ma non il prodotto intermedio, e la formula portava il codice
categoria invece del suo valore. Rispetto al codice mostrato negli step:

1. Importa `numeroIt` e `quantitaIt` da `./formatta-numero` (creato nel Task 4).
2. In `regolaCoperturaFalda`, aggiungi un passaggio per il prodotto, **fra** i mq e la
   categoria, e sostituisci la formula:

   ```ts
   const prodotto = arrotondaCentesimi(mq * EUR_MQ_COPERTURA)
   // …fra il passaggio 'mq copertura piana' e quello della categoria:
   {
     etichetta: `${quantitaIt(mq)} mq × ${EUR_MQ_COPERTURA} €/mq`,
     origine: {},
     valore: prodotto,
     unita: 'eur',
   },
   // …e la formula:
   formula: `(${numeroIt(prodotto)} + ${numeroIt(categoria)}) / 2 = ${numeroIt(importo)} €`,
   ```

3. In `regolaCappotto`, la stessa cosa con `EUR_MQ_CAPPOTTO`.
4. In `regolaCoperturaPiana`, la formula diventa
   `` `${quantitaIt(mqPiana)} mq — importo riportato sulla riga a falda` ``, così anche una
   riga a `compresa` dice perché.

Aggiungi i test corrispondenti:

```ts
it('mostra il prodotto intermedio, non solo i mq', () => {
  const passaggi = regolaCoperturaFalda(dacroce).passaggi
  const prodotto = passaggi.find((p) => p.etichetta.includes('× 220'))
  expect(prodotto).toBeDefined()
  expect(prodotto!.valore).toBe(40_519.60)
  expect(prodotto!.etichetta).toBe('184,18 mq × 220 €/mq')
})

it('la formula porta i valori sostituiti e il risultato', () => {
  expect(regolaCoperturaFalda(dacroce).formula).toBe(
    '(40 519,60 + 68 428,78) / 2 = 54 474,19 €',
  )
  expect(regolaCappotto(dacroce).formula).not.toMatch(/M:001\.\d{3}/)
})
```

**Files:**
- Modify: `src/domain/computo/regole-conteggio.ts` (aggiunge le regole)
- Modify: `src/domain/computo/regole-conteggio.test.ts` (aggiunge i test)

**Interfaces:**
- Consumes: `voceUnica`, `sommaQuantita` da `./accesso`; i tipi del Task 4.
- Produces:
  ```ts
  regolaCoperturaFalda(computo: Computo): VoceConteggiata
  regolaCoperturaPiana(computo: Computo): VoceConteggiata
  regolaCappotto(computo: Computo): VoceConteggiata
  const EUR_MQ_COPERTURA = 220
  const EUR_MQ_CAPPOTTO = 90
  ```

- [ ] **Step 1: Aggiungi i test che falliscono**

In coda a `src/domain/computo/regole-conteggio.test.ts`, e aggiungi
`regolaCoperturaFalda, regolaCoperturaPiana, regolaCappotto` all'import:

```ts
describe('regolaCoperturaFalda', () => {
  it('media i mq per 220 con la categoria COPERTURA', () => {
    // Dacroce: (184,18 × 220 = 40.519,60 + 68.428,78) / 2
    expect(regolaCoperturaFalda(dacroce).importo).toBe(54_474.19)
    // Crivellaro: (186,35 × 220 = 40.997,00 + 76.701,12) / 2
    expect(regolaCoperturaFalda(crivellaro).importo).toBe(58_849.06)
  })

  it('usa la sola riga a falda, non lo sporto che condivide la tariffa', () => {
    const passaggi = regolaCoperturaFalda(crivellaro).passaggi
    const falda = passaggi.find((p) => p.origine.tariffa === '104.02.000')!
    expect(falda.valore).toBe(186.35)
    expect(falda.valore).not.toBe(229.19)
    expect(falda.origine.numeroVoce).toBe(59)
  })

  it('espone i mq letti come passaggi in mq, non in euro', () => {
    const passaggi = regolaCoperturaFalda(dacroce).passaggi
    expect(passaggi.filter((p) => p.unita === 'mq')).toHaveLength(2)
  })
})

describe('regolaCoperturaPiana', () => {
  it("è sempre 'compresa': l'importo sta sulla riga a falda", () => {
    expect(regolaCoperturaPiana(dacroce).importo).toBe('compresa')
    expect(regolaCoperturaPiana(crivellaro).importo).toBe('compresa')
  })
})

describe('regolaCappotto', () => {
  it('media i mq della posa per 90 con la categoria CAPPOTTO', () => {
    // Dacroce: (195,16 × 90 = 17.564,40 + 25.684,61) / 2 = 21.624,505
    expect(regolaCappotto(dacroce).importo).toBe(21_624.51)
    // Crivellaro: (191,58 × 90 = 17.242,20 + 25.264,43) / 2 = 21.253,315
    expect(regolaCappotto(crivellaro).importo).toBe(21_253.32)
  })

  it('arrotonda per eccesso il mezzo centesimo, in entrambi i computi', () => {
    // Se si sommassero i valori grezzi senza arrotondare per voce, il delta di
    // pareggio slitterebbe di un centesimo e i golden case non tornerebbero.
    expect(regolaCappotto(dacroce).importo).not.toBe(21_624.5)
    expect(regolaCappotto(crivellaro).importo).not.toBe(21_253.31)
  })
})
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run src/domain/computo/regole-conteggio.test.ts`
Expected: FAIL — `regolaCoperturaFalda is not a function`.

- [ ] **Step 3: Implementa le tre regole**

In coda a `src/domain/computo/regole-conteggio.ts`, e aggiungi
`voceUnica, sommaQuantita` all'import da `./accesso`:

```ts
export const EUR_MQ_COPERTURA = 220
export const EUR_MQ_CAPPOTTO = 90

/**
 * La superficie a falda è quella della riga `104.02.000` che dice FALDA. La
 * stessa tariffa porta anche sporto, tettoie e portico — 42,84 mq in
 * Crivellaro — che restano fuori, e non è una perdita: nel computo gli strati
 * si dividono proprio così. Il pacchetto coibente (freno a vapore, isolamento,
 * posa) è misurato sulla falda; struttura e manto su falda più sporto, perché
 * lo sporto sta fuori dall'involucro riscaldato. I 220 €/mq valorizzano il
 * pacchetto coibentato.
 */
export function regolaCoperturaFalda(computo: Computo): VoceConteggiata {
  const falda = voceUnica(computo, '104.02.000', /FALDA/)
  const mqFalda = falda.quantita ?? 0
  const mqPiana = sommaQuantita(computo, '104.02.011')
  const mq = arrotondaCentesimi(mqFalda + mqPiana)
  const categoria = computo.riepilogo['M:001.003']?.importo ?? 0
  const importo = arrotondaCentesimi((mq * EUR_MQ_COPERTURA + categoria) / 2)
  return {
    idMaster: 'copertura-falda',
    descrizione:
      'Copertura a falda in travi e tavolato lato inferiore a vista, compresa ' +
      'coibentazione, teli, manto in tegole e lattoneria',
    passaggi: [
      {
        etichetta: 'mq copertura a falda',
        origine: { tariffa: '104.02.000', numeroVoce: falda.numero },
        valore: mqFalda,
        unita: 'mq',
      },
      {
        etichetta: 'mq copertura piana',
        origine: { tariffa: '104.02.011' },
        valore: mqPiana,
        unita: 'mq',
      },
      {
        etichetta: 'categoria COPERTURA',
        origine: { categoria: 'M:001.003' },
        valore: categoria,
        unita: 'eur',
      },
    ],
    formula: `(${mq} × ${EUR_MQ_COPERTURA} + M:001.003) / 2`,
    importo,
    provenienza: 'calcolato',
  }
}

/**
 * L'importo dell'intera copertura sta sulla riga a falda: questa riga resta a
 * `compresa` anche quando esiste una copertura piana.
 */
export function regolaCoperturaPiana(computo: Computo): VoceConteggiata {
  const mqPiana = sommaQuantita(computo, '104.02.011')
  return {
    idMaster: 'copertura-piana',
    descrizione: 'Tetto piano in lamellare lato inferiore a vista',
    passaggi: [
      {
        etichetta: 'mq copertura piana',
        origine: { tariffa: '104.02.011' },
        valore: mqPiana,
        unita: 'mq',
      },
    ],
    formula: "importo riportato su 'copertura-falda'",
    importo: 'compresa',
    provenienza: 'calcolato',
  }
}

/**
 * La superficie è quella della posa (`204.03.08`, il «codice 116»): comprende
 * lo zoccolo perimetrale, quindi è maggiore di quella dei soli pannelli.
 * `M:001.004` è un importo in euro, non una superficie: la media è fra euro.
 */
export function regolaCappotto(computo: Computo): VoceConteggiata {
  const mq = sommaQuantita(computo, '204.03.08')
  const categoria = computo.riepilogo['M:001.004']?.importo ?? 0
  const importo = arrotondaCentesimi((mq * EUR_MQ_CAPPOTTO + categoria) / 2)
  return {
    idMaster: 'cappotto',
    descrizione: 'Cappotto esterno in fibra di legno finito con rasante ed intonaco',
    passaggi: [
      {
        etichetta: 'mq posa cappotto',
        origine: { tariffa: '204.03.08' },
        valore: mq,
        unita: 'mq',
      },
      {
        etichetta: 'categoria CAPPOTTO',
        origine: { categoria: 'M:001.004' },
        valore: categoria,
        unita: 'eur',
      },
    ],
    formula: `(${mq} × ${EUR_MQ_CAPPOTTO} + M:001.004) / 2`,
    importo,
    provenienza: 'calcolato',
  }
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/domain/computo/regole-conteggio.test.ts`
Expected: PASS, 14 test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/computo/regole-conteggio.ts src/domain/computo/regole-conteggio.test.ts
git commit -m "feat: regole di copertura e cappotto, con media sul riepilogo

La copertura usa la sola riga a falda, non lo sporto che condivide la
tariffa 104.02.000: nel computo gli strati si dividono proprio cosi', il
pacchetto coibente sulla falda e struttura e manto su falda piu' sporto,
perche' lo sporto sta fuori dall'involucro riscaldato.

Il cappotto cade esattamente su mezzo centesimo in entrambi i computi
(21.624,505 e 21.253,315): i test fissano l'arrotondamento per eccesso,
perche' sommare i grezzi sposterebbe il delta di pareggio.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Regole di cartongesso, infissi e monoblocchi

**Emendamento — trasparenza.** Il cartongesso già espone i prodotti intermedi fra i
passaggi; qui manca solo la sostituzione nelle formule. Importa `numeroIt` e `quantitaIt`
da `./formatta-numero` e sostituisci le quattro `formula`:

- `regolaCartongesso`:
  `` `(${numeroIt(lastre)} + ${numeroIt(assistenza)} + ${numeroIt(categoria)}) / 2 = ${numeroIt(importo)} €` ``
  (estrai `importo` in una costante prima di comporre l'oggetto)
- `regolaAssistenzaCartongessisti`:
  `` `${quantitaIt(mq)} mq × ${EUR_MQ_ASSISTENZA} €/mq = ${numeroIt(importo)} €` ``
- `regolaInfissi`: la formula deve mostrare i tre addendi calcolati, non i soli
  moltiplicatori:
  `` `${numeroIt(mq * EUR_MQ_INFISSI)} + ${numeroIt(pezziMontaggio * EUR_PEZZO_MONTAGGIO)} + ${numeroIt(portoncini * EUR_PORTONCINO)} = ${numeroIt(importo)} €` ``
  Aggiungi anche i tre prodotti come passaggi in `eur`, accanto alle quantità che già ci
  sono, così si vede da dove viene ciascun addendo.
- `regolaMonoblocchi`: `` `somma di 3 tariffe: ${numeroIt(importo)} €` ``

Test da aggiungere:

```ts
it('la formula degli infissi mostra i tre addendi, non i moltiplicatori', () => {
  expect(regolaInfissi(dacroce).formula).toBe(
    '21 830,00 + 1 400,00 + 8 000,00 = 31 230,00 €',
  )
})

it('nessuna formula porta codici categoria grezzi', () => {
  const voci = [
    regolaCartongesso(dacroce),
    regolaAssistenzaCartongessisti(dacroce),
    regolaInfissi(dacroce),
    regolaMonoblocchi(dacroce),
  ]
  for (const voce of voci) expect(voce.formula).not.toMatch(/M:001\.\d{3}/)
})
```

**Files:**
- Modify: `src/domain/computo/regole-conteggio.ts`
- Modify: `src/domain/computo/regole-conteggio.test.ts`

**Interfaces:**
- Consumes: come Task 5.
- Produces:
  ```ts
  regolaCartongesso(computo: Computo): VoceConteggiata
  regolaAssistenzaCartongessisti(computo: Computo): VoceConteggiata
  regolaInfissi(computo: Computo): VoceConteggiata
  regolaMonoblocchi(computo: Computo): VoceConteggiata
  regolaTracciamentoImpianti(): VoceConteggiata
  regolaParetiTelaio(): VoceConteggiata
  const TARIFFE_INFISSI_MQ: readonly string[]
  const TARIFFE_INFISSI_PEZZI: readonly string[]
  ```

- [ ] **Step 1: Aggiungi i test che falliscono**

In coda al file di test, aggiungendo gli import corrispondenti:

```ts
describe('regolaCartongesso', () => {
  it('somma mq×22 e mq×5 al riepilogo, poi dimezza', () => {
    // Dacroce: (531,10 × 22 = 11.684,20 + 531,10 × 5 = 2.655,50 + 23.612,10) / 2
    expect(regolaCartongesso(dacroce).importo).toBe(18_975.90)
    expect(regolaCartongesso(crivellaro).importo).toBe(15_506.77)
  })

  it('moltiplica per 5 i mq, non il risultato del ×22', () => {
    const passaggi = regolaCartongesso(dacroce).passaggi
    expect(passaggi.find((p) => p.unita === 'mq')!.valore).toBe(531.1)
    // la lettura alternativa, (531,10 × 22) × 5, darebbe 41.016,55
    expect(regolaCartongesso(dacroce).importo).not.toBe(41_016.55)
  })
})

describe('regolaAssistenzaCartongessisti', () => {
  it('vale i mq di cartongesso per 5', () => {
    expect(regolaAssistenzaCartongessisti(dacroce).importo).toBe(2_655.50)
    expect(regolaAssistenzaCartongessisti(crivellaro).importo).toBe(2_162.30)
  })
})

describe('regolaInfissi', () => {
  it('somma mq×500, pezzi×100 e portoncini×4000', () => {
    // Dacroce: 43,66 × 500 + 14 × 100 + 2 × 4000
    expect(regolaInfissi(dacroce).importo).toBe(31_230)
    // Crivellaro: 28,30 × 500 + 11 × 100 + 1 × 4000
    expect(regolaInfissi(crivellaro).importo).toBe(19_250)
  })

  it('tratta il secondo gruppo come pezzi e il primo come superficie', () => {
    const passaggi = regolaInfissi(dacroce).passaggi
    expect(passaggi.find((p) => p.unita === 'mq')!.valore).toBe(43.66)
    expect(passaggi.find((p) => p.unita === 'nr' && p.etichetta.includes('montaggio'))!.valore).toBe(14)
  })

  it('conta i portoncini come pezzi di 109.04.07', () => {
    expect(regolaInfissi(dacroce).passaggi.find((p) => p.etichetta.includes('portoncini'))!.valore).toBe(2)
    expect(regolaInfissi(crivellaro).passaggi.find((p) => p.etichetta.includes('portoncini'))!.valore).toBe(1)
  })
})

describe('regolaMonoblocchi', () => {
  it('somma i totali in euro delle tre tariffe, non le quantità', () => {
    expect(regolaMonoblocchi(dacroce).importo).toBe(14_495)
    expect(regolaMonoblocchi(crivellaro).importo).toBe(9_450)
  })
})

describe('voci sempre comprese', () => {
  it('tracciamento impianti e pareti a telaio non sono modificabili', () => {
    for (const voce of [regolaTracciamentoImpianti(), regolaParetiTelaio()]) {
      expect(voce.importo).toBe('compresa')
      expect(voce.provenienza).toBe('fisso')
    }
  })
})
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run src/domain/computo/regole-conteggio.test.ts`
Expected: FAIL — `regolaCartongesso is not a function`.

- [ ] **Step 3: Implementa le regole**

In coda a `src/domain/computo/regole-conteggio.ts`:

```ts
export const EUR_MQ_CARTONGESSO = 22
export const EUR_MQ_ASSISTENZA = 5
export const EUR_MQ_INFISSI = 500
export const EUR_PEZZO_MONTAGGIO = 100
export const EUR_PORTONCINO = 4_000

function mqCartongesso(computo: Computo): number {
  return sommaQuantita(computo, '107.04.01')
}

/**
 * «Moltiplica totale cartongessi × 22. Moltiplica il risultato ottenuto × 5.»
 * Il secondo × 5 si applica ai mq, non al risultato del × 22: altrimenti
 * darebbe 58.421,00 su Dacroce e porterebbe la voce a 41.016,55. È la stessa
 * quantità della voce `assistenza-cartongessisti`, che viene comunque
 * fatturata a parte: entra lo stesso nella media, per scelta confermata.
 */
export function regolaCartongesso(computo: Computo): VoceConteggiata {
  const mq = mqCartongesso(computo)
  const lastre = arrotondaCentesimi(mq * EUR_MQ_CARTONGESSO)
  const assistenza = arrotondaCentesimi(mq * EUR_MQ_ASSISTENZA)
  const categoria = computo.riepilogo['M:001.005']?.importo ?? 0
  return {
    idMaster: 'cartongesso-q2',
    descrizione:
      'Cartongesso interno a placcatura diretta su pareti "M.H.M." con finitura "Q2"',
    passaggi: [
      { etichetta: 'mq pannelli in cartongesso', origine: { tariffa: '107.04.01' }, valore: mq, unita: 'mq' },
      { etichetta: `mq × ${EUR_MQ_CARTONGESSO}`, origine: {}, valore: lastre, unita: 'eur' },
      { etichetta: `mq × ${EUR_MQ_ASSISTENZA}`, origine: {}, valore: assistenza, unita: 'eur' },
      { etichetta: 'categoria CARTONGESSO', origine: { categoria: 'M:001.005' }, valore: categoria, unita: 'eur' },
    ],
    formula: `(mq × ${EUR_MQ_CARTONGESSO} + mq × ${EUR_MQ_ASSISTENZA} + M:001.005) / 2`,
    importo: arrotondaCentesimi((lastre + assistenza + categoria) / 2),
    provenienza: 'calcolato',
  }
}

export function regolaAssistenzaCartongessisti(computo: Computo): VoceConteggiata {
  const mq = mqCartongesso(computo)
  return {
    idMaster: 'assistenza-cartongessisti',
    descrizione: 'Assistenza ai cartongessisti',
    passaggi: [
      { etichetta: 'mq pannelli in cartongesso', origine: { tariffa: '107.04.01' }, valore: mq, unita: 'mq' },
    ],
    formula: `mq × ${EUR_MQ_ASSISTENZA}`,
    importo: arrotondaCentesimi(mq * EUR_MQ_ASSISTENZA),
    provenienza: 'calcolato',
  }
}

/**
 * Fornitura dei serramenti, a superficie. `109.04.02` (portabalcone) è
 * dichiarata `cadauno` nel computo ma la sua quantità è una superficie
 * (2,10 = 1,00 × 2,100), quindi appartiene a questo gruppo.
 */
export const TARIFFE_INFISSI_MQ = [
  '109.04.02', '109.04.03', '109.04.04', '109.04.05', '109.04.06',
] as const

/**
 * Montaggio, a pezzo. L'istruzione originale diceva «somma i valori mq», ma
 * queste voci sono in `cadauno`: non esiste una superficie da sommare.
 */
export const TARIFFE_INFISSI_PEZZI = [
  '109.04.07', '109.04.08', '109.04.09', '109.04.10', '109.04.11',
] as const

export function regolaInfissi(computo: Computo): VoceConteggiata {
  const mq = sommaQuantita(computo, ...TARIFFE_INFISSI_MQ)
  const pezziMontaggio = sommaQuantita(computo, ...TARIFFE_INFISSI_PEZZI)
  const portoncini = sommaQuantita(computo, '109.04.07')
  const importo = arrotondaCentesimi(
    mq * EUR_MQ_INFISSI + pezziMontaggio * EUR_PEZZO_MONTAGGIO + portoncini * EUR_PORTONCINO,
  )
  return {
    idMaster: 'infissi-pvc',
    descrizione: 'Infissi esterni in PVC (escluso oscuranti) con un portoncino di ingresso',
    passaggi: [
      { etichetta: 'mq fornitura serramenti', origine: {}, valore: mq, unita: 'mq' },
      { etichetta: 'pezzi di montaggio', origine: {}, valore: pezziMontaggio, unita: 'nr' },
      { etichetta: 'portoncini di ingresso', origine: { tariffa: '109.04.07' }, valore: portoncini, unita: 'nr' },
    ],
    formula: `mq × ${EUR_MQ_INFISSI} + pezzi × ${EUR_PEZZO_MONTAGGIO} + portoncini × ${EUR_PORTONCINO}`,
    importo,
    provenienza: 'calcolato',
  }
}

/**
 * Si sommano i totali in euro, non le quantità. La quantità di `109.04.13` non
 * è nemmeno intera (12,10 su Dacroce) perché Primus applica un fattore alla
 * riga dell'alzante scorrevole — 1,70 su Dacroce, 1,25 su Crivellaro — per
 * pesare i serramenti larghi con più di un monoblocco. Il fattore è già dentro
 * il prezzo: non va ricalcolato.
 */
export const TARIFFE_MONOBLOCCHI = ['109.04.12', '109.04.13', '109.04.14'] as const

export function regolaMonoblocchi(computo: Computo): VoceConteggiata {
  return {
    idMaster: 'monoblocchi',
    descrizione: 'Monoblocchi lisci su 4 lati ditta Hella per posa infissi',
    passaggi: TARIFFE_MONOBLOCCHI.map((tariffa) => ({
      etichetta: computo.voci.find((v) => v.tariffa === tariffa)?.descrizione.slice(0, 60) ?? tariffa,
      origine: { tariffa },
      valore: sommaTotali(computo, tariffa),
      unita: 'eur' as const,
    })),
    formula: 'Σ totali 109.04.12 + 109.04.13 + 109.04.14',
    importo: sommaTotali(computo, ...TARIFFE_MONOBLOCCHI),
    provenienza: 'calcolato',
  }
}

export function regolaTracciamentoImpianti(): VoceConteggiata {
  return {
    idMaster: 'tracciamento-impianti',
    descrizione:
      'Tracciamento impianto idrosanitario ed elettrico come da tavola di ' +
      '"predisposizione impianti" sottoscritta',
    passaggi: [],
    formula: 'sempre compresa',
    importo: 'compresa',
    provenienza: 'fisso',
  }
}

export function regolaParetiTelaio(): VoceConteggiata {
  return {
    idMaster: 'pareti-telaio',
    descrizione:
      'Pareti non strutturali a telaio composte dalla struttura del telaio e da ' +
      '2 lastre di cartongesso da un lato',
    passaggi: [],
    formula: 'sempre compresa',
    importo: 'compresa',
    provenienza: 'fisso',
  }
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/domain/computo/regole-conteggio.test.ts`
Expected: PASS, 22 test.

- [ ] **Step 5: Commit**

```bash
git add src/domain/computo/regole-conteggio.ts src/domain/computo/regole-conteggio.test.ts
git commit -m "feat: regole di cartongesso, infissi e monoblocchi

Nel cartongesso il secondo x5 si applica ai mq, non al risultato del
x22: quella lettura darebbe 58.421 su Dacroce e porterebbe la voce a
41.016,55. Un test fissa la differenza.

Negli infissi il secondo gruppo di tariffe e' in cadauno, non in mq:
non esiste una superficie da sommare, si contano i pezzi. All'inverso
109.04.02 e' dichiarata cadauno ma porta una superficie, quindi sta nel
gruppo dei mq.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Conteggio e riconciliazione

Il golden case completo: le dieci voci nell'ordine del master, la somma, il target, il
delta caricato sulle pareti.

**Emendamento — trasparenza (il buco più grave).** Il delta di pareggio è il numero più
grande che la pagina produce e l'unico che non viene dal computo. Col codice mostrato
negli step, la scheda delle pareti mostrerebbe `M:001.001 = 105.987,63` fra i passaggi e
poi un importo di `127.543,28`, senza niente che spieghi i 21.555,65 di differenza: un
numero che appare dal nulla.

In `eseguiConteggio`, dove sostituisci l'importo delle pareti, aggiungi anche il passaggio
e riscrivi la formula. Importa `numeroIt` da `./formatta-numero`:

```ts
const vociAPareggio = voci.map((voce) => {
  if (voce.idMaster !== ID_PARETI || typeof voce.importo !== 'number') return voce
  const aPareggio = arrotondaCentesimi(voce.importo + delta)
  return {
    ...voce,
    importo: aPareggio,
    // Il delta non viene dal computo: senza questo passaggio l'importo delle pareti
    // sarebbe l'unico numero della pagina che il lettore non può ricostruire.
    passaggi: [
      ...voce.passaggi,
      {
        etichetta:
          `pareggio: ${numeroIt(target)} di target − ${numeroIt(sommaVoci)} di voci conteggiate`,
        origine: {},
        valore: delta,
        unita: 'eur' as const,
      },
    ],
    formula:
      `${numeroIt(voce.importo)} + ${numeroIt(delta)} di pareggio = ${numeroIt(aPareggio)} €`,
  }
})
```

Test da aggiungere:

```ts
describe('trasparenza del pareggio', () => {
  const esito = eseguiConteggio(dacroce)
  const pareti = esito.voci.find((v) => v.idMaster === 'pareti-mhm')!

  it('dichiara il delta fra i passaggi delle pareti', () => {
    const pareggio = pareti.passaggi.find((p) => p.etichetta.startsWith('pareggio:'))
    expect(pareggio).toBeDefined()
    expect(pareggio!.valore).toBe(21_555.65)
    expect(pareggio!.etichetta).toContain('300 343,58')
    expect(pareggio!.etichetta).toContain('278 787,93')
  })

  it('la formula delle pareti ricostruisce l’importo finale', () => {
    expect(pareti.formula).toBe('105 987,63 + 21 555,65 di pareggio = 127 543,28 €')
  })

  it('ogni voce con importo numerico ha una formula non vuota', () => {
    for (const voce of esito.voci) {
      expect(voce.formula.length).toBeGreaterThan(0)
      expect(voce.formula).not.toMatch(/M:001\.\d{3}/)
    }
  })
})
```

**Files:**
- Create: `src/domain/computo/conteggio.ts`
- Test: `src/domain/computo/conteggio.test.ts`

**Interfaces:**
- Consumes: tutte le `regola*` da `./regole-conteggio`; `verificaIntegrita` da `./estrai-voci`.
- Produces:
  ```ts
  interface Avviso { livello: 'avviso' | 'errore'; codice: string; messaggio: string }
  interface RisultatoConteggio {
    voci: VoceConteggiata[]
    sommaVoci: number
    target: number
    delta: number
    avvisi: Avviso[]
  }
  const COSTI_SICUREZZA_FORFETTARI: number
  eseguiConteggio(computo: Computo, override?: Record<string, number>): RisultatoConteggio
  ```

- [ ] **Step 1: Scrivi i test che falliscono**

`src/domain/computo/conteggio.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { estraiComputo } from './estrai-voci'
import { eseguiConteggio, COSTI_SICUREZZA_FORFETTARI } from './conteggio'
import dacroceFixture from './fixtures/dacroce.json'
import crivellaroFixture from './fixtures/crivellaro.json'
import type { FrammentoTesto } from './frammenti'

const dacroce = estraiComputo(dacroceFixture as FrammentoTesto[])
const crivellaro = estraiComputo(crivellaroFixture as FrammentoTesto[])

function importo(risultato: ReturnType<typeof eseguiConteggio>, idMaster: string) {
  return risultato.voci.find((v) => v.idMaster === idMaster)!.importo
}

describe('eseguiConteggio — golden case Dacroce rev.03', () => {
  const esito = eseguiConteggio(dacroce)

  it('riconcilia sul totale del computo meno la sicurezza forfettaria', () => {
    expect(esito.sommaVoci).toBe(278_787.93)
    expect(esito.target).toBe(300_343.58)
    expect(esito.delta).toBe(21_555.65)
  })

  it('carica il delta sulle pareti strutturali', () => {
    expect(importo(esito, 'pareti-mhm')).toBe(127_543.28)
  })

  it('produce gli importi attesi per ogni voce', () => {
    expect(importo(esito, 'trave-larice')).toBe(10_104.24)
    expect(importo(esito, 'solaio-interpiano')).toBe(15_240.96)
    expect(importo(esito, 'copertura-falda')).toBe(54_474.19)
    expect(importo(esito, 'cappotto')).toBe(21_624.51)
    expect(importo(esito, 'cartongesso-q2')).toBe(18_975.90)
    expect(importo(esito, 'assistenza-cartongessisti')).toBe(2_655.50)
    expect(importo(esito, 'infissi-pvc')).toBe(31_230)
    expect(importo(esito, 'monoblocchi')).toBe(14_495)
    expect(importo(esito, 'progettazione-esecutiva')).toBe(4_000)
  })

  it('atterra esattamente sul target', () => {
    const somma = esito.voci.reduce(
      (t, v) => t + (typeof v.importo === 'number' ? v.importo : 0),
      0,
    )
    expect(Math.round(somma * 100) / 100).toBe(esito.target)
  })
})

describe('eseguiConteggio — golden case Crivellaro rev.04', () => {
  const esito = eseguiConteggio(crivellaro)

  it('riconcilia sul totale del computo', () => {
    expect(esito.sommaVoci).toBe(215_815.97)
    expect(esito.target).toBe(236_960.99)
    expect(esito.delta).toBe(21_145.02)
    expect(importo(esito, 'pareti-mhm')).toBe(100_645.84)
  })

  it("mostra il solaio come 'compresa' quando la categoria vale zero", () => {
    expect(importo(esito, 'solaio-interpiano')).toBe('compresa')
  })

  it('produce gli importi attesi per ogni voce', () => {
    expect(importo(esito, 'trave-larice')).toBe(5_843.70)
    expect(importo(esito, 'copertura-falda')).toBe(58_849.06)
    expect(importo(esito, 'cappotto')).toBe(21_253.32)
    expect(importo(esito, 'cartongesso-q2')).toBe(15_506.77)
    expect(importo(esito, 'assistenza-cartongessisti')).toBe(2_162.30)
    expect(importo(esito, 'infissi-pvc')).toBe(19_250)
    expect(importo(esito, 'monoblocchi')).toBe(9_450)
  })
})

describe('ordine e struttura', () => {
  it('elenca le voci nell’ordine di Conteggi Master', () => {
    expect(eseguiConteggio(dacroce).voci.map((v) => v.idMaster)).toEqual([
      'pareti-mhm',
      'tracciamento-impianti',
      'pareti-telaio',
      'trave-larice',
      'solaio-interpiano',
      'copertura-falda',
      'copertura-piana',
      'cappotto',
      'cartongesso-q2',
      'assistenza-cartongessisti',
      'infissi-pvc',
      'monoblocchi',
      'progettazione-esecutiva',
    ])
  })
})

describe('avvisi', () => {
  it('segnala che la sicurezza del computo differisce dalla forfettaria', () => {
    // entrambi i computi hanno M:001.020 = 23.352,50 contro i 23.300 forfettari
    expect(COSTI_SICUREZZA_FORFETTARI).toBe(23_300)
    const avviso = eseguiConteggio(dacroce).avvisi.find((a) => a.codice === 'sicurezza-diversa')
    expect(avviso).toBeDefined()
    expect(avviso!.livello).toBe('avviso')
    expect(avviso!.messaggio).toContain('23.352,50')
  })

  it('non segnala nulla di grave sui due computi reali', () => {
    for (const computo of [dacroce, crivellaro]) {
      expect(eseguiConteggio(computo).avvisi.filter((a) => a.livello === 'errore')).toEqual([])
    }
  })

  it('segnala un delta negativo, che è legittimo ma anomalo', () => {
    const gonfiato = {
      ...dacroce,
      riepilogo: {
        ...dacroce.riepilogo,
        'M:001.005': { nome: 'CARTONGESSO', importo: 900_000 },
      },
    }
    const esito = eseguiConteggio(gonfiato)
    expect(esito.delta).toBeLessThan(0)
    expect(esito.avvisi.some((a) => a.codice === 'delta-negativo')).toBe(true)
  })
})

describe('override manuale', () => {
  it('sostituisce l’importo e ne cambia la provenienza', () => {
    const esito = eseguiConteggio(dacroce, { monoblocchi: 13_200 })
    const voce = esito.voci.find((v) => v.idMaster === 'monoblocchi')!
    expect(voce.importo).toBe(13_200)
    expect(voce.provenienza).toBe('manuale')
  })

  it('ricalcola il pareggio: il delta assorbe la correzione', () => {
    const base = eseguiConteggio(dacroce)
    const corretto = eseguiConteggio(dacroce, { monoblocchi: 13_200 })
    expect(corretto.delta).toBe(Math.round((base.delta + 1_295) * 100) / 100)
    expect(corretto.target).toBe(base.target)
  })
})
```

- [ ] **Step 2: Esegui i test per vederli fallire**

Run: `npx vitest run src/domain/computo/conteggio.test.ts`
Expected: FAIL — `Failed to resolve import "./conteggio"`.

- [ ] **Step 3: Implementa il conteggio**

`src/domain/computo/conteggio.ts`:

```ts
import { arrotondaCentesimi } from '../calcolo'
import type { Computo } from './estrai-voci'
import { verificaIntegrita } from './estrai-voci'
import {
  regolaParetiBase,
  regolaTracciamentoImpianti,
  regolaParetiTelaio,
  regolaTraveBase,
  regolaSolaio,
  regolaCoperturaFalda,
  regolaCoperturaPiana,
  regolaCappotto,
  regolaCartongesso,
  regolaAssistenzaCartongessisti,
  regolaInfissi,
  regolaMonoblocchi,
  regolaConsulenza,
  type VoceConteggiata,
} from './regole-conteggio'

/**
 * Sottratti al totale del computo per ottenere il Listino di riferimento.
 * Entrambi i computi analizzati riportano `M:001.020 = 23.352,50`: lo scarto di
 * 52,50 è voluto, ma il conteggio lo segnala perché un computo con sicurezza
 * diversa sposterebbe il pareggio senza dirlo.
 */
export const COSTI_SICUREZZA_FORFETTARI = 23_300

export interface Avviso {
  livello: 'avviso' | 'errore'
  codice: string
  messaggio: string
}

export interface RisultatoConteggio {
  /** Nell'ordine di Conteggi Master, con le pareti già portate a pareggio. */
  voci: VoceConteggiata[]
  sommaVoci: number
  target: number
  delta: number
  avvisi: Avviso[]
}

function formattaEuro(valore: number): string {
  return valore.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** L'ordine è quello del foglio Conteggi Master. */
const REGOLE: Array<(computo: Computo) => VoceConteggiata> = [
  regolaParetiBase,
  regolaTracciamentoImpianti,
  regolaParetiTelaio,
  regolaTraveBase,
  regolaSolaio,
  regolaCoperturaFalda,
  regolaCoperturaPiana,
  regolaCappotto,
  regolaCartongesso,
  regolaAssistenzaCartongessisti,
  regolaInfissi,
  regolaMonoblocchi,
  regolaConsulenza,
]

const ID_PARETI = 'pareti-mhm'

export function eseguiConteggio(
  computo: Computo,
  override: Record<string, number> = {},
): RisultatoConteggio {
  const avvisi: Avviso[] = []

  const integrita = verificaIntegrita(computo)
  if (!integrita.coerente) {
    avvisi.push({
      livello: 'errore',
      codice: 'integrita',
      messaggio:
        `La somma delle voci (${formattaEuro(integrita.totaleVoci)}) non pareggia il totale ` +
        `del riepilogo (${formattaEuro(integrita.totaleRiepilogo)}). ` +
        'Il computo è stato letto male: i conteggi non sono affidabili.',
    })
  }

  const sicurezzaComputo = computo.riepilogo['M:001.020']?.importo
  if (sicurezzaComputo !== undefined && sicurezzaComputo !== COSTI_SICUREZZA_FORFETTARI) {
    avvisi.push({
      livello: 'avviso',
      codice: 'sicurezza-diversa',
      messaggio:
        `Il computo riporta costi sicurezza di ${formattaEuro(sicurezzaComputo)}, ` +
        `mentre il pareggio usa i ${formattaEuro(COSTI_SICUREZZA_FORFETTARI)} forfettari.`,
    })
  }

  const voci = REGOLE.map((regola) => {
    const voce = regola(computo)
    const correzione = override[voce.idMaster]
    if (correzione === undefined) return voce
    return { ...voce, importo: arrotondaCentesimi(correzione), provenienza: 'manuale' as const }
  })

  const sommaVoci = arrotondaCentesimi(
    voci.reduce((totale, voce) => totale + (typeof voce.importo === 'number' ? voce.importo : 0), 0),
  )
  const target = arrotondaCentesimi(computo.totale - COSTI_SICUREZZA_FORFETTARI)
  const delta = arrotondaCentesimi(target - sommaVoci)

  if (delta < 0) {
    avvisi.push({
      livello: 'avviso',
      codice: 'delta-negativo',
      messaggio:
        `Il conteggio supera il target di ${formattaEuro(-delta)}: il pareggio ridurrebbe ` +
        'le pareti strutturali. È legittimo ma inusuale, vale la pena verificare le voci.',
    })
  }

  // Il pareggio si carica sulle pareti. La voce è già nell'elenco col suo
  // importo di categoria: la si sostituisce sommandoci il delta.
  const vociAPareggio = voci.map((voce) => {
    if (voce.idMaster !== ID_PARETI || typeof voce.importo !== 'number') return voce
    return { ...voce, importo: arrotondaCentesimi(voce.importo + delta) }
  })

  return { voci: vociAPareggio, sommaVoci, target, delta, avvisi }
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/domain/computo/conteggio.test.ts`
Expected: PASS, 12 test.

- [ ] **Step 5: Esegui tutta la suite e il typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, nessun errore di tipo.

- [ ] **Step 6: Commit**

```bash
git add src/domain/computo/conteggio.ts src/domain/computo/conteggio.test.ts
git commit -m "feat: conteggio completo e riconciliazione sulle pareti

I due computi reali diventano golden case: Dacroce atterra su un Listino
di 300.343,58 con delta 21.555,65, Crivellaro su 236.960,99 con delta
21.145,02. Il delta e' notevolmente stabile fra i due casi, segno che le
regole sottostimano in modo sistematico e non casuale.

Gli avvisi coprono i tre modi in cui un computo puo' sorprendere: le
voci che non pareggiano il riepilogo (errore, i conteggi non sono
affidabili), la sicurezza diversa dai 23.300 forfettari, e il delta
negativo che ridurrebbe le pareti.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Pagina e caricamento del computo

**Emendamento — trasparenza.** `formatta.ts` non riscrive la formattazione dei numeri: la
costruisce su `numeroIt` e `quantitaIt` di `src/domain/computo/formatta-numero.ts`, creato
nel Task 4. Due formattatori separati divergerebbero alla prima modifica, e le formule
delle regole userebbero una convenzione diversa dalle tabelle.

```ts
import { numeroIt, quantitaIt } from '@/domain/computo/formatta-numero'

/** Formato importi FBE: spazio per le migliaia, virgola decimale (CLAUDE.md). */
export function formattaEuro(valore: number): string {
  return `${numeroIt(valore)} €`
}

export function formattaQuantita(valore: number, unita: string): string {
  return `${quantitaIt(valore)} ${unita}`
}
```

I test dello Step 1 restano validi così come sono: verificano lo stesso comportamento
osservabile.

**Files:**
- Create: `src/app/preventivi/conteggi/page.tsx`
- Create: `src/app/preventivi/conteggi/CaricamentoComputo.tsx`
- Create: `src/app/preventivi/conteggi/formatta.ts`
- Test: `src/app/preventivi/conteggi/formatta.test.ts`

**Interfaces:**
- Consumes: `frammentiDaPdf` da `./leggi-pdf`; `estraiComputo`, `verificaIntegrita` dal dominio.
- Produces: `formattaEuro(valore: number): string`, `formattaQuantita(valore: number, unita: string): string`.

- [ ] **Step 1: Scrivi il test del formato che fallisce**

`src/app/preventivi/conteggi/formatta.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formattaEuro, formattaQuantita } from './formatta'

describe('formattaEuro', () => {
  it('usa lo spazio per le migliaia e la virgola decimale', () => {
    // convenzione CLAUDE.md: "96 100,00 €"
    expect(formattaEuro(96_100)).toBe('96 100,00 €')
    expect(formattaEuro(127_543.28)).toBe('127 543,28 €')
    expect(formattaEuro(4_000)).toBe('4 000,00 €')
  })

  it('non mette il separatore sotto il migliaio', () => {
    expect(formattaEuro(543.2)).toBe('543,20 €')
  })
})

describe('formattaQuantita', () => {
  it('accosta l’unità di misura', () => {
    expect(formattaQuantita(184.18, 'mq')).toBe('184,18 mq')
    expect(formattaQuantita(14, 'nr')).toBe('14 nr')
  })
})
```

- [ ] **Step 2: Esegui il test per vederlo fallire**

Run: `npx vitest run src/app/preventivi/conteggi/formatta.test.ts`
Expected: FAIL — `Failed to resolve import "./formatta"`.

- [ ] **Step 3: Implementa il formato**

`src/app/preventivi/conteggi/formatta.ts`:

```ts
/**
 * Formato importi FBE: spazio per le migliaia, virgola decimale (CLAUDE.md).
 * `toLocaleString('it-IT')` userebbe il punto, quindi si sostituisce.
 */
export function formattaEuro(valore: number): string {
  const testo = valore.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${testo.replace(/\./g, ' ')} €`
}

export function formattaQuantita(valore: number, unita: string): string {
  const decimali = Number.isInteger(valore) ? 0 : 2
  const testo = valore.toLocaleString('it-IT', {
    minimumFractionDigits: decimali,
    maximumFractionDigits: 2,
  })
  return `${testo.replace(/\./g, ' ')} ${unita}`
}
```

- [ ] **Step 4: Esegui il test**

Run: `npx vitest run src/app/preventivi/conteggi/formatta.test.ts`
Expected: PASS, 3 test.

- [ ] **Step 5: Implementa il caricamento**

`src/app/preventivi/conteggi/CaricamentoComputo.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { frammentiDaPdf } from './leggi-pdf'
import { estraiComputo, verificaIntegrita, type Computo } from '@/domain/computo/estrai-voci'
import { formattaEuro } from './formatta'

interface Props {
  computo: Computo | null
  onComputo: (computo: Computo, nomeFile: string) => void
  nomeFile: string | null
}

export function CaricamentoComputo({ computo, onComputo, nomeFile }: Props) {
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function leggi(file: File) {
    setInCorso(true)
    setErrore(null)
    try {
      const frammenti = await frammentiDaPdf(await file.arrayBuffer())
      const estratto = estraiComputo(frammenti)
      if (estratto.voci.length === 0) {
        setErrore('Nessuna voce riconosciuta: il PDF non sembra un computo Primus.')
        return
      }
      onComputo(estratto, file.name)
    } catch (causa) {
      setErrore(causa instanceof Error ? causa.message : 'Lettura del PDF non riuscita.')
    } finally {
      setInCorso(false)
    }
  }

  const integrita = computo ? verificaIntegrita(computo) : null

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Computo metrico</h2>
      <p className="mt-1 text-sm text-slate-600">
        Il PDF resta nel browser: non viene caricato da nessuna parte.
      </p>

      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2
                        rounded-lg border-2 border-dashed border-slate-300 px-6 py-8
                        text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50">
        <input
          type="file"
          accept="application/pdf,.pdf,.PDF"
          className="sr-only"
          onChange={(evento) => {
            const file = evento.target.files?.[0]
            if (file) void leggi(file)
          }}
        />
        {inCorso ? 'Lettura in corso…' : 'Scegli il PDF del computo, o trascinalo qui'}
      </label>

      {errore && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-800">
          {errore}
        </p>
      )}

      {computo && integrita && (
        <div className="mt-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Dato etichetta="File" valore={nomeFile ?? '—'} />
            <Dato etichetta="Voci lette" valore={String(computo.voci.length)} />
            <Dato etichetta="Categorie" valore={String(Object.keys(computo.riepilogo).length)} />
            <Dato etichetta="Totale computo" valore={formattaEuro(computo.totale)} />
          </dl>

          <p
            className={`mt-4 rounded-md px-4 py-3 text-sm ${
              integrita.coerente ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'
            }`}
          >
            {integrita.coerente
              ? `Verifica superata: la somma delle voci pareggia il riepilogo (${formattaEuro(integrita.totaleVoci)}).`
              : `Le voci sommano ${formattaEuro(integrita.totaleVoci)} contro ${formattaEuro(integrita.totaleRiepilogo)} del riepilogo: il computo è stato letto male.`}
          </p>

          <table className="mt-6 w-full text-sm">
            <caption className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              Riepilogo strutturale, come nel computo
            </caption>
            <tbody>
              {Object.entries(computo.riepilogo).map(([codice, categoria]) => (
                <tr key={codice} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 font-mono text-xs text-slate-500">{codice}</td>
                  <td className="py-2 text-slate-700">{categoria.nome}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                    {formattaEuro(categoria.importo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Dato({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{etichetta}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-slate-900">{valore}</dd>
    </div>
  )
}
```

- [ ] **Step 6: Implementa il guscio della pagina**

`src/app/preventivi/conteggi/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { CaricamentoComputo } from './CaricamentoComputo'
import type { Computo } from '@/domain/computo/estrai-voci'

export default function PaginaConteggi() {
  const [computo, setComputo] = useState<Computo | null>(null)
  const [nomeFile, setNomeFile] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Conteggi da computo metrico</h1>
        <p className="mt-2 text-slate-600">
          Ricava gli importi delle voci dell&apos;offerta dal computo Primus, mostrando ogni
          passaggio. Non modifica i preventivi esistenti.
        </p>
      </header>

      <CaricamentoComputo
        computo={computo}
        nomeFile={nomeFile}
        onComputo={(estratto, nome) => {
          setComputo(estratto)
          setNomeFile(nome)
        }}
      />
    </main>
  )
}
```

- [ ] **Step 7: Verifica nel browser**

Avvia il preview con `preview_start` (nome `dev` in `.claude/launch.json`, creandolo se
manca con `runtimeExecutable: "npm"`, `runtimeArgs: ["run","dev"]`, `port: 3000`), poi
naviga a `/preventivi/conteggi`.

Carica `Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF`.

Atteso: 166 voci, 8 categorie, totale `323 643,58 €`, verifica superata in verde, e la
tabella del riepilogo con le otto categorie. Controlla `read_console_messages`: nessun
errore, in particolare nessun fallimento di caricamento del worker.

- [ ] **Step 8: Commit**

```bash
git add src/app/preventivi/conteggi/ && git commit -m "feat: pagina dei conteggi con caricamento del computo

Il PDF si legge nel browser e non viene caricato da nessuna parte.
Subito dopo l'estrazione la pagina mostra l'esito della verifica
d'integrita': se le voci non pareggiano il riepilogo lo dice, perche' un
conteggio su un computo letto male produrrebbe numeri plausibili e
sbagliati.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Schede dei passaggi con correzione manuale

**Files:**
- Create: `src/app/preventivi/conteggi/SchedaVoce.tsx`
- Modify: `src/app/preventivi/conteggi/page.tsx`

**Interfaces:**
- Consumes: `VoceConteggiata`, `Passaggio` da `@/domain/computo/regole-conteggio`;
  `eseguiConteggio` da `@/domain/computo/conteggio`; `formattaEuro`, `formattaQuantita`.
- Produces: `<SchedaVoce voce numero onOverride onRipristina />`.

- [ ] **Step 1: Implementa la scheda**

`src/app/preventivi/conteggi/SchedaVoce.tsx`:

```tsx
'use client'

import { useState } from 'react'
import type { VoceConteggiata } from '@/domain/computo/regole-conteggio'
import { formattaEuro, formattaQuantita } from './formatta'

interface Props {
  voce: VoceConteggiata
  numero: string
  onOverride: (idMaster: string, importo: number) => void
  onRipristina: (idMaster: string) => void
}

const ETICHETTA_PROVENIENZA: Record<VoceConteggiata['provenienza'], string> = {
  calcolato: 'calcolato dal computo',
  manuale: 'corretto a mano',
  fisso: 'importo fisso',
}

export function SchedaVoce({ voce, numero, onOverride, onRipristina }: Props) {
  const [bozza, setBozza] = useState('')

  const manuale = voce.provenienza === 'manuale'

  return (
    <article
      className={`rounded-lg border bg-white ${
        manuale ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
      }`}
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white">
          {numero}
        </span>
        <h3 className="flex-1 text-sm font-semibold text-slate-900">{voce.descrizione}</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            manuale ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {ETICHETTA_PROVENIENZA[voce.provenienza]}
        </span>
      </header>

      {voce.passaggi.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {voce.passaggi.map((passaggio, indice) => (
              <tr key={indice} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2 text-slate-700">{passaggio.etichetta}</td>
                <td className="py-2 font-mono text-xs text-slate-500">
                  {passaggio.origine.tariffa ?? passaggio.origine.categoria ?? ''}
                  {passaggio.origine.numeroVoce ? ` · voce ${passaggio.origine.numeroVoce}` : ''}
                </td>
                <td className="px-5 py-2 text-right font-mono tabular-nums text-slate-900">
                  {passaggio.unita === 'eur'
                    ? formattaEuro(passaggio.valore)
                    : formattaQuantita(passaggio.valore, passaggio.unita)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-5 py-3">
        <code className="text-xs text-slate-600">{voce.formula}</code>
        <div className="flex items-center gap-3">
          <span className="font-mono text-base font-semibold tabular-nums text-slate-900">
            {typeof voce.importo === 'number' ? formattaEuro(voce.importo) : voce.importo}
          </span>
          {voce.provenienza !== 'fisso' && (
            <>
              <label className="sr-only" htmlFor={`correggi-${voce.idMaster}`}>
                Correggi l&apos;importo di {voce.descrizione}
              </label>
              <input
                id={`correggi-${voce.idMaster}`}
                inputMode="decimal"
                placeholder="correggi"
                value={bozza}
                onChange={(evento) => setBozza(evento.target.value)}
                onBlur={() => {
                  const valore = Number.parseFloat(bozza.replace(/\s/g, '').replace(',', '.'))
                  if (Number.isFinite(valore)) onOverride(voce.idMaster, valore)
                  setBozza('')
                }}
                className="w-28 rounded border border-slate-300 px-2 py-1 text-right font-mono text-sm
                           focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              />
              {manuale && (
                <button
                  type="button"
                  onClick={() => onRipristina(voce.idMaster)}
                  className="rounded px-2 py-1 text-xs text-slate-600 underline hover:text-slate-900
                             focus:outline-none focus:ring-1 focus:ring-slate-500"
                >
                  ripristina
                </button>
              )}
            </>
          )}
        </div>
      </footer>
    </article>
  )
}
```

- [ ] **Step 2: Collega le schede alla pagina**

In `src/app/preventivi/conteggi/page.tsx`, aggiungi lo stato degli override, il conteggio
e la numerazione. La numerazione si calcola al render sulle voci incluse — vincolo #4:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { CaricamentoComputo } from './CaricamentoComputo'
import { SchedaVoce } from './SchedaVoce'
import { eseguiConteggio } from '@/domain/computo/conteggio'
import type { Computo } from '@/domain/computo/estrai-voci'

/** Numeri di riga del foglio Conteggi Master, per id stabile. */
const NUMERO_MASTER: Record<string, string> = {
  'pareti-mhm': '1',
  'tracciamento-impianti': '1.a',
  'pareti-telaio': '1.b',
  'trave-larice': '1.c',
  'solaio-interpiano': '2',
  'copertura-falda': '3',
  'copertura-piana': '3.a',
  cappotto: '4',
  'cartongesso-q2': '5',
  'assistenza-cartongessisti': '5.a',
  'infissi-pvc': '6',
  monoblocchi: '6.a',
  'progettazione-esecutiva': '7',
}

export default function PaginaConteggi() {
  const [computo, setComputo] = useState<Computo | null>(null)
  const [nomeFile, setNomeFile] = useState<string | null>(null)
  const [override, setOverride] = useState<Record<string, number>>({})

  const esito = useMemo(
    () => (computo ? eseguiConteggio(computo, override) : null),
    [computo, override],
  )

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Conteggi da computo metrico</h1>
        <p className="mt-2 text-slate-600">
          Ricava gli importi delle voci dell&apos;offerta dal computo Primus, mostrando ogni
          passaggio. Non modifica i preventivi esistenti.
        </p>
      </header>

      <CaricamentoComputo
        computo={computo}
        nomeFile={nomeFile}
        onComputo={(estratto, nome) => {
          setComputo(estratto)
          setNomeFile(nome)
          setOverride({})
        }}
      />

      {esito && (
        <>
          {esito.avvisi.length > 0 && (
            <ul className="mt-8 space-y-2">
              {esito.avvisi.map((avviso) => (
                <li
                  key={avviso.codice}
                  role={avviso.livello === 'errore' ? 'alert' : undefined}
                  className={`rounded-md px-4 py-3 text-sm ${
                    avviso.livello === 'errore'
                      ? 'bg-red-50 text-red-800'
                      : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {avviso.messaggio}
                </li>
              ))}
            </ul>
          )}

          <section className="mt-8">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Passaggi</h2>
            <div className="flex flex-col gap-4">
              {esito.voci.map((voce) => (
                <SchedaVoce
                  key={voce.idMaster}
                  voce={voce}
                  numero={NUMERO_MASTER[voce.idMaster] ?? ''}
                  onOverride={(id, importo) => setOverride((v) => ({ ...v, [id]: importo }))}
                  onRipristina={(id) =>
                    setOverride(({ [id]: _rimosso, ...resto }) => resto)
                  }
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 3: Verifica nel browser**

Ricarica `/preventivi/conteggi` e ricarica il PDF Dacroce.

Atteso: tredici schede nell'ordine del master. La scheda `3` mostra i passaggi
`mq copertura a falda 184,18 mq · 104.02.000 · voce 59`, `mq copertura piana 0 mq`,
`categoria COPERTURA 68 428,78 €`, formula `(184.18 × 220 + M:001.003) / 2`, importo
`54 474,19 €`. La scheda `1` mostra `127 543,28 €`. Un avviso ambra sulla sicurezza.

Scrivi `13200` nel campo dei monoblocchi e togli il fuoco: l'importo diventa
`13 200,00 €`, l'etichetta passa a `corretto a mano`, la scheda si evidenzia, e le pareti
**salgono** a `128 838,28 €` — il pareggio assorbe la riduzione, quindi ciò che si toglie
a una voce ricompare sulle pareti. Premi `ripristina`: torna tutto come prima.

Fai uno screenshot con `computer {action: "screenshot"}` per il resoconto.

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/conteggi/ && git commit -m "feat: schede dei passaggi con correzione manuale

Ogni voce mostra le sorgenti lette con il loro codice tariffa, la
formula e il risultato: i passaggi devono essere visibili, non solo il
numero finale.

Correggere un importo lo marca 'corretto a mano' ed evidenzia la scheda
(vincolo #7: ogni importo dichiara da dove viene), e il pareggio si
ricalcola assorbendo la correzione sulle pareti. I numeri di riga si
calcolano al render dagli id stabili, mai memorizzati (vincolo #4).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Riconciliazione in interfaccia e tabella master

**Files:**
- Create: `src/app/preventivi/conteggi/Riconciliazione.tsx`
- Modify: `src/app/preventivi/conteggi/page.tsx`

**Interfaces:**
- Consumes: `RisultatoConteggio` da `@/domain/computo/conteggio`; `applicaScontiACascata`
  da `@/domain/calcolo`; `formattaEuro`.
- Produces: `<Riconciliazione esito totaleComputo />`.

- [ ] **Step 1: Implementa la riconciliazione**

`src/app/preventivi/conteggi/Riconciliazione.tsx`. Il blocco commerciale riusa
`applicaScontiACascata`: gli sconti sono a cascata, non additivi — vincolo #1.

```tsx
'use client'

import type { RisultatoConteggio } from '@/domain/computo/conteggio'
import { COSTI_SICUREZZA_FORFETTARI } from '@/domain/computo/conteggio'
import { applicaScontiACascata } from '@/domain/calcolo'
import { formattaEuro } from './formatta'

interface Props {
  esito: RisultatoConteggio
  totaleComputo: number
  numeroMaster: Record<string, string>
}

/** Default del foglio Conteggi Master. */
const SCONTI = [
  { percentuale: 0.02, causale: 'sconto cliente' },
  { percentuale: 0.03, causale: 'per conferme entro il 31.07.2026' },
]

export function Riconciliazione({ esito, totaleComputo, numeroMaster }: Props) {
  const listino = esito.target
  const sconti = applicaScontiACascata(listino, SCONTI)
  const parziale =
    Math.round((listino - sconti.reduce((t, s) => t + s.importoCalcolato, 0)) * 100) / 100

  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Riconciliazione</h2>

      <div className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <tbody>
            <Riga etichetta="Somma delle voci conteggiate" valore={esito.sommaVoci} />
            <Riga
              etichetta={`Totale computo − ${formattaEuro(COSTI_SICUREZZA_FORFETTARI)} di sicurezza`}
              valore={esito.target}
              nota={`da ${formattaEuro(totaleComputo)}`}
            />
            <Riga
              etichetta="Delta caricato sulle pareti strutturali"
              valore={esito.delta}
              evidenzia
            />
          </tbody>
        </table>
      </div>

      <h3 className="mt-8 mb-3 text-base font-semibold text-slate-900">
        Voci dell&apos;offerta
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[32rem] text-sm">
          <tbody>
            {esito.voci.map((voce) => (
              <tr key={voce.idMaster} className="border-b border-slate-100 last:border-0">
                <td className="w-12 px-4 py-2 font-mono text-xs text-slate-500">
                  {numeroMaster[voce.idMaster] ?? ''}
                </td>
                <td className="py-2 pr-4 text-slate-700">{voce.descrizione}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                  {typeof voce.importo === 'number' ? formattaEuro(voce.importo) : voce.importo}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-900 bg-slate-50 font-semibold">
              <td />
              <td className="py-2 pr-4 text-slate-900">Listino</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                {formattaEuro(listino)}
              </td>
            </tr>
            {sconti.map((sconto) => (
              <tr key={sconto.ordine} className="border-b border-slate-100">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">
                  {(sconto.percentuale * 100).toLocaleString('it-IT')}%
                </td>
                <td className="py-2 pr-4 text-slate-600">{sconto.causale}</td>
                <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-600">
                  − {formattaEuro(sconto.importoCalcolato)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-300 bg-slate-50 font-semibold">
              <td />
              <td className="py-2 pr-4 text-slate-900">
                Parziale al grezzo avanzato, esclusa I.V.A.
              </td>
              <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                {formattaEuro(parziale)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Gli sconti sono a cascata: il secondo si applica al residuo dopo il primo.
        L&apos;arrotondamento manuale che porta il totale su una cifra tonda resta al
        wizard dei preventivi.
      </p>
    </section>
  )
}

function Riga({
  etichetta,
  valore,
  nota,
  evidenzia,
}: {
  etichetta: string
  valore: number
  nota?: string
  evidenzia?: boolean
}) {
  return (
    <tr className={`border-b border-slate-100 last:border-0 ${evidenzia ? 'bg-slate-50' : ''}`}>
      <td className="px-5 py-3 text-slate-700">
        {etichetta}
        {nota && <span className="ml-2 text-xs text-slate-500">{nota}</span>}
      </td>
      <td
        className={`px-5 py-3 text-right font-mono tabular-nums ${
          evidenzia ? 'font-semibold text-slate-900' : 'text-slate-900'
        }`}
      >
        {formattaEuro(valore)}
      </td>
    </tr>
  )
}
```

- [ ] **Step 2: Collega alla pagina**

In `src/app/preventivi/conteggi/page.tsx`: esporta `NUMERO_MASTER`, importa
`Riconciliazione` e rendila dopo la sezione dei passaggi:

```tsx
<Riconciliazione
  esito={esito}
  totaleComputo={computo!.totale}
  numeroMaster={NUMERO_MASTER}
/>
```

- [ ] **Step 3: Verifica nel browser**

Ricarica la pagina, ricarica il PDF Dacroce.

Atteso: somma `278 787,93 €`, target `300 343,58 €`, delta `21 555,65 €`. Nella tabella
delle voci, `1` a `127 543,28 €` e Listino `300 343,58 €`. Gli sconti del 2% e 3% a
cascata danno `− 6 006,87 €` e `− 8 830,10 €`, parziale `285 506,61 €` — verifica che il
secondo sconto sia calcolato sul residuo e non sul listino (a cascata darebbe 8.830,10, in
modo additivo 9.010,31).

Ripeti con il computo Crivellaro: Listino `236 960,99 €`, pareti `100 645,84 €`, solaio
`compresa`.

Screenshot finale con `computer {action: "screenshot"}`.

- [ ] **Step 4: Esegui tutta la suite e il typecheck**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS, nessun errore, build completata.

- [ ] **Step 5: Commit**

```bash
git add src/app/preventivi/conteggi/ && git commit -m "feat: riconciliazione e tabella delle voci in interfaccia

Mostra somma, target e delta, poi la tabella nell'ordine del master con
le pareti gia' a pareggio e il blocco commerciale fino al parziale.

Gli sconti riusano applicaScontiACascata invece di riscrivere il
calcolo: sono a cascata, non additivi (vincolo #1), e sul Listino
Dacroce la differenza fra le due letture e' di 180,21 euro.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Copertura della spec.** Ogni sezione della spec ha un task: §1 Estrazione → Task 1-2;
§"Una tariffa può comparire più volte" → Task 3; §2 Le regole → Task 4-6, con
§"Arrotondamento" nel Task 4 (export) e verificato nel Task 5, e §"Righe a zero" nel
Task 4 (`zeroDiventaCompresa`); §3 Riconciliazione → Task 7; §4 Interfaccia → Task 8-10;
§5 Test → distribuito, con i golden case completi nel Task 7. Fuori perimetro resta fuori:
nessun task scrive su preventivi o revisioni.

**Caso limite della spec non coperto da un test.** La spec chiede un avviso bloccante per
`mq piana > 0 e mq falda = 0`, che nessuno dei due computi presenta. `voceUnica` con
`/FALDA/` già solleva se la riga a falda manca, il che copre il caso in modo più forte
(l'estrazione si ferma). Non aggiungo un avviso separato: sarebbe codice non raggiungibile
dalle fixture disponibili.

**Coerenza dei tipi.** `FrammentoTesto` (Task 1) è consumato da `estraiComputo` (Task 2).
`Computo`/`VoceComputo` (Task 2) da `accesso.ts` (Task 3) e da tutte le regole. `Passaggio`
usa `unita: 'mq' | 'nr' | 'eur'` in ogni regola, e `formatta.ts` (Task 8) gestisce i tre
casi. `VoceConteggiata.importo` è `number | 'compresa'` e ogni consumatore lo restringe con
`typeof === 'number'`. `arrotondaCentesimi` è esportata nel Task 4 prima del primo uso.
`NUMERO_MASTER` è definito nel Task 9 ed esportato per il Task 10. `RisultatoConteggio` e
`COSTI_SICUREZZA_FORFETTARI` sono prodotti dal Task 7 e consumati dal Task 10.

**Numeri verificati.** Gli importi degli sconti a cascata del Task 10 sono stati
ricalcolati: 2% su 300.343,58 dà 6.006,87, il 3% sul residuo di 294.336,71 dà 8.830,10,
parziale 285.506,61. In modo additivo il secondo sconto sarebbe 9.010,31, cioè 180,21 in
più: è la verifica che rende visibile il vincolo #1.

L'effetto della correzione manuale nel Task 9 è stato corretto in revisione: portando i
monoblocchi da 14.495 a 13.200 le pareti **salgono** a 128.838,28, non scendono. Il
pareggio assorbe la riduzione, quindi ciò che si toglie a una voce ricompare sulle pareti
— ed è il motivo per cui il delta di pareggio non è un numero da guardare da solo.
