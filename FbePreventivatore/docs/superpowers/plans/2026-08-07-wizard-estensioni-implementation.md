# Estensioni del wizard (persistenza, sicurezza, caratteristiche, abaco) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare al wizard le quattro estensioni dichiarate come follow-up nel Task 17 del piano principale: sicurezza editabile, caratteristiche costruttive reali, abaco serramenti diviso per categoria, e persistenza (salva/elenco/riapri) su Prisma+SQLite.

**Architecture:** Le prime tre estensioni estendono `StatoForm` (dati) e `FormStrutturato.tsx`/`PannelloPreview.tsx` (UI), senza toccare il motore di calcolo puro. La quarta aggiunge un layer server (`src/server/`) con un client Prisma reale dietro un driver adapter, funzioni di repository testate contro un DB SQLite in-memory, Route Handler Next.js sottili sopra quelle funzioni, e tre pagine (salva/elenco/riapri).

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 7 (driver adapter `@prisma/adapter-better-sqlite3`), Vitest.

## Global Constraints

- **Sconti a cascata, non additivi** (CLAUDE.md): non toccato da questo piano, nessun task modifica `domain/calcolo.ts`.
- **Due gruppi di voci** (`GREZZO`/`POST_SCONTO`): non toccato da questo piano.
- **Il prezzo si riconcilia top-down** (arrotondamento come leva inversa): non toccato.
- **I numeri di voce si rinumerano al render**: nessun testo introdotto da questo piano cita un numero di voce come costante.
- **L'importo di una voce non è sempre un numero** (`comprese`/`escluso`/`escluse`/`OMAGGIO`): il campo `sicurezza.valorizzata` (Task 1) usa questa stessa idea ma con dominio ristretto a `number | 'OMAGGIO'` — non l'intero set.
- **La revisione congela il listino**: il campo nuovo `statoForm` (Task 7-8) si aggiunge allo snapshot esistente, non lo sostituisce; riaprire una revisione non-bozza deve ricalcolare dagli stessi `inputCalcolo` congelati, mai dai dati "vivi" (`LISTINO_2026` corrente).
- **L'AI non decide i prezzi**: nessun task di questo piano tocca `src/ai/estrazione.ts` o il prompt di sistema.
- **Formato importi italiano** (`96 100,00 €`): non toccato — i nuovi campi (`sicurezza.costoDichiarato`, ecc.) riusano `formattaImportoItaliano` già esistente dove servono a schermo.
- **Superfici come stringhe libere**: non toccato da questo piano.
- **`app/domain/` è TypeScript puro**: nessun task aggiunge import di React/Prisma/rete dentro `src/domain/`. Il Task 8 corregge una violazione di questo vincolo latente nel design (import di `StatoForm`, definito in `src/app/...`, dentro `domain/persistenza.ts`) rendendo le funzioni generiche invece di tipizzate su `StatoForm`.
- **Ambiente locale verificato prima di scrivere questo piano**: `prisma` e `@prisma/client` installati in versione `7.9.1`; `dev.db` esiste con 0 righe in tutte e tre le tabelle (nessun problema di migrazione con dati preesistenti); nessun `PrismaClient` è mai stato istanziato nel codice finora (Task 9 è la prima volta).

---

## Riferimento — tipi esistenti richiamati da più task

Per evitare di ripeterli in ogni task, questi tipi **esistono già** e vengono solo importati:

- `Sicurezza` — `src/domain/calcolo.ts`: `{ costoDichiarato: number; valorizzata: number | 'OMAGGIO' }`
- `InputCalcolo`, `RisultatoCalcolo` — `src/domain/calcolo.ts`
- `Serramento` — `src/domain/geometria.ts`: `{ n: number; piano: string; tipologia: string; b: number; h: number }` (il Task 3 aggiunge `categoria`)
- `LivelloModulo` (`'completo' | 'impoverito' | 'escluso'`), `Modulo` (`'struttura' | 'involucro' | 'finiture'`) — `src/domain/voci.ts`
- `StatoForm` — `src/app/preventivi/nuovo/stato-form.ts`

---

### Task 1: Sicurezza editabile

**Files:**
- Modify: `src/app/preventivi/nuovo/stato-form.ts`
- Modify: `src/app/preventivi/nuovo/FormStrutturato.tsx`
- Test: `src/app/preventivi/nuovo/stato-form.test.ts`

**Interfaces:**
- Consuma: `Sicurezza` da `@/domain/calcolo`.
- Produce: `StatoForm.sicurezza`. Consumato invariato dal Task 8 (serializzazione: fa parte di `StatoForm`, non ha bisogno di trattamento speciale).

- [ ] **Step 1: Estendere la fixture e scrivere il test che fallisce**

In `src/app/preventivi/nuovo/stato-form.test.ts`, aggiungere il campo alla fixture esistente e un nuovo test:

```ts
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
  chiaviInManoNelTotale: true,
  sconti: [{ percentuale: 0.1, causale: 'sconto cliente' }],
  overrides: {},
  totaleTarget: 300000,
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' }, // NUOVO
}
```

```ts
it('propaga la sicurezza (costo dichiarato e valorizzazione) da stato a input', () => {
  const statoConSicurezza: StatoForm = {
    ...STATO_CRIVELLARO,
    sicurezza: { costoDichiarato: 3500, valorizzata: 1800 },
  }
  const input = inputCalcoloDaStato(statoConSicurezza)
  expect(input.sicurezza).toEqual({ costoDichiarato: 3500, valorizzata: 1800 })
})
```

- [ ] **Step 2: Eseguire i test e verificare che il nuovo fallisca**

Run: `npm test -- stato-form`
Expected: il test `'propaga la sicurezza...'` FAIL — `input.sicurezza` vale `{ costoDichiarato: 2000, valorizzata: 'OMAGGIO' }` (il letterale hardcoded), non `{ costoDichiarato: 3500, valorizzata: 1800 }`.

- [ ] **Step 3: Aggiungere il campo a `StatoForm` e usarlo in `inputCalcoloDaStato`**

In `src/app/preventivi/nuovo/stato-form.ts`:

```ts
import type { InputCalcolo, ParametriSconto, Sicurezza } from '@/domain/calcolo'

export interface StatoForm {
  // ... campi esistenti invariati ...
  sicurezza: Sicurezza // NUOVO
}

export function inputCalcoloDaStato(stato: StatoForm): InputCalcolo {
  // ... invariato fino a:
  return {
    // ... campi esistenti invariati ...
    sicurezza: stato.sicurezza, // era: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' }
    arrotondamento: { risolviPerTotale: stato.totaleTarget },
  }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino tutti**

Run: `npm test -- stato-form`
Expected: PASS, tutti i test del file.

- [ ] **Step 5: Aggiungere il default e la UI in `FormStrutturato.tsx`**

Nel `STATO_INIZIALE`:

```ts
const STATO_INIZIALE: StatoForm = {
  // ... campi esistenti invariati ...
  sicurezza: { costoDichiarato: 2000, valorizzata: 'OMAGGIO' }, // NUOVO
}
```

Vicino a `VALORI_TESTUALI_OVERRIDE`, un parser/formatter dedicato (dominio ristretto rispetto a quello degli overrides — la sicurezza non è mai `comprese`/`escluso`/`escluse`):

```ts
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
```

Nello step 3 (`Prezzi`), dopo il blocco "Totale target":

```tsx
<h4>Sicurezza</h4>
<label>
  Costo dichiarato
  <input
    type="number"
    value={stato.sicurezza.costoDichiarato}
    onChange={(e) =>
      aggiorna({ sicurezza: { ...stato.sicurezza, costoDichiarato: Number(e.target.value) } })
    }
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
```

- [ ] **Step 6: Verificare che tutto compili e i test esistenti restino verdi**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/preventivi/nuovo/stato-form.ts src/app/preventivi/nuovo/stato-form.test.ts src/app/preventivi/nuovo/FormStrutturato.tsx
git commit -m "feat(wizard): sicurezza (costo dichiarato e valorizzazione) editabile nel form"
```

---

### Task 2: Caratteristiche costruttive reali e pacchetto derivato

**Files:**
- Modify: `src/app/preventivi/nuovo/stato-form.ts`
- Modify: `src/app/preventivi/nuovo/FormStrutturato.tsx`
- Modify: `src/app/preventivi/nuovo/PannelloPreview.tsx`
- Test: `src/app/preventivi/nuovo/stato-form.test.ts`

**Interfaces:**
- Consuma: `Modulo`, `LivelloModulo` da `@/domain/voci` (già importati in `stato-form.ts`).
- Produce: `CaratteristicheCostruttive`, `Pacchetto`, `pacchettoDaLivelli()` — consumati da `PannelloPreview.tsx` in questo stesso task, da nessun task successivo.

**Nota — verifica contro il golden case, non assumere dalla tabella.** Il golden case Crivellaro ha `finiture: 'impoverito'` **e** `chiaviInManoNelTotale: true`, ma il documento reale (spec §caratteristiche, pag. 4) mostra `PACCHETTO DI CONSEGNA: Grezzo avanzato` — **non** "Chiavi in mano". Quindi `pacchettoDaLivelli` **non** deve dipendere da `chiaviInManoNelTotale`: quel flag decide solo se la voce `opere-chiavi-in-mano` entra nel totale numerato (logica già esistente in `calcolo.ts`/`voci.ts`, non toccata qui), non quale pacchetto viene mostrato in copertina. La funzione dipende solo da `involucro`/`finiture` (la tabella §5 non fa mai variare `struttura` tra i tre pacchetti nominati).

- [ ] **Step 1: Scrivere il test di `pacchettoDaLivelli` (fallisce: la funzione non esiste)**

In `src/app/preventivi/nuovo/stato-form.test.ts`, nuovo blocco:

```ts
import { inputCalcoloDaStato, pacchettoDaLivelli, type StatoForm } from './stato-form'

describe('pacchettoDaLivelli', () => {
  it('Grezzo: involucro impoverito, finiture escluso', () => {
    expect(pacchettoDaLivelli({ struttura: 'completo', involucro: 'impoverito', finiture: 'escluso' })).toBe('Grezzo')
  })

  it('Grezzo avanzato: involucro completo, finiture impoverito — golden case Crivellaro', () => {
    expect(pacchettoDaLivelli({ struttura: 'completo', involucro: 'completo', finiture: 'impoverito' })).toBe(
      'Grezzo avanzato',
    )
  })

  it('Chiavi in mano: involucro completo, finiture completo', () => {
    expect(pacchettoDaLivelli({ struttura: 'completo', involucro: 'completo', finiture: 'completo' })).toBe(
      'Chiavi in mano',
    )
  })

  it('chiaviInManoNelTotale=true su Crivellaro NON cambia il pacchetto (resta Grezzo avanzato, non Chiavi in mano)', () => {
    // Crivellaro: finiture impoverito + chiaviInManoNelTotale true, ma il documento reale
    // mostra "Grezzo avanzato" in copertina — il flag decide solo l'inclusione nel totale.
    expect(pacchettoDaLivelli(STATO_CRIVELLARO.livelli)).toBe('Grezzo avanzato')
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- stato-form`
Expected: FAIL — `pacchettoDaLivelli` non esiste (errore di import/undefined).

- [ ] **Step 3: Implementare `CaratteristicheCostruttive`, `pacchettoDaLivelli` e il campo su `StatoForm`**

In `src/app/preventivi/nuovo/stato-form.ts`:

```ts
export interface CaratteristicheCostruttive {
  // 'piano' è solo descrittivo in questo giro: nel catalogo (src/domain/voci.ts) non esiste
  // nessuna voce alternativa a copertura-falda (niente tetto-piano/veletta-copertura-piana) —
  // selezionare 'piano' NON cambia i prezzi.
  copertura: 'falde' | 'piano'
  manto: string
  finituraEsterna: 'intonaco' | 'rivestimento'
  tetto: string
}

export type Pacchetto = 'Grezzo' | 'Grezzo avanzato' | 'Chiavi in mano'

// Tabella §5 dello spec principale. Dipende solo da involucro/finiture: la tabella non fa
// mai variare struttura tra i tre pacchetti nominati, e chiaviInManoNelTotale NON entra qui
// (decide solo se opere-chiavi-in-mano è sommata nel totale, non il pacchetto mostrato —
// verificato contro il golden case Crivellaro, che è Grezzo avanzato nonostante il flag true).
export function pacchettoDaLivelli(livelli: Record<Modulo, LivelloModulo>): Pacchetto {
  if (livelli.finiture === 'completo') return 'Chiavi in mano'
  if (livelli.involucro === 'completo') return 'Grezzo avanzato'
  return 'Grezzo'
}

export interface StatoForm {
  // ... campi esistenti invariati ...
  caratteristiche: CaratteristicheCostruttive // NUOVO
}
```

- [ ] **Step 4: Aggiungere il campo alla fixture del test**

In `stato-form.test.ts`, `STATO_CRIVELLARO` (valori reali Crivellaro, spec pag. 4):

```ts
caratteristiche: {
  copertura: 'falde',
  manto: 'Tegole in cemento',
  finituraEsterna: 'intonaco',
  tetto: 'Tetto con travi e perline in abete',
},
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npm test -- stato-form`
Expected: PASS, tutti i test del file.

- [ ] **Step 6: UI — step Configurazione in `FormStrutturato.tsx`**

`STATO_INIZIALE`:

```ts
caratteristiche: { copertura: 'falde', manto: 'Tegole in cemento', finituraEsterna: 'intonaco', tetto: 'Tetto con travi e perline in abete' },
```

Nello step 1 (`Configurazione`), dopo il checkbox "Chiavi in mano nel totale":

```tsx
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
```

- [ ] **Step 7: Wiring in `PannelloPreview.tsx`**

```tsx
import { pacchettoDaLivelli } from './stato-form'

// ...

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
```

(sostituisce i 5 letterali fissi che c'erano prima; `PaginaCaratteristiche.tsx` non cambia, ha già queste prop.)

- [ ] **Step 8: Verificare compilazione e test**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 9: Verifica manuale nel browser**

```bash
npm run dev
```

Apri `/preventivi/nuovo`, vai allo step Configurazione, cambia i nuovi campi, controlla che il pannello preview (step Caratteristiche struttura) rifletta i valori inseriti e il pacchetto derivato.

- [ ] **Step 10: Commit**

```bash
git add src/app/preventivi/nuovo/stato-form.ts src/app/preventivi/nuovo/stato-form.test.ts src/app/preventivi/nuovo/FormStrutturato.tsx src/app/preventivi/nuovo/PannelloPreview.tsx
git commit -m "feat(wizard): caratteristiche costruttive reali e pacchetto derivato dai livelli"
```

---

### Task 3: Campo `categoria` su `Serramento`

**Files:**
- Modify: `src/domain/geometria.ts`
- Modify: `src/domain/geometria.test.ts`
- Modify: `src/ai/abaco.test.ts`
- Modify: `src/app/preventivi/nuovo/stato-form.test.ts`
- Modify: `src/app/preventivi/nuovo/FormStrutturato.tsx`

**Interfaces:**
- Produce: `CATEGORIE_SERRAMENTO`, `CategoriaSerramento`, `Serramento.categoria` — consumati dal Task 4 (`generaAbacoPerCategoria`) e dal Task 5 (UI).

Aggiungere un campo obbligatorio a un'interfaccia esistente rompe la compilazione di ogni literal `Serramento` nel repo finché non li si aggiorna. Sono tre file di test più `FormStrutturato.tsx` (verificato con `grep -rln "tipologia:" src`).

- [ ] **Step 1: Aggiungere il tipo e il campo in `geometria.ts`**

```ts
export const CATEGORIE_SERRAMENTO = [
  'finestra-battente',
  'portafinestra-battente',
  'fisso-vetrata',
  'alzante-scorrevole',
  'portoncino',
] as const
export type CategoriaSerramento = (typeof CATEGORIE_SERRAMENTO)[number]

export interface Serramento {
  n: number
  piano: string
  tipologia: string
  categoria: CategoriaSerramento // NUOVO
  b: number
  h: number
}
```

- [ ] **Step 2: Aggiornare le fixture in `geometria.test.ts`**

`SERRAMENTI_CRIVELLARO` (mappatura da `tipologia` esistente — vale identica in tutti i file che replicano questa fixture):

```ts
const SERRAMENTI_CRIVELLARO: Serramento[] = [
  { n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 },
  { n: 2, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.0, h: 1.8 },
  { n: 3, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 2.2 },
  { n: 4, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 5, piano: 'PT', tipologia: 'doppia finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 6, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 7, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.9, h: 1.2 },
  { n: 8, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.6, h: 2.2 },
  { n: 9, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 2.8, h: 2.2 },
  { n: 10, piano: 'PT', tipologia: 'portafinestra', categoria: 'portafinestra-battente', b: 2.2, h: 2.2 },
  { n: 11, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 0.8, h: 2.1 },
]
```

e le due chiamate dirette a `calcolaApertura` nei test `describe('calcolaApertura', ...)`:

```ts
const risultato = calcolaApertura({ n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 })
```

```ts
const risultato = calcolaApertura(
  { n: 1, piano: 'PT', tipologia: 'finestra', categoria: 'finestra-battente', b: 1.0, h: 1.0 },
  { orizzontale: 0, verticale: 0 },
)
```

Aggiungere anche un test che copra il nuovo campo:

```ts
it('conserva la categoria nell\'apertura calcolata', () => {
  const risultato = calcolaApertura({ n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1.0, h: 2.2 })
  expect(risultato.categoria).toBe('portoncino')
})
```

- [ ] **Step 3: Aggiornare la fixture in `src/ai/abaco.test.ts`**

Stessa mappatura dello Step 2, applicata a `SERRAMENTI_CRIVELLARO` in quel file (identica struttura, stesso array).

- [ ] **Step 4: Aggiornare la fixture in `src/app/preventivi/nuovo/stato-form.test.ts`**

```ts
serramenti: [{ n: 1, piano: 'PT', tipologia: 'porta di ingresso', categoria: 'portoncino', b: 1, h: 2.2 }],
```

- [ ] **Step 5: Eseguire tutti i test e verificare che passino**

Run: `npm test`
Expected: PASS su tutto il repo (nessuna regressione, `categoria` non influenza `calcolaApertura`/`totaliSerramenti`).

- [ ] **Step 6: UI — select categoria per riga serramento in `FormStrutturato.tsx`**

Import aggiuntivo:

```ts
import { totaleSuperficiLorde, PIANI_CANONICI, CATEGORIE_SERRAMENTO, type CategoriaSerramento, type Serramento, type SuperficiePiano } from '@/domain/geometria'
```

Default per una riga nuova (bottone "Aggiungi serramento"):

```tsx
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
```

Nuovo controllo nella riga (accanto a "Tipologia"):

```tsx
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
```

- [ ] **Step 7: Verificare compilazione**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 8: Commit**

```bash
git add src/domain/geometria.ts src/domain/geometria.test.ts src/ai/abaco.test.ts src/app/preventivi/nuovo/stato-form.test.ts src/app/preventivi/nuovo/FormStrutturato.tsx
git commit -m "feat(domain): campo categoria su Serramento, base per l'abaco per categoria"
```

---

### Task 4: `generaAbacoPerCategoria`

**Files:**
- Modify: `src/ai/abaco.ts`
- Modify: `src/ai/abaco.test.ts`
- Modify: `src/documento/export-docx.ts`

**Interfaces:**
- Consuma: `Serramento` (con `categoria`, Task 3), `generaAbacoSerramenti()` (esistente, invariata).
- Produce: `AbacoPerCategoria`, `generaAbacoPerCategoria()` — consumati dal Task 5 (UI preview) e già attesi da `export-docx.ts` (che smette di definire il tipo localmente).

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/ai/abaco.test.ts`, nuovo blocco (usa `SERRAMENTI_CRIVELLARO` già aggiornata dal Task 3: 1 portoncino, 9 finestra-battente, 1 portafinestra-battente, 0 fisso-vetrata, 0 alzante-scorrevole):

```ts
import { generaAbacoSerramenti, generaAbacoPerCategoria } from './abaco'

describe('generaAbacoPerCategoria — golden case Crivellaro', () => {
  it('smista il portoncino solo nella categoria portoncini', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.portoncini).toBe('n. 1 dim. 100x220;')
    expect(abaco.finestreBattente).not.toContain('100x220')
  })

  it('smista la portafinestra nella categoria portefinestreBattente', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.portefinestreBattente).toBe('n. 1 dim. 220x220;')
  })

  it('lascia vuote le categorie senza serramenti (fissi e scorrevoli, assenti in Crivellaro)', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.fissiVetrate).toBe('')
    expect(abaco.alzantiScorrevoli).toBe('')
  })

  it('tutti resta identico all\'output esistente di generaAbacoSerramenti', () => {
    const abaco = generaAbacoPerCategoria(SERRAMENTI_CRIVELLARO)
    expect(abaco.tutti).toBe(generaAbacoSerramenti(SERRAMENTI_CRIVELLARO))
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- abaco`
Expected: FAIL — `generaAbacoPerCategoria` non esiste.

- [ ] **Step 3: Implementare in `src/ai/abaco.ts`**

```ts
import type { Serramento } from '@/domain/geometria'

// ... formattaCm, generaAbacoSerramenti invariate ...

export interface AbacoPerCategoria {
  tutti: string
  finestreBattente: string
  portefinestreBattente: string
  fissiVetrate: string
  alzantiScorrevoli: string
  portoncini: string
}

export function generaAbacoPerCategoria(serramenti: Serramento[]): AbacoPerCategoria {
  const perCategoria = (categoria: Serramento['categoria']) =>
    generaAbacoSerramenti(serramenti.filter((s) => s.categoria === categoria))

  return {
    tutti: generaAbacoSerramenti(serramenti),
    finestreBattente: perCategoria('finestra-battente'),
    portefinestreBattente: perCategoria('portafinestra-battente'),
    fissiVetrate: perCategoria('fisso-vetrata'),
    alzantiScorrevoli: perCategoria('alzante-scorrevole'),
    portoncini: perCategoria('portoncino'),
  }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- abaco`
Expected: PASS, tutti i test del file.

- [ ] **Step 5: `export-docx.ts` importa il tipo invece di ridefinirlo**

Rimuovere la definizione locale (righe 52-59 attuali) e sostituirla con l'import:

```ts
import type { AbacoPerCategoria } from '@/ai/abaco'
```

`InputEsportazione.abaco: AbacoPerCategoria` resta invariato (stessa forma, ora importata invece che ridefinita).

- [ ] **Step 6: Verificare che `export-docx.test.ts` non si sia rotto**

Run: `npm run typecheck && npm test -- export-docx`
Expected: PASS — il test costruisce un letterale che soddisfa la forma per compatibilità strutturale, non importa il tipo per nome.

- [ ] **Step 7: Commit**

```bash
git add src/ai/abaco.ts src/ai/abaco.test.ts src/documento/export-docx.ts
git commit -m "feat(ai): abaco serramenti diviso per categoria, tipo AbacoPerCategoria spostato in ai/abaco"
```

---

### Task 5: Abaco per categoria nella preview

**Files:**
- Modify: `src/documento/preview/PaginaAbacoSerramenti.tsx`
- Modify: `src/app/preventivi/nuovo/PannelloPreview.tsx`

**Interfaces:**
- Consuma: `generaAbacoPerCategoria()`, `AbacoPerCategoria` (Task 4).

- [ ] **Step 1: Riscrivere `PaginaAbacoSerramenti.tsx`**

```tsx
import type { AbacoPerCategoria } from '@/ai/abaco'

interface Props {
  abaco: AbacoPerCategoria
}

const ETICHETTE_CATEGORIA: { chiave: Exclude<keyof AbacoPerCategoria, 'tutti'>; titolo: string }[] = [
  { chiave: 'finestreBattente', titolo: 'Finestre a battente' },
  { chiave: 'portefinestreBattente', titolo: 'Portefinestre a battente' },
  { chiave: 'fissiVetrate', titolo: 'Fissi e vetrate' },
  { chiave: 'alzantiScorrevoli', titolo: 'Alzanti scorrevoli' },
  { chiave: 'portoncini', titolo: "Portoncino d'ingresso" },
]

export function PaginaAbacoSerramenti({ abaco }: Props) {
  return (
    <div className="pagina-a4">
      <h3>Serramenti e portoncino d&apos;ingresso</h3>
      {ETICHETTE_CATEGORIA.map(({ chiave, titolo }) =>
        abaco[chiave] ? (
          <p key={chiave}>
            <strong>{titolo}</strong>: {abaco[chiave]}
          </p>
        ) : null,
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wiring in `PannelloPreview.tsx`**

```tsx
import { generaAbacoPerCategoria } from '@/ai/abaco'

// ...

const abaco = generaAbacoPerCategoria(stato.serramenti) // era: generaAbacoSerramenti(stato.serramenti)
```

(il resto del componente, incluso `<PaginaAbacoSerramenti abaco={abaco} />`, non cambia — cambia solo il tipo di `abaco`.)

- [ ] **Step 3: Verificare compilazione**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 4: Verifica manuale nel browser**

```bash
npm run dev
```

Apri `/preventivi/nuovo`, inserisci alcuni serramenti con categorie diverse nello step Geometria, controlla che il pannello preview mostri righe separate per categoria (solo quelle non vuote).

- [ ] **Step 5: Commit**

```bash
git add src/documento/preview/PaginaAbacoSerramenti.tsx src/app/preventivi/nuovo/PannelloPreview.tsx
git commit -m "feat(wizard): abaco serramenti in preview diviso per categoria"
```

---

### Task 6: Anagrafica — campi mancanti per la persistenza

**Files:**
- Modify: `src/app/preventivi/nuovo/stato-form.ts`
- Modify: `src/app/preventivi/nuovo/FormStrutturato.tsx`

**Interfaces:**
- Produce: `StatoForm.oggetto`, `StatoForm.progettista`, `StatoForm.data`, `StatoForm.luogo` — consumati dal Task 11 (payload di salvataggio). Questi campi **non** entrano in `InputCalcolo` (non toccano `inputCalcoloDaStato`): sono anagrafica pura, richiesta dallo schema Prisma esistente (`Preventivo.oggetto`, `Revisione.data`/`luogo`), non dal motore di calcolo.

Nessuna logica di dominio da testare qui (nessun calcolo coinvolto) — verifica per compilazione + manuale, stesso pattern già usato nel piano principale per i campi puramente anagrafici.

- [ ] **Step 1: Aggiungere i campi a `StatoForm`**

```ts
export interface StatoForm {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  oggetto: string // NUOVO — Preventivo.oggetto
  progettista: string // NUOVO — Preventivo.progettista (opzionale nello schema, stringa vuota se non compilato)
  data: string // NUOVO — Revisione.data, formato ISO 'YYYY-MM-DD'
  luogo: string // NUOVO — Revisione.luogo
  // ... resto invariato ...
}
```

- [ ] **Step 2: Default in `FormStrutturato.tsx`**

```ts
const STATO_INIZIALE: StatoForm = {
  cliente: { nome: '', comune: '', provincia: '' },
  protocollo: '',
  oggetto: '',
  progettista: '',
  data: new Date().toISOString().slice(0, 10),
  luogo: '',
  // ... resto invariato ...
}
```

- [ ] **Step 3: UI nello step Anagrafica**

Dopo il campo "Protocollo":

```tsx
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
```

- [ ] **Step 4: Aggiornare le fixture `StatoForm` esistenti**

`stato-form.test.ts`, `STATO_CRIVELLARO`:

```ts
oggetto: 'Fornitura e posa in opera di casa in legno MHM',
progettista: '',
data: '2026-08-07',
luogo: 'Trissino',
```

- [ ] **Step 5: Verificare compilazione e test**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 6: Verifica manuale nel browser**

```bash
npm run dev
```

Apri `/preventivi/nuovo`, verifica che i 4 nuovi campi compaiano nello step Anagrafica e siano editabili.

- [ ] **Step 7: Commit**

```bash
git add src/app/preventivi/nuovo/stato-form.ts src/app/preventivi/nuovo/stato-form.test.ts src/app/preventivi/nuovo/FormStrutturato.tsx
git commit -m "feat(wizard): campi anagrafica mancanti (oggetto, progettista, data, luogo) per la persistenza"
```

---

### Task 7: Schema Prisma — colonna `statoForm`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_aggiungi_stato_form/migration.sql` (generato dal comando, non scritto a mano)

**Interfaces:**
- Produce: colonna `Revisione.statoForm` — consumata dal Task 8 (`persistenza.ts`) e dal Task 9 (repo layer).

- [ ] **Step 1: Modificare `prisma/schema.prisma`**

```prisma
model Revisione {
  id           String     @id @default(cuid())
  preventivoId String
  preventivo   Preventivo @relation(fields: [preventivoId], references: [id])
  numero       Int
  data         DateTime
  luogo        String
  stato        String     @default("bozza") // bozza | inviata | firmata

  // Stato grezzo del wizard (StatoForm serializzato) — per riaprire una bozza e
  // continuare a modificarla. Default stringa vuota solo per compatibilità DDL SQLite
  // (una colonna NOT NULL aggiunta a una tabella esistente richiede un default anche a
  // 0 righe); ogni riga reale scritta dall'app valorizza sempre un JSON vero, mai questo
  // default — non c'è nessun codice che lo legga come dato valido.
  statoForm String @default("")

  // Snapshot immutabile usato per i numeri (CLAUDE.md vincolo 6) — invariati.
  inputCalcolo     String
  risultatoCalcolo String

  @@unique([preventivoId, numero])
}
```

- [ ] **Step 2: Generare la migrazione**

```bash
npx prisma migrate dev --name aggiungi_stato_form_a_revisione
```

`dev.db` ha 0 righe in tutte le tabelle (verificato prima di scrivere questo piano) — il comando non chiederà input interattivo per un default su righe esistenti.

- [ ] **Step 3: Verificare il contenuto della migrazione generata**

Apri il file `prisma/migrations/<nuovo_timestamp>_aggiungi_stato_form_a_revisione/migration.sql` appena creato e conferma che contenga un `ALTER TABLE "Revisione" ADD COLUMN "statoForm" TEXT NOT NULL DEFAULT '';` (la sintassi esatta dipende dalla versione di Prisma — verificare che la colonna, il tipo e il default corrispondano, non assumere).

- [ ] **Step 4: Rigenerare il client Prisma**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client (v7.9.1) to ./node_modules/@prisma/client`, nessun errore.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): aggiunge la colonna statoForm a Revisione, per riaprire una bozza in editing"
```

---

### Task 8: `domain/persistenza.ts` — `statoForm` nel round-trip

**Files:**
- Modify: `src/domain/persistenza.ts`
- Modify: `src/domain/persistenza.test.ts`

**Interfaces:**
- Consuma: `InputCalcolo`, `RisultatoCalcolo` (invariati).
- Produce: `serializzaRevisione<T>()`, `deserializzaRevisione<T>()` — ora generiche su `T` (lo stato grezzo, tipicamente `StatoForm`) invece di importare `StatoForm` direttamente. **Motivo**: `StatoForm` è definito in `src/app/...`; se `domain/persistenza.ts` lo importasse per nome violerebbe il vincolo CLAUDE.md "`app/domain/` è TypeScript puro" invertendo la direzione di dipendenza (domain che dipende dall'app). Generici mantengono `persistenza.ts` completamente disaccoppiato: prende/restituisce `unknown` tipizzato dal chiamante. Consumato dal Task 9 (`src/server/preventivi-repo.ts`, che istanzia `<StatoForm>` esplicitamente).

- [ ] **Step 1: Scrivere il test che fallisce**

In `src/domain/persistenza.test.ts`, aggiornare le chiamate esistenti aggiungendo un primo argomento `stato`, e aggiungere un test dedicato. Lo stato grezzo qui è un oggetto qualsiasi — il modulo non conosce `StatoForm`:

```ts
const STATO_FINTO = { esempio: 'qualsiasi valore JSON-serializzabile', numero: 42 }
```

Aggiornare le 4 chiamate esistenti a `serializzaRevisione`/`deserializzaRevisione` per includere `STATO_FINTO` come primo argomento, es.:

```ts
const { statoForm, inputCalcolo, risultatoCalcolo } = serializzaRevisione(STATO_FINTO, INPUT_GOLDEN, originale)
const ricostruito = deserializzaRevisione<typeof STATO_FINTO>(statoForm, inputCalcolo, risultatoCalcolo)
```

(applicare lo stesso pattern a tutte e 4 le chiamate nel file: le due nel blocco "vincolo 6" e le due nel blocco "serializzaRevisione / deserializzaRevisione".)

Nuovo test dedicato:

```ts
it('il round-trip preserva lo stato grezzo del wizard, non solo il calcolo', () => {
  const { statoForm, inputCalcolo, risultatoCalcolo } = serializzaRevisione(
    STATO_FINTO,
    INPUT_MINIMO,
    eseguiCalcolo(INPUT_MINIMO),
  )
  const ricostruito = deserializzaRevisione<typeof STATO_FINTO>(statoForm, inputCalcolo, risultatoCalcolo)
  expect(ricostruito.stato).toEqual(STATO_FINTO)
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- persistenza`
Expected: FAIL — `serializzaRevisione` non accetta ancora un primo argomento `stato`, la firma attuale ha solo 2 parametri (errore di tipo/argomento in eccesso a runtime JS: il terzo argomento passato in più viene ignorato dalla vecchia firma, quindi il risultato non ha `statoForm` e il nuovo test fallisce su `ricostruito.stato` undefined).

- [ ] **Step 3: Implementare le firme generiche**

```ts
// src/domain/persistenza.ts
import type { InputCalcolo, RisultatoCalcolo } from './calcolo'

export function serializzaRevisione<T>(
  stato: T,
  input: InputCalcolo,
  risultato: RisultatoCalcolo,
): { statoForm: string; inputCalcolo: string; risultatoCalcolo: string } {
  return {
    statoForm: JSON.stringify(stato),
    inputCalcolo: JSON.stringify(input),
    risultatoCalcolo: JSON.stringify(risultato),
  }
}

export function deserializzaRevisione<T>(
  statoForm: string,
  inputCalcolo: string,
  risultatoCalcolo: string,
): { stato: T; input: InputCalcolo; risultato: RisultatoCalcolo } {
  return {
    stato: JSON.parse(statoForm) as T,
    input: JSON.parse(inputCalcolo) as InputCalcolo,
    risultato: JSON.parse(risultatoCalcolo) as RisultatoCalcolo,
  }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- persistenza`
Expected: PASS, tutti i test del file (incluso il test "congela il listino" esistente, invariato nella logica).

- [ ] **Step 5: Commit**

```bash
git add src/domain/persistenza.ts src/domain/persistenza.test.ts
git commit -m "feat(domain): statoForm nel round-trip di persistenza, firme generiche per restare disaccoppiate da StatoForm"
```

---

### Task 9: Client Prisma reale e repository layer

**Files:**
- Create: `src/server/prisma.ts`
- Create: `src/server/test-db.ts`
- Create: `src/server/preventivi-repo.ts`
- Test: `src/server/preventivi-repo.test.ts`
- Modify: `package.json` (nuova dipendenza)

**Interfaces:**
- Consuma: `PrismaClient` (generato), `serializzaRevisione`/`deserializzaRevisione` non usati qui direttamente (li usa il chiamante delle route, Task 10) — questo task salva/legge stringhe JSON già serializzate, non le produce.
- Produce: `prisma` (singleton), `creaClientDiTest()`/`applicaMigrazioni()` (helper di test), `creaPreventivoConBozza()`, `aggiungiRevisione()`, `aggiornaBozza()`, `elencaPreventivi()`, `caricaRevisione()` — consumati dal Task 10 (route) e dal Task 12/13 (pagine server component).

**Nota sulla versione.** Prisma 7 richiede un driver adapter esplicito (verificato in questa sessione leggendo i tipi generati in `node_modules/@prisma/client/runtime/client.d.ts`: `PrismaClientOptions` non accetta più un `datasourceUrl` semplice, richiede `adapter` o `accelerateUrl`). Per SQLite l'adapter ufficiale è `@prisma/adapter-better-sqlite3`, alla stessa versione di `prisma`/`@prisma/client` già installati (`7.9.1` — dist-tag `latest` verificato con `npm view`). Installa `better-sqlite3` come sua dipendenza diretta, non serve aggiungerlo a mano.

- [ ] **Step 1: Installare l'adapter**

```bash
npm install @prisma/adapter-better-sqlite3@7.9.1
```

- [ ] **Step 2: Creare il singleton `src/server/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' })

const globaleConPrisma = globalThis as unknown as { prisma?: PrismaClient }

// In sviluppo Next.js ricarica i moduli ad ogni modifica: senza cache su `globalThis`,
// ogni hot-reload aprirebbe una nuova connessione SQLite.
export const prisma = globaleConPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globaleConPrisma.prisma = prisma
```

- [ ] **Step 3: Creare l'helper di test `src/server/test-db.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

const CARTELLA_MIGRAZIONI = path.join(process.cwd(), 'prisma', 'migrations')

function sqlDiTutteLeMigrazioni(): string[] {
  const voci = fs.readdirSync(CARTELLA_MIGRAZIONI, { withFileTypes: true })
  return voci
    .filter((voce) => voce.isDirectory())
    .map((voce) => voce.name)
    .sort()
    .map((cartella) => fs.readFileSync(path.join(CARTELLA_MIGRAZIONI, cartella, 'migration.sql'), 'utf-8'))
}

export function creaClientDiTest(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: ':memory:' })
  return new PrismaClient({ adapter })
}

export async function applicaMigrazioni(client: PrismaClient): Promise<void> {
  for (const sql of sqlDiTutteLeMigrazioni()) {
    for (const istruzione of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await client.$executeRawUnsafe(istruzione)
    }
  }
}
```

- [ ] **Step 4: Scrivere il test del repo layer (fallisce: il modulo non esiste)**

```ts
// src/server/preventivi-repo.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import { creaClientDiTest, applicaMigrazioni } from './test-db'
import {
  creaPreventivoConBozza,
  aggiungiRevisione,
  aggiornaBozza,
  elencaPreventivi,
  caricaRevisione,
} from './preventivi-repo'

const DATI_BASE = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-07',
  luogo: 'Trissino',
  statoForm: JSON.stringify({ esempio: true }),
  inputCalcolo: JSON.stringify({ esempio: true }),
  risultatoCalcolo: JSON.stringify({ esempio: true }),
}

let db: PrismaClient

beforeEach(async () => {
  db = creaClientDiTest()
  await applicaMigrazioni(db)
})

afterEach(async () => {
  await db.$disconnect()
})

describe('creaPreventivoConBozza', () => {
  it('crea cliente, preventivo e la revisione numero 1 in stato bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    expect(preventivo.protocollo).toBe('2026059')
    expect(preventivo.revisioni).toHaveLength(1)
    expect(preventivo.revisioni[0].numero).toBe(1)
    expect(preventivo.revisioni[0].stato).toBe('bozza')
  })

  it('riusa un cliente esistente con stessi nome/comune/provincia invece di duplicarlo', async () => {
    await creaPreventivoConBozza(db, DATI_BASE)
    await creaPreventivoConBozza(db, { ...DATI_BASE, protocollo: '2026060' })
    const clienti = await db.cliente.findMany()
    expect(clienti).toHaveLength(1)
  })

  it('rifiuta un protocollo duplicato', async () => {
    await creaPreventivoConBozza(db, DATI_BASE)
    await expect(creaPreventivoConBozza(db, DATI_BASE)).rejects.toThrow(/protocollo/)
  })
})

describe('aggiungiRevisione', () => {
  it('aggiunge la revisione numero 2 senza toccare la numero 1', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    const nuova = await aggiungiRevisione(db, preventivo.id, DATI_BASE)
    expect(nuova.numero).toBe(2)
    expect(nuova.stato).toBe('bozza')
    const originale = await caricaRevisione(db, preventivo.id, 1)
    expect(originale?.stato).toBe('bozza')
  })
})

describe('aggiornaBozza', () => {
  it('aggiorna lo statoForm di una revisione in bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await aggiornaBozza(db, preventivo.id, 1, { ...DATI_BASE, statoForm: JSON.stringify({ modificato: true }) })
    const aggiornata = await caricaRevisione(db, preventivo.id, 1)
    expect(aggiornata?.statoForm).toBe(JSON.stringify({ modificato: true }))
  })

  it('rifiuta di modificare una revisione non più in bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await db.revisione.update({
      where: { preventivoId_numero: { preventivoId: preventivo.id, numero: 1 } },
      data: { stato: 'firmata' },
    })
    await expect(aggiornaBozza(db, preventivo.id, 1, DATI_BASE)).rejects.toThrow(/non modificabile/)
  })
})

describe('elencaPreventivi', () => {
  it('elenca i preventivi con l\'ultima revisione di ciascuno', async () => {
    const preventivo = await creaPreventivoConBozza(db, DATI_BASE)
    await aggiungiRevisione(db, preventivo.id, DATI_BASE)
    const elenco = await elencaPreventivi(db)
    expect(elenco).toHaveLength(1)
    expect(elenco[0].ultimaRevisione?.numero).toBe(2)
  })
})
```

- [ ] **Step 5: Eseguire i test e verificare che falliscano**

Run: `npm test -- preventivi-repo`
Expected: FAIL — `./preventivi-repo` non esiste.

- [ ] **Step 6: Implementare `src/server/preventivi-repo.ts`**

```ts
import type { PrismaClient } from '@prisma/client'

export interface DatiRevisione {
  statoForm: string
  inputCalcolo: string
  risultatoCalcolo: string
}

export interface DatiBozza extends DatiRevisione {
  cliente: { nome: string; comune: string; provincia: string }
  protocollo: string
  oggetto: string
  progettista: string
  data: string
  luogo: string
}

export async function creaPreventivoConBozza(db: PrismaClient, dati: DatiBozza) {
  const esistente = await db.preventivo.findUnique({ where: { protocollo: dati.protocollo } })
  if (esistente) {
    throw new Error(
      `Esiste già un preventivo con protocollo ${dati.protocollo} — usa aggiungiRevisione per aggiungere una revisione, non crearne uno nuovo.`,
    )
  }

  let cliente = await db.cliente.findFirst({
    where: { nome: dati.cliente.nome, comune: dati.cliente.comune, provincia: dati.cliente.provincia },
  })
  if (!cliente) {
    cliente = await db.cliente.create({ data: dati.cliente })
  }

  return db.preventivo.create({
    data: {
      protocollo: dati.protocollo,
      oggetto: dati.oggetto,
      progettista: dati.progettista || null,
      clienteId: cliente.id,
      revisioni: {
        create: {
          numero: 1,
          data: new Date(dati.data),
          luogo: dati.luogo,
          stato: 'bozza',
          statoForm: dati.statoForm,
          inputCalcolo: dati.inputCalcolo,
          risultatoCalcolo: dati.risultatoCalcolo,
        },
      },
    },
    include: { revisioni: true, cliente: true },
  })
}

export async function aggiungiRevisione(
  db: PrismaClient,
  preventivoId: string,
  dati: DatiRevisione & { data: string; luogo: string },
) {
  const ultima = await db.revisione.findFirst({ where: { preventivoId }, orderBy: { numero: 'desc' } })
  if (!ultima) throw new Error(`Nessun preventivo trovato con id ${preventivoId}`)

  return db.revisione.create({
    data: {
      preventivoId,
      numero: ultima.numero + 1,
      data: new Date(dati.data),
      luogo: dati.luogo,
      stato: 'bozza',
      statoForm: dati.statoForm,
      inputCalcolo: dati.inputCalcolo,
      risultatoCalcolo: dati.risultatoCalcolo,
    },
  })
}

export async function aggiornaBozza(db: PrismaClient, preventivoId: string, numero: number, dati: DatiRevisione) {
  const revisione = await db.revisione.findUnique({ where: { preventivoId_numero: { preventivoId, numero } } })
  if (!revisione) throw new Error(`Revisione ${numero} non trovata per il preventivo ${preventivoId}`)
  if (revisione.stato !== 'bozza') {
    throw new Error(
      `La revisione ${numero} è "${revisione.stato}", non modificabile — crea una nuova revisione con aggiungiRevisione.`,
    )
  }

  return db.revisione.update({
    where: { preventivoId_numero: { preventivoId, numero } },
    data: {
      statoForm: dati.statoForm,
      inputCalcolo: dati.inputCalcolo,
      risultatoCalcolo: dati.risultatoCalcolo,
    },
  })
}

export async function elencaPreventivi(db: PrismaClient) {
  const preventivi = await db.preventivo.findMany({
    include: { cliente: true, revisioni: { orderBy: { numero: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })
  return preventivi.map((p) => ({
    id: p.id,
    protocollo: p.protocollo,
    cliente: p.cliente,
    ultimaRevisione: p.revisioni[0]
      ? { numero: p.revisioni[0].numero, stato: p.revisioni[0].stato, data: p.revisioni[0].data }
      : null,
  }))
}

export async function caricaRevisione(db: PrismaClient, preventivoId: string, numero: number) {
  return db.revisione.findUnique({
    where: { preventivoId_numero: { preventivoId, numero } },
    include: { preventivo: { include: { cliente: true } } },
  })
}
```

- [ ] **Step 7: Eseguire i test e verificare che passino**

Run: `npm test -- preventivi-repo`
Expected: PASS, tutti i test del file — questo dimostra anche che l'adapter `@prisma/adapter-better-sqlite3` e l'helper di migrazione in-memory funzionano correttamente end-to-end.

- [ ] **Step 8: Verificare tutto il repo**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/server/prisma.ts src/server/test-db.ts src/server/preventivi-repo.ts src/server/preventivi-repo.test.ts
git commit -m "feat(server): client Prisma reale con driver adapter SQLite, repository layer testato contro DB in-memory"
```

---

### Task 10: API Route Handlers

**Files:**
- Create: `src/app/api/preventivi/route.ts`
- Test: `src/app/api/preventivi/route.test.ts`
- Create: `src/app/api/preventivi/[id]/revisioni/route.ts`
- Test: `src/app/api/preventivi/[id]/revisioni/route.test.ts`
- Create: `src/app/api/preventivi/[id]/revisioni/[numero]/route.ts`
- Test: `src/app/api/preventivi/[id]/revisioni/[numero]/route.test.ts`

**Interfaces:**
- Consuma: `prisma` (Task 9, mockato nei test), `creaPreventivoConBozza`/`aggiungiRevisione`/`aggiornaBozza`/`elencaPreventivi`/`caricaRevisione` (Task 9).
- Produce: gli endpoint HTTP consumati dal Task 11 (bottone salva) e dai Server Component dei Task 12/13 (che però chiamano le funzioni del repo direttamente, non via HTTP — vedi nota nel Task 12).

**Nota sui tipi dei Route Handler.** In questa versione di Next.js (16.2, verificato in `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) i `params` dei Route Handler dinamici sono una `Promise` da awaitare. Esiste un helper di tipo `RouteContext<'/percorso'>` generato da `next dev`/`next build`/`next typegen`, ma **non lo usiamo**: dipendere da tipi generati renderebbe `npm run typecheck` fragile se qualcuno lo esegue senza aver mai lanciato `next dev`/`next build` prima. Tipizziamo `params` inline come `Promise<{ ... }>`, che è la forma reale sottostante indipendentemente dall'helper.

**Nota sulla validazione.** Nessuna validazione runtime del corpo della richiesta (es. zod) — coerente con lo scope da prototipo, come per il resto del progetto. Un corpo malformato produce un errore Prisma leggibile (es. violazione NOT NULL su un campo mancante), non un crash silenzioso.

- [ ] **Step 1: Scrivere il test di `POST`/`GET /api/preventivi` (fallisce: il modulo non esiste)**

**Nota sul mock del client Prisma.** `vi.mock()` viene issato (hoisted) da Vitest sopra tutti gli import del file: una `const` dichiarata nello stesso file e referenziata dentro la factory di `vi.mock` va in errore "Cannot access before initialization" (temporal dead zone), perché la dichiarazione locale non è ancora eseguita quando la factory hoistata gira. Un binding *importato* invece non ha questo problema (i binding di modulo ES sono risolti prima che il corpo del modulo esegua). Per questo la factory chiama `creaClientDiTest()` (importata) **dentro** se stessa, e per riottenere la STESSA istanza fuori dalla factory (per `applicaMigrazioni`/pulizia tra i test) si ri-importa `{ prisma }` da `@/server/prisma` — che, essendo mockato, restituisce lo stesso oggetto singleton cache-ato da Vitest per quel modulo.

```ts
// src/app/api/preventivi/route.test.ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'

vi.mock('@/server/prisma', () => ({ prisma: creaClientDiTest() }))

const { prisma: db } = await import('@/server/prisma')
const { POST, GET } = await import('./route')

beforeAll(async () => {
  await applicaMigrazioni(db)
})

beforeEach(async () => {
  await db.revisione.deleteMany()
  await db.preventivo.deleteMany()
  await db.cliente.deleteMany()
})

const CORPO_BASE = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-07',
  luogo: 'Trissino',
  statoForm: JSON.stringify({ esempio: true }),
  inputCalcolo: JSON.stringify({ esempio: true }),
  risultatoCalcolo: JSON.stringify({ esempio: true }),
}

describe('POST /api/preventivi', () => {
  it('crea un preventivo e risponde 201 con id e numero revisione', async () => {
    const risposta = await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    expect(risposta.status).toBe(201)
    const corpo = await risposta.json()
    expect(corpo.protocollo).toBe('2026059')
    expect(corpo.revisioni[0].numero).toBe(1)
  })

  it('risponde 409 su un protocollo duplicato', async () => {
    await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    const risposta = await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    expect(risposta.status).toBe(409)
  })
})

describe('GET /api/preventivi', () => {
  it('elenca i preventivi salvati', async () => {
    await POST(new Request('http://localhost/api/preventivi', { method: 'POST', body: JSON.stringify(CORPO_BASE) }))
    const risposta = await GET()
    const corpo = await risposta.json()
    expect(corpo).toHaveLength(1)
    expect(corpo[0].protocollo).toBe('2026059')
  })
})
```

- [ ] **Step 2: Eseguire e verificare che fallisca**

Run: `npm test -- src/app/api/preventivi/route.test.ts`
Expected: FAIL — `./route` non esiste.

- [ ] **Step 3: Implementare `src/app/api/preventivi/route.ts`**

```ts
import { prisma } from '@/server/prisma'
import { creaPreventivoConBozza, elencaPreventivi } from '@/server/preventivi-repo'

export async function POST(request: Request) {
  const corpo = await request.json()
  try {
    const preventivo = await creaPreventivoConBozza(prisma, corpo)
    return Response.json(preventivo, { status: 201 })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    return Response.json({ errore: messaggio }, { status: 409 })
  }
}

export async function GET() {
  const elenco = await elencaPreventivi(prisma)
  return Response.json(elenco)
}
```

- [ ] **Step 4: Eseguire e verificare che passi**

Run: `npm test -- src/app/api/preventivi/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Scrivere il test di `POST /api/preventivi/[id]/revisioni` (fallisce)**

```ts
// src/app/api/preventivi/[id]/revisioni/route.test.ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'
import { creaPreventivoConBozza } from '@/server/preventivi-repo'

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

const CORPO_BASE = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-07',
  luogo: 'Trissino',
  statoForm: JSON.stringify({ esempio: true }),
  inputCalcolo: JSON.stringify({ esempio: true }),
  risultatoCalcolo: JSON.stringify({ esempio: true }),
}

describe('POST /api/preventivi/[id]/revisioni', () => {
  it('aggiunge una nuova revisione numero 2 a un preventivo esistente', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const risposta = await POST(new Request(`http://localhost/api/preventivi/${preventivo.id}/revisioni`, { method: 'POST', body: JSON.stringify(CORPO_BASE) }), {
      params: Promise.resolve({ id: preventivo.id }),
    })
    expect(risposta.status).toBe(201)
    const corpo = await risposta.json()
    expect(corpo.numero).toBe(2)
  })
})
```

- [ ] **Step 6: Eseguire e verificare che fallisca**

Run: `npm test -- "src/app/api/preventivi/\[id\]/revisioni/route.test.ts"`
Expected: FAIL — `./route` non esiste.

- [ ] **Step 7: Implementare `src/app/api/preventivi/[id]/revisioni/route.ts`**

```ts
import { prisma } from '@/server/prisma'
import { aggiungiRevisione } from '@/server/preventivi-repo'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const corpo = await request.json()
  try {
    const revisione = await aggiungiRevisione(prisma, id, corpo)
    return Response.json(revisione, { status: 201 })
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    return Response.json({ errore: messaggio }, { status: 409 })
  }
}
```

- [ ] **Step 8: Eseguire e verificare che passi**

Run: `npm test -- "src/app/api/preventivi/\[id\]/revisioni/route.test.ts"`
Expected: PASS.

- [ ] **Step 9: Scrivere il test di `GET`/`PUT /api/preventivi/[id]/revisioni/[numero]` (fallisce)**

```ts
// src/app/api/preventivi/[id]/revisioni/[numero]/route.test.ts
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { applicaMigrazioni, creaClientDiTest } from '@/server/test-db'
import { creaPreventivoConBozza } from '@/server/preventivi-repo'

vi.mock('@/server/prisma', () => ({ prisma: creaClientDiTest() }))

const { prisma: db } = await import('@/server/prisma')
const { GET, PUT } = await import('./route')

beforeAll(async () => {
  await applicaMigrazioni(db)
})

beforeEach(async () => {
  await db.revisione.deleteMany()
  await db.preventivo.deleteMany()
  await db.cliente.deleteMany()
})

const CORPO_BASE = {
  cliente: { nome: 'Crivellaro Mariano', comune: 'Trissino', provincia: 'VI' },
  protocollo: '2026059',
  oggetto: 'Fornitura e posa in opera di casa in legno MHM',
  progettista: '',
  data: '2026-08-07',
  luogo: 'Trissino',
  statoForm: JSON.stringify({ esempio: true }),
  inputCalcolo: JSON.stringify({ esempio: true }),
  risultatoCalcolo: JSON.stringify({ esempio: true }),
}

describe('GET /api/preventivi/[id]/revisioni/[numero]', () => {
  it('carica la revisione richiesta', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const risposta = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(200)
    const corpo = await risposta.json()
    expect(corpo.numero).toBe(1)
  })

  it('risponde 404 se la revisione non esiste', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const risposta = await GET(new Request('http://localhost'), {
      params: Promise.resolve({ id: preventivo.id, numero: '99' }),
    })
    expect(risposta.status).toBe(404)
  })
})

describe('PUT /api/preventivi/[id]/revisioni/[numero]', () => {
  it('aggiorna una bozza esistente', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    const nuovoStatoForm = JSON.stringify({ modificato: true })
    const risposta = await PUT(
      new Request('http://localhost', { method: 'PUT', body: JSON.stringify({ ...CORPO_BASE, statoForm: nuovoStatoForm }) }),
      { params: Promise.resolve({ id: preventivo.id, numero: '1' }) },
    )
    expect(risposta.status).toBe(200)
    const corpo = await risposta.json()
    expect(corpo.statoForm).toBe(nuovoStatoForm)
  })

  it('risponde 409 su una revisione non in bozza', async () => {
    const preventivo = await creaPreventivoConBozza(db, CORPO_BASE)
    await db.revisione.update({
      where: { preventivoId_numero: { preventivoId: preventivo.id, numero: 1 } },
      data: { stato: 'firmata' },
    })
    const risposta = await PUT(new Request('http://localhost', { method: 'PUT', body: JSON.stringify(CORPO_BASE) }), {
      params: Promise.resolve({ id: preventivo.id, numero: '1' }),
    })
    expect(risposta.status).toBe(409)
  })
})
```

- [ ] **Step 10: Eseguire e verificare che fallisca**

Run: `npm test -- "src/app/api/preventivi/\[id\]/revisioni/\[numero\]/route.test.ts"`
Expected: FAIL — `./route` non esiste.

- [ ] **Step 11: Implementare `src/app/api/preventivi/[id]/revisioni/[numero]/route.ts`**

```ts
import { prisma } from '@/server/prisma'
import { aggiornaBozza, caricaRevisione } from '@/server/preventivi-repo'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero } = await params
  const revisione = await caricaRevisione(prisma, id, Number(numero))
  if (!revisione) return Response.json({ errore: 'Revisione non trovata' }, { status: 404 })
  return Response.json(revisione)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; numero: string }> }) {
  const { id, numero } = await params
  const corpo = await request.json()
  try {
    const revisione = await aggiornaBozza(prisma, id, Number(numero), corpo)
    return Response.json(revisione)
  } catch (errore) {
    const messaggio = errore instanceof Error ? errore.message : 'Errore sconosciuto'
    return Response.json({ errore: messaggio }, { status: 409 })
  }
}
```

- [ ] **Step 12: Eseguire e verificare che passi**

Run: `npm test -- "src/app/api/preventivi/\[id\]/revisioni/\[numero\]/route.test.ts"`
Expected: PASS.

- [ ] **Step 13: Verificare tutto il repo**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 14: Commit**

```bash
git add src/app/api/preventivi
git commit -m "feat(api): route handler per creare, elencare, aggiungere e aggiornare preventivi/revisioni"
```

---

### Task 11: UI — bottone "Salva bozza"

**Files:**
- Create: `src/app/preventivi/WizardConSalvataggio.tsx`
- Modify: `src/app/preventivi/nuovo/page.tsx`

**Interfaces:**
- Consuma: `FormStrutturato`, `PannelloPreview`, `inputCalcoloDaStato` (esistenti), `eseguiCalcolo` da `@/domain/calcolo`, gli endpoint del Task 10.
- Produce: `WizardConSalvataggio` — riusato invariato dal Task 13 (pagina di riapertura di una bozza).

Nessun test automatico (componente client con `fetch`+`useState`, stesso limite già accettato nel piano principale per `FormStrutturato`/`PannelloPreview` — "per restare testabile senza Testing Library/jsdom, la logica pura è isolata e testata, il componente React la usa ma non è testato a sua volta"). Verifica manuale nel browser.

- [ ] **Step 1: Creare `src/app/preventivi/WizardConSalvataggio.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { eseguiCalcolo } from '@/domain/calcolo'
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
}

export function WizardConSalvataggio({ statoIniziale, preventivoEsistente }: Props) {
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
        if (!risposta.ok) throw new Error('Salvataggio fallito')
      } else {
        const risposta = await fetch('/api/preventivi', { method: 'POST', body: JSON.stringify(corpo) })
        if (!risposta.ok) throw new Error('Salvataggio fallito')
        const preventivo = await risposta.json()
        setSalvataggio({ id: preventivo.id, numero: preventivo.revisioni[0].numero })
      }
      setStatoSalvataggio('inattivo')
    } catch {
      setStatoSalvataggio('errore')
    }
  }

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      <div style={{ flex: 1 }}>
        <FormStrutturato statoIniziale={statoIniziale} onCambiamento={setStato} />
        <button type="button" onClick={salvaBozza} disabled={!stato || statoSalvataggio === 'in-corso'}>
          Salva bozza
        </button>
        {statoSalvataggio === 'errore' && <p role="alert">Salvataggio fallito, riprova.</p>}
      </div>
      <div style={{ flex: 1 }}>{stato && <PannelloPreview stato={stato} input={inputCalcoloDaStato(stato)} />}</div>
    </div>
  )
}
```

- [ ] **Step 2: Sostituire il corpo di `src/app/preventivi/nuovo/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { ChatApertura } from './ChatApertura'
import { WizardConSalvataggio } from '../WizardConSalvataggio'
import type { StatoForm } from './stato-form'

export default function NuovoPreventivo() {
  const [statoIniziale, setStatoIniziale] = useState<Partial<StatoForm>>({})
  const [versioneEstrazione, setVersioneEstrazione] = useState(0)

  return (
    <div>
      <ChatApertura
        onEstrazioneCompletata={(parziale) => {
          setStatoIniziale(parziale)
          setVersioneEstrazione((v) => v + 1)
        }}
      />
      <WizardConSalvataggio key={versioneEstrazione} statoIniziale={statoIniziale} />
    </div>
  )
}
```

- [ ] **Step 3: Verificare compilazione e test**

Run: `npm run typecheck && npm test`
Expected: entrambi PASS.

- [ ] **Step 4: Verifica manuale nel browser**

```bash
npm run dev
```

Apri `/preventivi/nuovo`, compila i campi minimi (cliente, protocollo, oggetto, data, luogo), clicca "Salva bozza". Apri gli strumenti di rete del browser e conferma una `POST /api/preventivi` con risposta 201. Modifica un campo e clicca di nuovo "Salva bozza": conferma questa volta una `PUT /api/preventivi/<id>/revisioni/1`.

- [ ] **Step 5: Commit**

```bash
git add src/app/preventivi/WizardConSalvataggio.tsx src/app/preventivi/nuovo/page.tsx
git commit -m "feat(wizard): bottone salva bozza, crea o aggiorna la revisione via API"
```

---

### Task 12: Pagina elenco preventivi

**Files:**
- Create: `src/app/preventivi/page.tsx`

**Interfaces:**
- Consuma: `prisma` (Task 9), `elencaPreventivi()` (Task 9).

**Nota.** Le pagine (Server Component) chiamano `elencaPreventivi(prisma)`/`caricaRevisione(prisma, ...)` **direttamente**, non via `fetch` alle proprie route HTTP — è l'idiom standard di Next.js App Router per i Server Component (evita un round-trip di rete verso se stessi). Le route del Task 10 restano per le scritture lato client (`WizardConSalvataggio`, che gira nel browser e non può importare `prisma` direttamente).

Nessun test automatico (Server Component asincrono, non renderizzato da Vitest in questo progetto che non usa jsdom/Testing Library). Verifica manuale nel browser.

- [ ] **Step 1: Creare `src/app/preventivi/page.tsx`**

```tsx
import Link from 'next/link'
import { prisma } from '@/server/prisma'
import { elencaPreventivi } from '@/server/preventivi-repo'

export default async function ElencoPreventivi() {
  const preventivi = await elencaPreventivi(prisma)

  return (
    <div>
      <h1>Preventivi</h1>
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Protocollo</th>
            <th>Ultima revisione</th>
            <th>Stato</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {preventivi.map((p) => (
            <tr key={p.id}>
              <td>{p.cliente.nome}</td>
              <td>{p.protocollo}</td>
              <td>{p.ultimaRevisione?.numero ?? '—'}</td>
              <td>{p.ultimaRevisione?.stato ?? '—'}</td>
              <td>
                {p.ultimaRevisione && <Link href={`/preventivi/${p.id}/revisioni/${p.ultimaRevisione.numero}`}>Apri</Link>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verificare compilazione**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verifica manuale nel browser**

```bash
npm run dev
```

Salva almeno una bozza da `/preventivi/nuovo` (Task 11), poi apri `/preventivi` e conferma che compaia in elenco con un link "Apri".

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/page.tsx
git commit -m "feat(wizard): pagina elenco preventivi salvati"
```

---

### Task 13: Pagina di riapertura di una revisione

**Files:**
- Create: `src/app/preventivi/[id]/revisioni/[numero]/page.tsx`

**Interfaces:**
- Consuma: `prisma`, `caricaRevisione()` (Task 9), `deserializzaRevisione<T>()` (Task 8), `WizardConSalvataggio` (Task 11), `PannelloPreview` (esistente).

**Nota su vincolo 6.** Per una revisione **non** in bozza, questa pagina passa a `PannelloPreview` l'`InputCalcolo` **congelato** deserializzato dallo snapshot (`deserializzaRevisione(...).input`), non un `InputCalcolo` ricalcolato da `inputCalcoloDaStato(statoDeserializzato)` con il listino "vivo" corrente — altrimenti una modifica futura a `LISTINO_2026` cambierebbe silenziosamente i numeri di un'offerta già firmata. `PannelloPreview` chiama comunque `eseguiCalcolo(input)` al suo interno: dato lo stesso `input` congelato, il calcolo è deterministico e riproduce esattamente gli stessi numeri (stessa proprietà già verificata in `persistenza.test.ts`, blocco "vincolo 6").

**Nota su come si arriva a una revisione non-bozza.** Questo piano non aggiunge nessuna UI per cambiare `Revisione.stato` da `bozza` a `inviata`/`firmata` — è fuori scope (manca l'export docx che tipicamente accompagna quel passaggio). Per verificare manualmente il ramo di sola lettura di questo task, usa `npx prisma studio` per impostare a mano lo stato di una revisione di test.

Nessun test automatico (Server Component asincrono). Verifica manuale nel browser.

- [ ] **Step 1: Creare `src/app/preventivi/[id]/revisioni/[numero]/page.tsx`**

```tsx
import { prisma } from '@/server/prisma'
import { caricaRevisione } from '@/server/preventivi-repo'
import { deserializzaRevisione } from '@/domain/persistenza'
import { PannelloPreview } from '@/app/preventivi/nuovo/PannelloPreview'
import { WizardConSalvataggio } from '@/app/preventivi/WizardConSalvataggio'
import type { StatoForm } from '@/app/preventivi/nuovo/stato-form'

interface Props {
  params: Promise<{ id: string; numero: string }>
}

export default async function RiapriRevisione({ params }: Props) {
  const { id, numero } = await params
  const revisione = await caricaRevisione(prisma, id, Number(numero))
  if (!revisione) return <p>Revisione non trovata.</p>

  const { stato, input } = deserializzaRevisione<StatoForm>(
    revisione.statoForm,
    revisione.inputCalcolo,
    revisione.risultatoCalcolo,
  )

  if (revisione.stato === 'bozza') {
    return <WizardConSalvataggio statoIniziale={stato} preventivoEsistente={{ id, numero: revisione.numero }} />
  }

  return (
    <div>
      <p>
        Revisione {revisione.numero} — stato: {revisione.stato} (sola lettura)
      </p>
      <PannelloPreview stato={stato} input={input} />
    </div>
  )
}
```

- [ ] **Step 2: Verificare compilazione**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Verifica manuale — ramo bozza**

```bash
npm run dev
```

Salva una bozza da `/preventivi/nuovo`, poi apri `/preventivi` e clicca "Apri": conferma che `FormStrutturato` si ripopoli con i valori salvati e che "Salva bozza" ora esegua un `PUT` (stesso `id`/`numero`), non un nuovo `POST`.

- [ ] **Step 4: Verifica manuale — ramo sola lettura**

```bash
npx prisma studio
```

Imposta manualmente `stato: "firmata"` sulla revisione appena salvata. Ricarica la stessa pagina `/preventivi/<id>/revisioni/<numero>`: conferma che compaia solo `PannelloPreview` in sola lettura, senza il form editabile né il bottone "Salva bozza".

- [ ] **Step 5: Commit**

```bash
git add src/app/preventivi/[id]/revisioni/[numero]/page.tsx
git commit -m "feat(wizard): pagina di riapertura revisione, editabile in bozza e sola lettura altrimenti"
```

---

## Fuori scope (invariato dallo spec)

- `esportaOfferta()`/`InputEsportazione` non cablati a `StatoForm`.
- Nessuna voce di catalogo per `copertura: 'piano'`.
- Nessuna estensione dell'estrazione AI per i nuovi campi.
- Nessuna cancellazione di preventivi/revisioni.
- Nessuna autenticazione sulle nuove route.
- Nessuna UI per promuovere una revisione da `bozza` a `inviata`/`firmata` (Task 13, nota).
