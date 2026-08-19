# Interpolazione degli spessori nelle descrizioni voce — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere risolvibili i placeholder `{{spessoreEsterno}}` / `{{spessoreInterno}}` /
`{{spessoreCoibente}}` / `{{spessoreCappotto}}` nelle descrizioni voce, senza cambiare il
comportamento del guardrail export quando il dato resta assente.

**Architecture:** Una funzione di interpolazione pura in `src/domain/calcolo.ts` sostituisce
i token solo con valori non vuoti letti da un nuovo campo `spessori` su `InputCalcolo`,
alimentato da 4 nuovi campi testo libero nel wizard (`CaratteristicheCostruttive`). Un
secondo helper puro segmenta la descrizione per colorare in grigio, solo in anteprima, il
token eventualmente ancora residuo. Un avviso riusa il meccanismo esistente di
`verificaCoerenza` per segnalarlo nel banner già presente in `PannelloPreview`.

**Tech Stack:** TypeScript, Next.js/React, Vitest, Zod (schema estrazione AI).

## Global Constraints

- `app/domain/` (qui `src/domain/`) resta TypeScript puro: nessun import di React, Prisma o
  rete (CLAUDE.md).
- Un campo lasciato vuoto deve continuare a far scattare il guardrail export esistente con lo
  stesso errore di oggi — mai sostituire un placeholder vuoto con stringa vuota nel testo
  finale (spec, sezione 1).
- Gli spessori sono testo libero, non numeri: possono essere compositi (`60+40`,
  `205-160`, `160 (80+60+20)`) — spec, richiamo a
  `docs/superpowers/specs/2026-08-04-fbe-preventivatore-design.md:618`.
- Nessun valore di default plausibile precompilato per i 4 nuovi campi: default `''` (spec,
  sezione 2).
- Nessuna migrazione dati: le revisioni congelate esistenti (CLAUDE.md vincolo 6) restano
  apribili con gli stessi numeri — se prive dei nuovi campi, il comportamento è identico a
  oggi (export bloccato).
- L'AI non decide prezzi né dati tecnici invisibili all'operatore (CLAUDE.md vincolo 7): un
  eventuale spessore estratto dal testo libero resta sempre modificabile a mano nel wizard.
- Commit automatico a fine di ogni task completato e verificato (CLAUDE.md, sezione Workflow).

---

## Task 1: Sposta `rilevaPlaceholderSpessoreNonInterpolati` in `domain/calcolo.ts`

Puro trasloco: stessa logica, stesso regex, zero cambi di comportamento. Prepara il terreno
perché sia `export-docx.ts` sia il futuro avviso in `ai/coerenza.ts` (Task 7) leggano da
un'unica fonte di verità in dominio, senza dipendenze incrociate `ai/` ↔ `documento/`.

**Files:**
- Modify: `src/domain/calcolo.ts`
- Modify: `src/documento/export-docx.ts`
- Modify: `src/documento/export-docx.test.ts`

**Interfaces:**
- Produces: `rilevaPlaceholderSpessoreNonInterpolati(voci: VoceValorizzata[]): string[]`,
  esportata da `@/domain/calcolo`.

- [ ] **Step 1: Aggiungi la funzione a `src/domain/calcolo.ts`**

Apri `src/domain/calcolo.ts`. Dopo l'interfaccia `RisultatoCalcolo` (che chiude con `}` subito
prima di `function sommaNumerica`), inserisci:

```typescript
const PATTERN_PLACEHOLDER_DOPPIA_GRAFFA = /\{\{[^{}]+\}\}/g

/**
 * Cerca, nelle descrizioni delle voci di catalogo, placeholder a doppia graffa (es.
 * `{{spessoreEsterno}}`) che nessun meccanismo del progetto interpola oggi — non tag
 * docxtemplater (quelli sono a graffa singola), ma testo letterale rimasto nel dato di
 * dominio. Esportata anche per il test: la review di Task 17 chiede che l'insieme esatto dei
 * token rilevati sia verificato, così una correzione parziale in futuro fa fallire un test
 * invece di passare inosservata.
 */
export function rilevaPlaceholderSpessoreNonInterpolati(voci: VoceValorizzata[]): string[] {
  const trovati: string[] = []
  for (const v of voci) {
    const match = v.descrizione.match(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA)
    if (match) trovati.push(...match)
  }
  return trovati
}
```

- [ ] **Step 2: Rimuovi la funzione duplicata da `src/documento/export-docx.ts`**

Rimuovi da `export-docx.ts` queste righe (oggi subito prima di `costruisciBufferOfferta`):

```typescript
const PATTERN_PLACEHOLDER_DOPPIA_GRAFFA = /\{\{[^{}]+\}\}/g

/**
 * Cerca, nelle descrizioni delle voci di catalogo, placeholder a doppia graffa (es.
 * `{{spessoreEsterno}}`) che nessun meccanismo del progetto interpola oggi — non tag
 * docxtemplater (quelli sono a graffa singola), ma testo letterale rimasto nel dato di
 * dominio. Esportata anche per il test: la review di Task 17 chiede che l'insieme esatto dei
 * token rilevati sia verificato, così una correzione parziale in futuro fa fallire un test
 * invece di passare inosservata.
 */
export function rilevaPlaceholderSpessoreNonInterpolati(voci: VoceValorizzata[]): string[] {
  const trovati: string[] = []
  for (const v of voci) {
    const match = v.descrizione.match(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA)
    if (match) trovati.push(...match)
  }
  return trovati
}
```

Sostituisci la riga di import in testa al file:

```typescript
import type { RisultatoCalcolo, VoceValorizzata } from '@/domain/calcolo'
```

con:

```typescript
import { rilevaPlaceholderSpessoreNonInterpolati, type RisultatoCalcolo, type VoceValorizzata } from '@/domain/calcolo'
```

- [ ] **Step 3: Aggiorna l'import nel test**

In `src/documento/export-docx.test.ts`, la riga:

```typescript
import { esportaOfferta, rilevaPlaceholderSpessoreNonInterpolati, type InputEsportazione } from './export-docx'
```

diventa due righe:

```typescript
import { esportaOfferta, type InputEsportazione } from './export-docx'
import { rilevaPlaceholderSpessoreNonInterpolati } from '@/domain/calcolo'
```

- [ ] **Step 4: Esegui i test e verifica che passino invariati**

Run: `npm test -- export-docx.test.ts`
Expected: PASS, stessi test di prima (nessun nuovo test in questo step — è un puro trasloco).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/domain/calcolo.ts src/documento/export-docx.ts src/documento/export-docx.test.ts
git commit -m "refactor(documento): sposta rilevaPlaceholderSpessoreNonInterpolati in domain/calcolo

Nessun cambio di comportamento: prepara un'unica fonte di verità in
dominio per il guardrail export e il futuro avviso UI."
```

---

## Task 2: Aggiungi `interpolaPlaceholder` e `segmentaPlaceholder` a `domain/calcolo.ts`

Due funzioni pure, sorelle: la prima sostituisce i token con valori reali (usata da
`eseguiCalcolo`, Task 3); la seconda spezza la stringa in segmenti testo/placeholder (usata
dalla preview, Task 8). Condividono lo stesso regex introdotto al Task 1.

**Files:**
- Modify: `src/domain/calcolo.ts`
- Modify: `src/domain/calcolo.test.ts`

**Interfaces:**
- Consumes: `PATTERN_PLACEHOLDER_DOPPIA_GRAFFA` (Task 1, stesso file).
- Produces: `interpolaPlaceholder(template: string, valori: Record<string, string> | undefined): string`;
  `interface SegmentoDescrizione { testo: string; placeholder: boolean }`;
  `segmentaPlaceholder(descrizione: string): SegmentoDescrizione[]` — entrambe esportate da
  `@/domain/calcolo`.

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/domain/calcolo.test.ts`, aggiungi in fondo al file:

```typescript
describe('interpolaPlaceholder', () => {
  it('sostituisce un token con il valore corrispondente', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', { spessoreEsterno: '205' })).toBe('sp. mm 205')
  })

  it('lascia intatto un token il cui valore è assente', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', {})).toBe('sp. mm {{spessoreEsterno}}')
  })

  it('lascia intatto un token il cui valore è una stringa vuota o solo spazi', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', { spessoreEsterno: '   ' })).toBe('sp. mm {{spessoreEsterno}}')
  })

  it('lascia intatto ogni token quando valori è undefined', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', undefined)).toBe('sp. mm {{spessoreEsterno}}')
  })

  it('sostituisce più token distinti nella stessa stringa', () => {
    const risultato = interpolaPlaceholder('esterne sp. mm {{spessoreEsterno}} ed interne sp. mm {{spessoreInterno}}', {
      spessoreEsterno: '205',
      spessoreInterno: '160',
    })
    expect(risultato).toBe('esterne sp. mm 205 ed interne sp. mm 160')
  })

  it('accetta un valore composito, senza interpretarlo', () => {
    expect(interpolaPlaceholder('sp. mm {{spessoreEsterno}}', { spessoreEsterno: '205-160' })).toBe('sp. mm 205-160')
  })

  it('non tocca una stringa senza placeholder', () => {
    expect(interpolaPlaceholder('Trave alla base in larice', { spessoreEsterno: '205' })).toBe('Trave alla base in larice')
  })
})

describe('segmentaPlaceholder', () => {
  it('produce un solo segmento non-placeholder per una stringa senza token', () => {
    expect(segmentaPlaceholder('Trave alla base in larice')).toEqual([
      { testo: 'Trave alla base in larice', placeholder: false },
    ])
  })

  it('separa testo e placeholder preservando ordine e contenuto', () => {
    const segmenti = segmentaPlaceholder('sp. mm {{spessoreEsterno}} fine')
    expect(segmenti).toEqual([
      { testo: 'sp. mm ', placeholder: false },
      { testo: '{{spessoreEsterno}}', placeholder: true },
      { testo: ' fine', placeholder: false },
    ])
  })

  it('gestisce più placeholder nella stessa stringa', () => {
    const segmenti = segmentaPlaceholder('esterne sp. mm {{spessoreEsterno}} ed interne sp. mm {{spessoreInterno}}')
    expect(segmenti.filter((s) => s.placeholder).map((s) => s.testo)).toEqual([
      '{{spessoreEsterno}}',
      '{{spessoreInterno}}',
    ])
  })

  it('non produce un segmento vuoto finale quando la stringa termina con un placeholder', () => {
    const segmenti = segmentaPlaceholder('sp. mm {{spessoreEsterno}}')
    expect(segmenti).toEqual([
      { testo: 'sp. mm ', placeholder: false },
      { testo: '{{spessoreEsterno}}', placeholder: true },
    ])
  })
})
```

Aggiungi i due nomi all'import esistente in testa al file (quello da `'./calcolo'` che importa
già `applicaScontiACascata` ecc.):

```typescript
import {
  applicaScontiACascata,
  calcolaParziale,
  risolviArrotondamento,
  sogliaArrotondamentoSuperata,
  interpolaPlaceholder,
  segmentaPlaceholder,
  type ParametriSconto,
} from './calcolo'
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- calcolo.test.ts`
Expected: FAIL con `interpolaPlaceholder is not defined` / `segmentaPlaceholder is not defined`.

- [ ] **Step 3: Implementa le due funzioni**

In `src/domain/calcolo.ts`, subito dopo `rilevaPlaceholderSpessoreNonInterpolati` (Task 1),
aggiungi:

```typescript
/**
 * Sostituisce ogni `{{chiave}}` presente nel template con `valori[chiave]`, solo se il
 * valore esiste e non è vuoto (dopo trim). Un campo lasciato in bianco nel wizard deve
 * continuare a far scattare `rilevaPlaceholderSpessoreNonInterpolati` più a valle — quindi
 * qui il token va lasciato intatto, non sostituito con una stringa vuota che produrrebbe una
 * descrizione senza numero ma senza più nessun `{{...}}` da rilevare.
 */
export function interpolaPlaceholder(template: string, valori: Record<string, string> | undefined): string {
  if (!valori) return template
  return template.replace(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA, (token) => {
    const chiave = token.slice(2, -2)
    const valore = valori[chiave]
    return valore && valore.trim() !== '' ? valore : token
  })
}

export interface SegmentoDescrizione {
  testo: string
  placeholder: boolean
}

/**
 * Spezza una descrizione voce in segmenti di testo normale e segmenti-placeholder, nello
 * stesso ordine del testo originale — usato dalla preview per colorare in grigio solo il
 * token residuo (src/documento/preview/DescrizioneVoce.tsx), senza toccare il resto della
 * frase.
 */
export function segmentaPlaceholder(descrizione: string): SegmentoDescrizione[] {
  const segmenti: SegmentoDescrizione[] = []
  let ultimoIndice = 0
  for (const match of descrizione.matchAll(PATTERN_PLACEHOLDER_DOPPIA_GRAFFA)) {
    const indice = match.index ?? 0
    if (indice > ultimoIndice) segmenti.push({ testo: descrizione.slice(ultimoIndice, indice), placeholder: false })
    segmenti.push({ testo: match[0], placeholder: true })
    ultimoIndice = indice + match[0].length
  }
  if (ultimoIndice < descrizione.length || segmenti.length === 0) {
    segmenti.push({ testo: descrizione.slice(ultimoIndice), placeholder: false })
  }
  return segmenti
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- calcolo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/calcolo.ts src/domain/calcolo.test.ts
git commit -m "feat(domain): aggiungi interpolaPlaceholder e segmentaPlaceholder

Due helper puri: il primo sostituisce {{chiave}} solo con valori non
vuoti (lascia intatto il resto per non silenziare il guardrail export);
il secondo spezza la descrizione in segmenti testo/placeholder per la
preview."
```

---

## Task 3: Collega `spessori` a `InputCalcolo` e `eseguiCalcolo`

**Files:**
- Modify: `src/domain/calcolo.ts`
- Modify: `src/domain/calcolo.test.ts`

**Interfaces:**
- Consumes: `interpolaPlaceholder` (Task 2, stesso file).
- Produces: `InputCalcolo.spessori?: Record<string, string>` — letto da `eseguiCalcolo` per
  interpolare `descrizione`; consumato da `stato-form.ts` (Task 5).

- [ ] **Step 1: Scrivi il test che fallisce**

In `src/domain/calcolo.test.ts`, dentro `describe('eseguiCalcolo — golden case Crivellaro end-to-end', ...)`,
aggiungi due nuovi `it` (dopo l'ultimo esistente, prima della chiusura `})`):

```typescript
  it('interpola i placeholder di spessore quando input.spessori è fornito', () => {
    const risultato = eseguiCalcolo({
      ...input,
      spessori: { spessoreEsterno: '205', spessoreInterno: '160', spessoreCoibente: '200', spessoreCappotto: '140' },
    })
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    const cappotto = risultato.vociValorizzate.find((v) => v.id === 'cappotto')!
    expect(pareti.descrizione).toContain('sp. mm 205')
    expect(pareti.descrizione).toContain('sp. mm 160')
    expect(pareti.descrizione).not.toContain('{{')
    expect(cappotto.descrizione).toContain('sp. mm 140')
  })

  it('senza input.spessori, lascia i placeholder di spessore intatti (comportamento invariato)', () => {
    const risultato = eseguiCalcolo(input)
    const pareti = risultato.vociValorizzate.find((v) => v.id === 'pareti-mhm')!
    expect(pareti.descrizione).toContain('{{spessoreEsterno}}')
    expect(pareti.descrizione).toContain('{{spessoreInterno}}')
  })
```

- [ ] **Step 2: Esegui i test e verifica che il primo fallisca**

Run: `npm test -- calcolo.test.ts`
Expected: il secondo `it` passa già oggi; il primo FAIL (`pareti.descrizione` contiene ancora
`{{spessoreEsterno}}` invece di `205`).

- [ ] **Step 3: Aggiungi il campo a `InputCalcolo` e usalo in `eseguiCalcolo`**

In `src/domain/calcolo.ts`, nell'interfaccia `InputCalcolo`:

```typescript
export interface InputCalcolo {
  catalogo: VoceCatalogo[]
  configurazione: ConfigurazioneVoci
  listino: ListinoAnno
  geometria: InputGeometricoListino
  overrides: Record<string, number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'>
  sconti: ParametriSconto[]
  sicurezza: Sicurezza
  arrotondamento: number | { risolviPerTotale: number }
  // Valori per interpolare i placeholder {{chiave}} nelle descrizioni voce (src/domain/voci.ts,
  // id pareti-mhm/copertura-falda/cappotto). Assente o senza una chiave = quel token resta
  // {{...}} nella descrizione finale, e il guardrail export lo blocca — vedi interpolaPlaceholder.
  spessori?: Record<string, string>
}
```

Poi, dentro `eseguiCalcolo`, sostituisci le tre occorrenze di `descrizione: voce.descrizioneTemplate,`
con `descrizione: interpolaPlaceholder(voce.descrizioneTemplate, input.spessori),`. Sono nei tre
rami: quello con `override !== undefined`, quello con `voce.importoTestualeDefault`, e quello
finale con il `driver`.

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- calcolo.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check e intera suite**

Run: `npx tsc --noEmit && npm test`
Expected: nessun errore. Nota: `src/documento/costruisci-input-esportazione.test.ts` e
`src/app/preventivi/nuovo/stato-form.test.ts` NON si toccano in questo task e continuano a
passare, perché `spessori` è opzionale.

- [ ] **Step 6: Commit**

```bash
git add src/domain/calcolo.ts src/domain/calcolo.test.ts
git commit -m "feat(domain): interpola i placeholder di spessore in eseguiCalcolo

InputCalcolo.spessori è opzionale: senza di esso il comportamento è
identico a oggi (placeholder intatto, guardrail export invariato)."
```

---

## Task 4: Verifica end-to-end che l'export riesca con gli spessori compilati

**Files:**
- Modify: `src/documento/export-docx.test.ts`

**Interfaces:**
- Consumes: `eseguiCalcolo`, `InputCalcolo.spessori` (Task 3); `esportaOfferta` (esistente).

- [ ] **Step 1: Scrivi il test che fallisce**

In `src/documento/export-docx.test.ts`, dopo la funzione `costruisciInputEsportazione` esistente
(prima di `percorsoOutputTemporaneo`), aggiungi:

```typescript
// Stesso golden case Crivellaro, ma con gli spessori compilati: l'export deve riuscire senza
// il residuo di sviluppo e SENZA il ricorso a `consentiPlaceholderNonRisolti` (Task 3/4 del
// fix ai placeholder di spessore non interpolati).
function costruisciInputEsportazioneConSpessoriCompilati(percorsoOutput: string): InputEsportazione {
  const risultatoConSpessori = eseguiCalcolo({
    ...INPUT_CRIVELLARO,
    spessori: { spessoreEsterno: '205', spessoreInterno: '160', spessoreCoibente: '200', spessoreCappotto: '140' },
  })
  return {
    ...costruisciInputEsportazione(percorsoOutput),
    risultato: risultatoConSpessori,
    consentiPlaceholderNonRisolti: undefined,
  }
}
```

Poi aggiungi, dopo il `describe('esportaOfferta — placeholder di spessore non interpolati ...')`
esistente:

```typescript
describe('esportaOfferta — spessori compilati (fix follow-up ai placeholder)', () => {
  it('esporta senza errore e senza consentiPlaceholderNonRisolti quando tutti gli spessori sono forniti', () => {
    const percorsoOutput = percorsoOutputTemporaneo()
    const input = costruisciInputEsportazioneConSpessoriCompilati(percorsoOutput)

    try {
      expect(() => esportaOfferta(input)).not.toThrow()

      const documentoXml = new PizZip(fs.readFileSync(percorsoOutput)).file('word/document.xml')!.asText()
      expect(documentoXml).toContain('sp. mm 205')
      expect(documentoXml).toContain('sp. mm 140')
      expect(documentoXml).not.toContain('{{spessoreEsterno}}')
      expect(documentoXml).not.toContain('{{spessoreInterno}}')
      expect(documentoXml).not.toContain('{{spessoreCoibente}}')
      expect(documentoXml).not.toContain('{{spessoreCappotto}}')
    } finally {
      fs.rmSync(percorsoOutput, { force: true })
    }
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- export-docx.test.ts`
Expected: se Task 3 è già stato completato, questo test in realtà PASSA già — è un test di
non-regressione end-to-end, non TDD in senso stretto. Verificalo comunque eseguendolo: se
fallisse, indicherebbe un problema in come `risultato` viene rimpiazzato nel test stesso (es.
`costruisciInputEsportazione` non più coerente), non nel codice di produzione.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore (`consentiPlaceholderNonRisolti: undefined` è assegnabile al campo
opzionale `boolean | undefined`).

- [ ] **Step 4: Commit**

```bash
git add src/documento/export-docx.test.ts
git commit -m "test(documento): verifica l'export end-to-end con gli spessori compilati

Nessun placeholder residuo nel .docx e nessun bisogno di
consentiPlaceholderNonRisolti quando i 4 spessori sono forniti."
```

---

## Task 5: Nuovi campi spessore nel wizard (`stato-form.ts`)

**Files:**
- Modify: `src/app/preventivi/nuovo/stato-form.ts`
- Modify: `src/app/preventivi/nuovo/stato-form.test.ts`
- Modify: `src/documento/costruisci-input-esportazione.test.ts`
- Modify: `src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts`

**Interfaces:**
- Consumes: `InputCalcolo.spessori` (Task 3).
- Produces: `CaratteristicheCostruttive.spessoreEsterno/Interno/Coibente/Cappotto: string`;
  `CARATTERISTICHE_DEFAULT` con i 4 campi a `''`; `inputCalcoloDaStato` popola
  `InputCalcolo.spessori` — consumato da `StepConfigurazione.tsx` (Task 6) e
  `mappatura-estrazione.ts` (Task 9).

- [ ] **Step 1: Scrivi il test che fallisce**

In `src/app/preventivi/nuovo/stato-form.test.ts`, aggiungi ai campi di `STATO_CRIVELLARO.caratteristiche`
(vedi Step 3 sotto per il motivo) e poi aggiungi, dentro `describe('inputCalcoloDaStato', ...)`,
un nuovo `it`:

```typescript
  it('mappa gli spessori delle caratteristiche in input.spessori', () => {
    const input = inputCalcoloDaStato({
      ...STATO_CRIVELLARO,
      caratteristiche: { ...STATO_CRIVELLARO.caratteristiche, spessoreEsterno: '205', spessoreCappotto: '140' },
    })
    expect(input.spessori).toEqual({
      spessoreEsterno: '205',
      spessoreInterno: '',
      spessoreCoibente: '',
      spessoreCappotto: '140',
    })
  })
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- stato-form.test.ts`
Expected: FAIL — a questo punto anche solo il fixture `STATO_CRIVELLARO` non compila ancora
(i 4 campi non esistono su `CaratteristicheCostruttive`); procedi comunque al passo successivo.

- [ ] **Step 3: Aggiungi i 4 campi a `CaratteristicheCostruttive` e ai default**

In `src/app/preventivi/nuovo/stato-form.ts`:

```typescript
export interface CaratteristicheCostruttive {
  // 'piano' è solo descrittivo in questo giro: nel catalogo (src/domain/voci.ts) non esiste
  // nessuna voce alternativa a copertura-falda (niente tetto-piano/veletta-copertura-piana) —
  // selezionare 'piano' NON cambia i prezzi.
  copertura: 'falde' | 'piano'
  manto: string
  finituraEsterna: 'intonaco' | 'rivestimento'
  tetto: string
  // Spessori delle stratigrafie citati nelle descrizioni voce (src/domain/voci.ts, id
  // pareti-mhm/copertura-falda/cappotto). Stringa libera, non un numero: nei documenti reali
  // sono spesso compositi ("60+40", "205-160", "160 (80+60+20)" — spec §9.3 del design
  // principale). Vuoto di default: eseguiCalcolo lascia il placeholder {{...}} intatto finché
  // non sono compilati, e il guardrail export blocca finché resta un placeholder residuo.
  spessoreEsterno: string
  spessoreInterno: string
  spessoreCoibente: string
  spessoreCappotto: string
}
```

```typescript
export const CARATTERISTICHE_DEFAULT: CaratteristicheCostruttive = {
  copertura: 'falde',
  manto: 'Tegole in cemento',
  finituraEsterna: 'intonaco',
  tetto: 'Tetto con travi e perline in abete',
  spessoreEsterno: '',
  spessoreInterno: '',
  spessoreCoibente: '',
  spessoreCappotto: '',
}
```

In `inputCalcoloDaStato`, aggiungi il campo `spessori` all'oggetto `InputCalcolo` restituito
(dopo `arrotondamento: { risolviPerTotale: stato.totaleTarget },`):

```typescript
    spessori: {
      spessoreEsterno: stato.caratteristiche.spessoreEsterno,
      spessoreInterno: stato.caratteristiche.spessoreInterno,
      spessoreCoibente: stato.caratteristiche.spessoreCoibente,
      spessoreCappotto: stato.caratteristiche.spessoreCappotto,
    },
```

- [ ] **Step 4: Aggiorna i 3 fixture che costruiscono `CaratteristicheCostruttive` per intero**

In tutti e tre questi file, il blocco letterale

```typescript
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
  },
```

diventa:

```typescript
  caratteristiche: {
    copertura: 'falde',
    manto: 'Tegole in cemento',
    finituraEsterna: 'intonaco',
    tetto: 'Tetto con travi e perline in abete',
    spessoreEsterno: '',
    spessoreInterno: '',
    spessoreCoibente: '',
    spessoreCappotto: '',
  },
```

nei file:
- `src/app/preventivi/nuovo/stato-form.test.ts` (fixture `STATO_CRIVELLARO`)
- `src/documento/costruisci-input-esportazione.test.ts` (fixture `STATO_CRIVELLARO`)
- `src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts` (fixture
  `STATO_SENZA_PLACEHOLDER`)

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npm test -- stato-form.test.ts costruisci-input-esportazione.test.ts route.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check e intera suite**

Run: `npx tsc --noEmit && npm test`
Expected: nessun errore.

- [ ] **Step 7: Commit**

```bash
git add src/app/preventivi/nuovo/stato-form.ts src/app/preventivi/nuovo/stato-form.test.ts \
  src/documento/costruisci-input-esportazione.test.ts \
  "src/app/api/preventivi/[id]/revisioni/[numero]/export/route.test.ts"
git commit -m "feat(wizard): aggiungi i 4 campi spessore a CaratteristicheCostruttive

Testo libero, default vuoto (nessun valore plausibile precompilato).
inputCalcoloDaStato li mappa in InputCalcolo.spessori."
```

---

## Task 6: Nuovi campi nello step Configurazione del wizard

**Files:**
- Modify: `src/app/preventivi/nuovo/steps/StepConfigurazione.tsx`

**Interfaces:**
- Consumes: `stato.caratteristiche.spessoreEsterno/Interno/Coibente/Cappotto` (Task 5).

Nessun file di test: gli altri componenti `Step*.tsx` del wizard non hanno test unitari nel
progetto (solo `.test.ts`, mai `.test.tsx` per questi); la verifica è type-check + smoke test
manuale nel browser (Task 10).

- [ ] **Step 1: Aggiungi i 4 campi al form**

In `src/app/preventivi/nuovo/steps/StepConfigurazione.tsx`, dentro il `<div className="grid grid-cols-2 gap-x-4">`
esistente, dopo il `<Field label="Tetto (descrizione)">...</Field>`, aggiungi:

```tsx
        <Field label="Spessore pareti esterne (mm)">
          <input
            className={controlClassName}
            value={stato.caratteristiche.spessoreEsterno}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, spessoreEsterno: e.target.value } })}
            placeholder="es. 205 o 60+40"
          />
        </Field>
        <Field label="Spessore pareti interne (mm)">
          <input
            className={controlClassName}
            value={stato.caratteristiche.spessoreInterno}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, spessoreInterno: e.target.value } })}
            placeholder="es. 160"
          />
        </Field>
        <Field label="Spessore coibente falda (mm)">
          <input
            className={controlClassName}
            value={stato.caratteristiche.spessoreCoibente}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, spessoreCoibente: e.target.value } })}
            placeholder="es. 200"
          />
        </Field>
        <Field label="Spessore cappotto (mm)">
          <input
            className={controlClassName}
            value={stato.caratteristiche.spessoreCappotto}
            onChange={(e) => aggiorna({ caratteristiche: { ...stato.caratteristiche, spessoreCappotto: e.target.value } })}
            placeholder="es. 140"
          />
        </Field>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/app/preventivi/nuovo/steps/StepConfigurazione.tsx
git commit -m "feat(wizard): aggiungi i campi spessore allo step Configurazione

Stesso pattern UI di Manto/Tetto: testo libero con placeholder
d'esempio che segnala il formato composito accettato."
```

---

## Task 7: Avviso `spessore-non-interpolato` in `verificaCoerenza`

**Files:**
- Modify: `src/ai/coerenza.ts`
- Modify: `src/ai/coerenza.test.ts`

**Interfaces:**
- Consumes: `rilevaPlaceholderSpessoreNonInterpolati` (Task 1, `@/domain/calcolo`).
- Produces: nuovo valore `'spessore-non-interpolato'` nell'union `Avviso['tipo']`.

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/ai/coerenza.test.ts`, aggiungi in fondo al file:

```typescript
describe('verificaCoerenza — spessori non interpolati', () => {
  it('segnala i placeholder di spessore residui nelle descrizioni voce', () => {
    const risultato = eseguiCalcolo(INPUT_BASE) // nessun `spessori`: pareti-mhm/copertura-falda/cappotto restano con {{...}}
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })

    const avviso = avvisi.find((a) => a.tipo === 'spessore-non-interpolato')
    expect(avviso).toBeDefined()
    expect(avviso!.messaggio).toContain('{{spessoreEsterno}}')
    expect(avviso!.messaggio).toContain('{{spessoreCappotto}}')
  })

  it('non segnala nulla quando tutti gli spessori sono compilati', () => {
    const risultato = eseguiCalcolo({
      ...INPUT_BASE,
      spessori: { spessoreEsterno: '205', spessoreInterno: '160', spessoreCoibente: '200', spessoreCappotto: '140' },
    })
    const avvisi = verificaCoerenza({
      superfici: SUPERFICI_COERENTI,
      totaleLordoDichiarato: 161,
      risultato,
      protocolloPlaceholderPresente: false,
      sezioniDaDefinire: [],
      riferimentiTestuali: [],
    })

    expect(avvisi.find((a) => a.tipo === 'spessore-non-interpolato')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- coerenza.test.ts`
Expected: FAIL (`avviso` è `undefined` nel primo test — il tipo non esiste ancora).

- [ ] **Step 3: Implementa l'avviso**

In `src/ai/coerenza.ts`, aggiorna l'import:

```typescript
import { sogliaArrotondamentoSuperata, rilevaPlaceholderSpessoreNonInterpolati, type RisultatoCalcolo } from '@/domain/calcolo'
```

Aggiungi il nuovo tipo all'union `Avviso['tipo']`:

```typescript
export interface Avviso {
  tipo:
    | 'superfici-incoerenti'
    | 'placeholder-non-sostituito'
    | 'sezione-da-definire'
    | 'arrotondamento-eccessivo'
    | 'riferimento-voce-inesistente'
    | 'spessore-non-interpolato'
  messaggio: string
}
```

Dentro `verificaCoerenza`, dopo il blocco `if (input.protocolloPlaceholderPresente) { ... }`,
aggiungi:

```typescript
  const placeholderSpessore = rilevaPlaceholderSpessoreNonInterpolati(input.risultato.vociValorizzate)
  if (placeholderSpessore.length > 0) {
    avvisi.push({
      tipo: 'spessore-non-interpolato',
      messaggio: `Spessori non compilati nelle descrizioni: ${[...new Set(placeholderSpessore)].join(', ')} — completa Configurazione prima di esportare`,
    })
  }
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- coerenza.test.ts`
Expected: PASS.

- [ ] **Step 5: Intera suite e type-check**

Run: `npx tsc --noEmit && npm test`
Expected: nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/ai/coerenza.ts src/ai/coerenza.test.ts
git commit -m "feat(ai): segnala i placeholder di spessore residui come avviso di coerenza

Riusa rilevaPlaceholderSpessoreNonInterpolati: l'avviso compare solo
per le voci realmente incluse nel preventivo (gating già gestito da
vociIncluse dentro eseguiCalcolo)."
```

---

## Task 8: Evidenziazione grigia del placeholder residuo in anteprima

**Files:**
- Create: `src/documento/preview/DescrizioneVoce.tsx`
- Create: `src/documento/preview/DescrizioneVoce.test.tsx`
- Modify: `src/documento/preview/PaginaPrezzi.tsx`
- Modify: `src/documento/preview/print.css`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `segmentaPlaceholder` (Task 2, `@/domain/calcolo`).
- Produces: `DescrizioneVoce({ descrizione: string })` — componente React, consumato da
  `PaginaPrezzi.tsx`.

- [ ] **Step 1: Abilita i test `.tsx` in Vitest**

`vitest.config.ts` oggi include solo `src/**/*.test.ts`. Questo è il primo componente React
del progetto con un test dedicato, quindi va incluso anche `.tsx`. Modifica:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 2: Scrivi il test che fallisce**

Crea `src/documento/preview/DescrizioneVoce.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DescrizioneVoce } from './DescrizioneVoce'

describe('DescrizioneVoce', () => {
  it('renderizza testo semplice senza alcuna classe quando non ci sono placeholder', () => {
    const html = renderToStaticMarkup(<DescrizioneVoce descrizione="Trave alla base in larice" />)
    expect(html).toContain('Trave alla base in larice')
    expect(html).not.toContain('placeholder-non-interpolato')
  })

  it('applica la classe placeholder-non-interpolato solo al token residuo', () => {
    const html = renderToStaticMarkup(
      <DescrizioneVoce descrizione="Cappotto esterno in fibra di legno sp. mm {{spessoreCappotto}} finito con rasante ed intonaco" />,
    )
    expect(html).toContain('<span>Cappotto esterno in fibra di legno sp. mm </span>')
    expect(html).toContain('<span class="placeholder-non-interpolato">{{spessoreCappotto}}</span>')
    expect(html).toContain('<span> finito con rasante ed intonaco</span>')
  })
})
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `npm test -- DescrizioneVoce.test.tsx`
Expected: FAIL — il modulo `./DescrizioneVoce` non esiste ancora.

- [ ] **Step 4: Crea il componente**

Crea `src/documento/preview/DescrizioneVoce.tsx`:

```tsx
import { segmentaPlaceholder } from '@/domain/calcolo'

interface Props {
  descrizione: string
}

export function DescrizioneVoce({ descrizione }: Props) {
  return (
    <>
      {segmentaPlaceholder(descrizione).map((segmento, indice) =>
        segmento.placeholder ? (
          <span key={indice} className="placeholder-non-interpolato">
            {segmento.testo}
          </span>
        ) : (
          <span key={indice}>{segmento.testo}</span>
        ),
      )}
    </>
  )
}
```

- [ ] **Step 5: Esegui il test e verifica che passi**

Run: `npm test -- DescrizioneVoce.test.tsx`
Expected: PASS.

- [ ] **Step 6: Collega il componente in `PaginaPrezzi.tsx`**

In `src/documento/preview/PaginaPrezzi.tsx`, aggiungi l'import:

```typescript
import { DescrizioneVoce } from './DescrizioneVoce'
```

e sostituisci entrambe le occorrenze di `<td>{v.descrizione}</td>` (voci grezzo e voci
post-sconto) con:

```tsx
<td><DescrizioneVoce descrizione={v.descrizione} /></td>
```

- [ ] **Step 7: Aggiungi la regola CSS**

In `src/documento/preview/print.css`, aggiungi:

```css
.pagina-a4 .placeholder-non-interpolato {
  color: #9a9a9a;
}
```

- [ ] **Step 8: Esegui l'intera suite e il type-check**

Run: `npx tsc --noEmit && npm test`
Expected: nessun errore, tutti i test passano (inclusi quelli esistenti su `PaginaPrezzi`, se
presenti — verificane l'assenza o la tenuta).

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts src/documento/preview/DescrizioneVoce.tsx \
  src/documento/preview/DescrizioneVoce.test.tsx src/documento/preview/PaginaPrezzi.tsx \
  src/documento/preview/print.css
git commit -m "feat(preview): colora in grigio il placeholder di spessore residuo

DescrizioneVoce spezza la descrizione con segmentaPlaceholder e applica
.placeholder-non-interpolato solo al token {{...}}, distinguendolo dal
testo caricato dall'utente. Solo in anteprima: nel .docx esportato il
caso non si presenta mai (guardrail export)."
```

---

## Task 9: Estrazione AI opzionale degli spessori dalla frase iniziale

**Files:**
- Modify: `src/ai/estrazione.ts`
- Modify: `src/ai/estrazione.test.ts`
- Modify: `src/app/preventivi/nuovo/mappatura-estrazione.ts`
- Modify: `src/app/preventivi/nuovo/mappatura-estrazione.test.ts`

**Interfaces:**
- Consumes: `CARATTERISTICHE_DEFAULT` (Task 5).
- Produces: `CampiEstratti.spessoreEsterno/Interno/Coibente/Cappotto?: string`.

- [ ] **Step 1: Scrivi il test che fallisce (schema)**

In `src/ai/estrazione.test.ts`, dentro `describe('estraiCampi', ...)`, aggiungi:

```typescript
  it('accetta gli spessori come testo libero, anche composito', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Rossi' },
      superfici: [],
      spessoreEsterno: '205-160',
      spessoreInterno: '160',
      spessoreCoibente: '200',
      spessoreCappotto: '60+40',
      campiMancanti: [],
    })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.spessoreEsterno).toBe('205-160')
    expect(campi.spessoreInterno).toBe('160')
    expect(campi.spessoreCoibente).toBe('200')
    expect(campi.spessoreCappotto).toBe('60+40')
  })
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- estrazione.test.ts`
Expected: FAIL (`campi.spessoreEsterno` è `undefined`, lo schema Zod scarta il campo non
dichiarato solo se `.optional()` non esiste — qui in realtà lo schema Zod di base ignora le
chiavi sconosciute per default, quindi il test fallisce sul valore mancante `toBe('205-160')`
che riceve `undefined`).

- [ ] **Step 3: Aggiungi i campi allo schema e al prompt**

In `src/ai/estrazione.ts`, aggiorna `SchemaCampiEstratti`:

```typescript
const SchemaCampiEstratti = z.object({
  cliente: z.object({
    nome: z.string(),
    comune: z.string().optional(),
    provincia: z.string().optional(),
  }),
  protocollo: z.string().optional(),
  progettista: z.string().optional(),
  luogo: z.string().optional(),
  superfici: z.array(z.object({ piano: z.string(), valoreLordo: z.string() })).default([]),
  tipoCopertura: z.enum(['piano', 'falde']).optional(),
  finituraEsterna: z.enum(['intonaco', 'rivestimento']).optional(),
  pacchetto: z.enum(['grezzo', 'grezzo avanzato', 'chiavi in mano']).optional(),
  spessoreEsterno: z.string().optional(),
  spessoreInterno: z.string().optional(),
  spessoreCoibente: z.string().optional(),
  spessoreCappotto: z.string().optional(),
  campiMancanti: z.array(z.string()).default([]),
})
```

Aggiorna `PROMPT_SISTEMA` (il blocco JSON di forma attesa e le istruzioni): sostituisci

```
  "pacchetto"?: "grezzo" | "grezzo avanzato" | "chiavi in mano",
  "campiMancanti": string[]
}
```

con

```
  "pacchetto"?: "grezzo" | "grezzo avanzato" | "chiavi in mano",
  "spessoreEsterno"?: string,
  "spessoreInterno"?: string,
  "spessoreCoibente"?: string,
  "spessoreCappotto"?: string,
  "campiMancanti": string[]
}
```

e aggiungi, dopo la riga sugli esempi di normalizzazione dei piani, un nuovo paragrafo:

```
Gli spessori (spessoreEsterno, spessoreInterno, spessoreCoibente, spessoreCappotto) sono
testo libero in millimetri, anche composito (es. "60+40", "205-160"): riportali esattamente
come scritti dal cliente, senza normalizzarli né inventarli.
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- estrazione.test.ts`
Expected: PASS.

- [ ] **Step 5: Scrivi i test che falliscono (mappatura)**

In `src/app/preventivi/nuovo/mappatura-estrazione.test.ts`, aggiungi in fondo al `describe`:

```typescript
  it('mappa gli spessori estratti quando presenti', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi' },
      superfici: [],
      spessoreEsterno: '205-160',
      spessoreCappotto: '60+40',
      campiMancanti: [],
    }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.caratteristiche).toMatchObject({ spessoreEsterno: '205-160', spessoreCappotto: '60+40' })
  })

  it('senza spessori estratti, usa i default vuoti', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] }

    const parziale = statoFormDaCampiEstratti(campi)

    expect(parziale.caratteristiche).toMatchObject({
      spessoreEsterno: '',
      spessoreInterno: '',
      spessoreCoibente: '',
      spessoreCappotto: '',
    })
  })
```

- [ ] **Step 6: Esegui i test e verifica che falliscano**

Run: `npm test -- mappatura-estrazione.test.ts`
Expected: FAIL sul primo nuovo test (`parziale.caratteristiche` non ha `spessoreEsterno` con
quel valore, perché non è ancora mappato).

- [ ] **Step 7: Aggiorna la mappatura**

In `src/app/preventivi/nuovo/mappatura-estrazione.ts`, nel blocco `caratteristiche`:

```typescript
    caratteristiche: {
      ...CARATTERISTICHE_DEFAULT,
      ...(campi.tipoCopertura ? { copertura: campi.tipoCopertura } : {}),
      ...(campi.finituraEsterna ? { finituraEsterna: campi.finituraEsterna } : {}),
      ...(campi.spessoreEsterno ? { spessoreEsterno: campi.spessoreEsterno } : {}),
      ...(campi.spessoreInterno ? { spessoreInterno: campi.spessoreInterno } : {}),
      ...(campi.spessoreCoibente ? { spessoreCoibente: campi.spessoreCoibente } : {}),
      ...(campi.spessoreCappotto ? { spessoreCappotto: campi.spessoreCappotto } : {}),
    },
```

- [ ] **Step 8: Esegui i test e verifica che passino**

Run: `npm test -- mappatura-estrazione.test.ts`
Expected: PASS.

- [ ] **Step 9: Intera suite e type-check**

Run: `npx tsc --noEmit && npm test`
Expected: nessun errore.

- [ ] **Step 10: Commit**

```bash
git add src/ai/estrazione.ts src/ai/estrazione.test.ts \
  src/app/preventivi/nuovo/mappatura-estrazione.ts src/app/preventivi/nuovo/mappatura-estrazione.test.ts
git commit -m "feat(ai): estrai opzionalmente gli spessori dalla frase iniziale

Testo libero, mai normalizzato né inventato (istruzione esplicita nel
prompt); resta comunque modificabile a mano nello step Configurazione."
```

---

## Task 10: Verifica finale end-to-end nel browser

**Files:** nessuno (solo verifica manuale).

- [ ] **Step 1: Suite completa e build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: nessun errore.

- [ ] **Step 2: Avvia il dev server e apri il wizard**

Avvia `npm run dev`, apri `/preventivi/nuovo` (o il percorso equivalente del wizard) nel
browser.

- [ ] **Step 3: Verifica il residuo grigio in anteprima**

Configura un preventivo con struttura `completo` e involucro `completo` (così pareti-mhm,
copertura-falda e cappotto sono incluse) senza toccare i nuovi campi spessore. Nell'anteprima
(colonna descrizione della tabella prezzi), verifica che `{{spessoreEsterno}}` e gli altri
token appaiano in un grigio chiaramente distinto dal testo nero circostante.

- [ ] **Step 4: Verifica l'avviso**

Nello stesso stato, verifica che compaia il banner d'avviso "Spessori non compilati nelle
descrizioni: ..." in cima all'anteprima (assieme agli altri eventuali avvisi di coerenza).

- [ ] **Step 5: Verifica che compilare i campi risolva sia il grigio sia l'avviso**

Nello step Configurazione, compila i 4 campi spessore (es. `205`, `160`, `200`, `140`).
Verifica che: il testo grigio nella colonna descrizione sparisca (sostituito dal valore
inserito, in testo normale); l'avviso "Spessori non compilati" non compaia più.

- [ ] **Step 6: Verifica l'export**

Con i 4 campi compilati, genera il documento (pulsante `PulsanteGeneraDocumento`) e verifica
che il download riesca senza l'errore 422 originale. Con anche solo uno dei 4 campi lasciato
vuoto, verifica che l'export si blocchi ancora con lo stesso errore leggibile di prima.

- [ ] **Step 7: Screenshot di riscontro**

Cattura uno screenshot dell'anteprima con il testo grigio visibile, da allegare alla review
finale.
