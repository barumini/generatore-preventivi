# Chat di apertura conversazionale + campi mancanti (progettista, luogo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far sì che "Apertura rapida" catturi `progettista` e `luogo` (oggi persi perché lo schema di estrazione non li prevede) e diventi una vera chat: risposte di follow-up sui campi mancanti nello stesso thread, non in un riquadro separato.

**Architecture:** Estendere lo schema/prompt di estrazione con due campi opzionali, dare a `oggetto` un default fisso (mai chiesto via AI), e riscrivere `ChatApertura.tsx` da "un textarea + un bottone" a un thread di messaggi con un'unica casella persistente: ogni invio (primo messaggio o risposta successiva) concatena il testo e ri-esegue l'estrazione da zero sul testo cumulativo — nessun merge manuale di campi lato client.

**Tech Stack:** TypeScript, React (client component), Zod (validazione schema estrazione), Vitest.

## Global Constraints

- L'AI non decide mai prezzi/importi (CLAUDE.md #7) — non toccato da questo lavoro, ma nessuna modifica deve avvicinarsi a quel confine.
- I test automatici vivono solo per la logica TS pura (`src/domain/`, e ora anche i piccoli helper puri estratti da questo lavoro); il progetto non ha infrastruttura di test per componenti React — nessun task introduce test per `.tsx`.
- `luogo`, se assente nel testo, si deduce dal comune del cliente e non va **mai** in `campiMancanti`.
- `oggetto` non è mai richiesto via AI o dialogo: è sempre la stringa fissa `'Fornitura e posa in opera di casa in legno MHM'`.
- Stile commenti: nessun commento che spiega COSA fa il codice; solo dove il PERCHÉ non è ovvio (constraint da CLAUDE.md, già seguito nei file esistenti).

---

### Task 1: Schema di estrazione — `progettista` e `luogo`

**Files:**
- Modify: `src/ai/estrazione.ts:4-16` (schema), `src/ai/estrazione.ts:42-62` (prompt)
- Test: `src/ai/estrazione.test.ts`

**Interfaces:**
- Produce: `CampiEstratti` guadagna due proprietà opzionali, `progettista?: string` e `luogo?: string`, che Task 2 e Task 4 consumano.

- [ ] **Step 1: Scrivi il test che verifica che `progettista` e `luogo` sopravvivano alla validazione Zod**

Aggiungi in fondo al blocco `describe('estraiCampi', ...)` esistente in `src/ai/estrazione.test.ts` (dopo il test `'valida e restituisce i campi quando il client risponde con JSON corretto'`, riga 31):

```ts
  it('accetta progettista e luogo quando presenti nella risposta', async () => {
    const risposta = JSON.stringify({
      cliente: { nome: 'Rossi' },
      superfici: [],
      progettista: 'Mario Rossi',
      luogo: 'Bassano del Grappa',
      campiMancanti: [],
    })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.progettista).toBe('Mario Rossi')
    expect(campi.luogo).toBe('Bassano del Grappa')
  })

  it('accetta una risposta senza progettista né luogo (entrambi opzionali)', async () => {
    const risposta = JSON.stringify({ cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] })

    const campi = await estraiCampi('testo qualsiasi', clienteFinto(risposta))

    expect(campi.progettista).toBeUndefined()
    expect(campi.luogo).toBeUndefined()
  })
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/ai/estrazione.test.ts`
Expected: FAIL — `progettista`/`luogo` non esistono ancora sullo schema Zod, quindi `campi.progettista`/`campi.luogo` sono `undefined` di fatto già oggi... ma il test deve fallire per un altro motivo: senza le proprietà nello schema, Zod le rimuove silenziosamente da `risultato.data` solo se lo schema è `strict()` — qui NON lo è (`z.object` di default è "strip", cioè rimuove le chiavi non dichiarate). Quindi il primo test FALLISCE (`campi.progettista` è `undefined` invece di `'Mario Rossi'`), il secondo PASSA già. Conferma che il primo test fallisce con questo comando prima di continuare.

- [ ] **Step 3: Aggiungi i due campi allo schema**

In `src/ai/estrazione.ts`, modifica `SchemaCampiEstratti` (righe 4-16):

```ts
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
  campiMancanti: z.array(z.string()).default([]),
})
```

- [ ] **Step 4: Aggiorna `PROMPT_SISTEMA` con i due nuovi campi e l'istruzione su `luogo`**

Sostituisci l'intero blocco `PROMPT_SISTEMA` (righe 42-62) con:

```ts
export const PROMPT_SISTEMA = `Estrai dal testo dell'utente i campi di un preventivo per case in legno FBE WoodLiving.
Rispondi SOLO con un oggetto JSON con questa forma, senza markdown:
{
  "cliente": { "nome": string, "comune"?: string, "provincia"?: string },
  "protocollo"?: string,
  "progettista"?: string,
  "luogo"?: string,
  "superfici": [{ "piano": string, "valoreLordo": string }],
  "tipoCopertura"?: "piano" | "falde",
  "finituraEsterna"?: "intonaco" | "rivestimento",
  "pacchetto"?: "grezzo" | "grezzo avanzato" | "chiavi in mano",
  "campiMancanti": string[]
}
Il campo "piano" di ogni superficie deve usare ESATTAMENTE una di queste stringhe,
comprese maiuscole e minuscole così come sono scritte:
${PIANI_CANONICI.map((nome) => `- "${nome}"`).join('\n')}
Esempi di normalizzazione attesa: "piano terra" → "Piano Terra"; "PT" → "Piano Terra";
"primo piano" → "Piano Primo"; "mansarda"/"sottotetto" → "Piano sottotetto";
"box auto"/"autorimessa" → "Garage".
Se un piano citato nel testo non corrisponde a nessuna di queste voci, riportalo come
lo trovi e aggiungilo a campiMancanti: sarà corretto a mano.

Se "luogo" non è specificato esplicitamente nel testo, NON aggiungerlo a campiMancanti:
verrà dedotto automaticamente dal comune del cliente.

Il testo può contenere più affermazioni scritte in momenti diversi (una conversazione
a turni): se una stessa informazione compare più volte, usa l'ultima menzionata.

Se un campo non è menzionato nel testo, ometterlo o aggiungerlo a campiMancanti. Non inventare valori.`
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npx vitest run src/ai/estrazione.test.ts`
Expected: PASS — tutti i test in `src/ai/estrazione.test.ts`, incluso `'enumera esplicitamente i nomi piano canonici'` (il prompt contiene ancora tutti i nomi di `PIANI_CANONICI`, solo con testo aggiuntivo attorno).

- [ ] **Step 6: Commit**

```bash
git add src/ai/estrazione.ts src/ai/estrazione.test.ts
git commit -m "feat(estrazione): aggiungi progettista e luogo allo schema di estrazione"
```

---

### Task 2: `OGGETTO_STANDARD` e mappatura di `progettista`/`luogo`/`oggetto`

**Files:**
- Modify: `src/app/preventivi/nuovo/stato-form.ts:42-47` (aggiungi costante)
- Modify: `src/app/preventivi/nuovo/mappatura-estrazione.ts`
- Test: `src/app/preventivi/nuovo/mappatura-estrazione.test.ts`

**Interfaces:**
- Consuma: `CampiEstratti.progettista`, `CampiEstratti.luogo` (Task 1).
- Produce: `OGGETTO_STANDARD: string` esportata da `stato-form.ts`, usata da `mappatura-estrazione.ts` e disponibile per Task 4/verifica manuale.

- [ ] **Step 1: Scrivi i test per la nuova mappatura**

Aggiungi in fondo al file `src/app/preventivi/nuovo/mappatura-estrazione.test.ts` (dentro il `describe('statoFormDaCampiEstratti', ...)` esistente, prima della riga di chiusura `})` finale):

```ts
  it('mappa progettista quando presente', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi' },
      superfici: [],
      progettista: 'Mario Rossi',
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).progettista).toBe('Mario Rossi')
  })

  it('non imposta progettista quando assente, lasciandolo da compilare nel form', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: ['progettista'] }

    expect(statoFormDaCampiEstratti(campi).progettista).toBeUndefined()
  })

  it('deduce luogo dal comune del cliente quando non specificato esplicitamente', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi', comune: 'Trissino' },
      superfici: [],
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).luogo).toBe('Trissino')
  })

  it('usa il luogo esplicito quando presente, invece del comune', () => {
    const campi: CampiEstratti = {
      cliente: { nome: 'Rossi', comune: 'Trissino' },
      superfici: [],
      luogo: 'Bassano del Grappa',
      campiMancanti: [],
    }

    expect(statoFormDaCampiEstratti(campi).luogo).toBe('Bassano del Grappa')
  })

  it('senza comune né luogo, luogo è stringa vuota', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] }

    expect(statoFormDaCampiEstratti(campi).luogo).toBe('')
  })

  it('imposta sempre oggetto alla frase standard, indipendentemente dall\'input', () => {
    const campi: CampiEstratti = { cliente: { nome: 'Rossi' }, superfici: [], campiMancanti: [] }

    expect(statoFormDaCampiEstratti(campi).oggetto).toBe(OGGETTO_STANDARD)
  })
```

Aggiungi anche l'import in cima al file (riga 4, accanto agli altri import da `@/domain/geometria`):

```ts
import { OGGETTO_STANDARD } from './stato-form'
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/app/preventivi/nuovo/mappatura-estrazione.test.ts`
Expected: FAIL — `OGGETTO_STANDARD` non esiste ancora (errore di import/compilazione), e comunque `progettista`/`luogo`/`oggetto` non sono ancora mappati.

- [ ] **Step 3: Aggiungi `OGGETTO_STANDARD` a `stato-form.ts`**

In `src/app/preventivi/nuovo/stato-form.ts`, subito dopo la costante `CARATTERISTICHE_DEFAULT` (dopo la riga 47):

```ts
export const OGGETTO_STANDARD = 'Fornitura e posa in opera di casa in legno MHM'
```

- [ ] **Step 4: Aggiorna `mappatura-estrazione.ts`**

Sostituisci l'intero contenuto di `src/app/preventivi/nuovo/mappatura-estrazione.ts` con:

```ts
// src/app/preventivi/nuovo/mappatura-estrazione.ts
import type { CampiEstratti } from '@/ai/estrazione'
import { normalizzaNomePiano } from '@/domain/geometria'
import { CARATTERISTICHE_DEFAULT, livelliDaPacchetto, OGGETTO_STANDARD, type StatoForm } from './stato-form'

export function statoFormDaCampiEstratti(campi: CampiEstratti): Partial<StatoForm> {
  const parziale: Partial<StatoForm> = {
    cliente: {
      nome: campi.cliente.nome,
      comune: campi.cliente.comune ?? '',
      provincia: campi.cliente.provincia ?? '',
    },
    // Il prompt chiede i nomi canonici, ma il modello può comunque restituire
    // "Piano terra" o "garage": il dominio confronta per stringa esatta, quindi
    // una variante non normalizzata sposterebbe i prezzi in silenzio. Un nome
    // che non si riconosce resta com'è e il form lo segnala da correggere.
    superfici: campi.superfici.map((s) => ({ ...s, piano: normalizzaNomePiano(s.piano) })),
    // Il form si rimonta da zero a ogni estrazione (key={versioneEstrazione} in page.tsx),
    // quindi qui è sicuro comporre l'oggetto completo invece di un default parziale.
    caratteristiche: {
      ...CARATTERISTICHE_DEFAULT,
      ...(campi.tipoCopertura ? { copertura: campi.tipoCopertura } : {}),
      ...(campi.finituraEsterna ? { finituraEsterna: campi.finituraEsterna } : {}),
    },
    // Quasi sempre la stessa frase per ogni preventivo MHM: mai richiesta via AI/dialogo,
    // resta comunque modificabile a mano nel tab Anagrafica.
    oggetto: OGGETTO_STANDARD,
    // Nessuna semantica documentata oltre "luogo associato alla revisione": il golden
    // case Crivellaro lo valorizza col comune cliente, e questo fallback segue quel
    // precedente finché non emerge una regola diversa.
    luogo: campi.luogo ?? campi.cliente.comune ?? '',
  }

  if (campi.protocollo) parziale.protocollo = campi.protocollo
  if (campi.progettista) parziale.progettista = campi.progettista
  if (campi.pacchetto) parziale.livelli = livelliDaPacchetto(campi.pacchetto)

  return parziale
}
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npx vitest run src/app/preventivi/nuovo/mappatura-estrazione.test.ts`
Expected: PASS — tutti i test del file, inclusi quelli preesistenti (nessuna regressione: `oggetto`/`luogo` non erano prima verificati come `undefined` da nessun test esistente).

- [ ] **Step 6: Esegui l'intera suite per assicurarti che nulla si sia rotto altrove**

Run: `npm test`
Expected: PASS — tutti i file, incluso `src/app/preventivi/nuovo/stato-form.test.ts` (non tocca `OGGETTO_STANDARD` ma verifica che il file compili ancora) e `src/documento/export-docx.test.ts` (golden case Crivellaro, non tocca `mappatura-estrazione.ts` quindi non impattato).

- [ ] **Step 7: Commit**

```bash
git add src/app/preventivi/nuovo/stato-form.ts src/app/preventivi/nuovo/mappatura-estrazione.ts src/app/preventivi/nuovo/mappatura-estrazione.test.ts
git commit -m "feat(wizard): mappa progettista/luogo estratti e fissa oggetto alla frase standard"
```

---

### Task 3: Helper puri della conversazione (`conversazione-apertura.ts`)

**Files:**
- Create: `src/app/preventivi/nuovo/conversazione-apertura.ts`
- Test: `src/app/preventivi/nuovo/conversazione-apertura.test.ts`

**Interfaces:**
- Produce (consumati da Task 4):
  - `interface Messaggio { ruolo: 'utente' | 'assistente'; testo: string; errore?: boolean }`
  - `function testoCumulativo(cronologia: Messaggio[]): string`
  - `function messaggioAssistente(campiMancanti: string[]): string`

- [ ] **Step 1: Scrivi il file di test (il modulo non esiste ancora)**

Crea `src/app/preventivi/nuovo/conversazione-apertura.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { messaggioAssistente, testoCumulativo, type Messaggio } from './conversazione-apertura'

describe('testoCumulativo', () => {
  it('concatena solo i messaggi utente, in ordine, ignorando quelli assistente', () => {
    const cronologia: Messaggio[] = [
      { ruolo: 'utente', testo: 'casa per Rossi' },
      { ruolo: 'assistente', testo: 'Ho capito quasi tutto — mi manca ancora: progettista.' },
      { ruolo: 'utente', testo: 'il progettista è Mario Rossi' },
    ]

    expect(testoCumulativo(cronologia)).toBe('casa per Rossi\nil progettista è Mario Rossi')
  })

  it('restituisce stringa vuota su cronologia vuota', () => {
    expect(testoCumulativo([])).toBe('')
  })
})

describe('messaggioAssistente', () => {
  it('elenca i campi mancanti separati da virgola quando ce ne sono', () => {
    expect(messaggioAssistente(['progettista', 'comune'])).toBe(
      'Ho capito quasi tutto — mi manca ancora: progettista, comune.',
    )
  })

  it('conferma il completamento quando non manca nulla', () => {
    expect(messaggioAssistente([])).toBe('Perfetto, ho tutto quello che serve.')
  })
})
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/app/preventivi/nuovo/conversazione-apertura.test.ts`
Expected: FAIL — il modulo `./conversazione-apertura` non esiste (errore di risoluzione import).

- [ ] **Step 3: Crea il modulo**

Crea `src/app/preventivi/nuovo/conversazione-apertura.ts`:

```ts
// src/app/preventivi/nuovo/conversazione-apertura.ts
export interface Messaggio {
  ruolo: 'utente' | 'assistente'
  testo: string
  errore?: boolean
}

// Solo i turni utente alimentano l'estrazione: i messaggi assistente sono feedback
// sintetizzato in locale (non generato dal modello) — rimandarli come input
// confonderebbe l'estrazione con la sua stessa risposta precedente.
export function testoCumulativo(cronologia: Messaggio[]): string {
  return cronologia
    .filter((messaggio) => messaggio.ruolo === 'utente')
    .map((messaggio) => messaggio.testo)
    .join('\n')
}

export function messaggioAssistente(campiMancanti: string[]): string {
  return campiMancanti.length > 0
    ? `Ho capito quasi tutto — mi manca ancora: ${campiMancanti.join(', ')}.`
    : 'Perfetto, ho tutto quello che serve.'
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/app/preventivi/nuovo/conversazione-apertura.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/preventivi/nuovo/conversazione-apertura.ts src/app/preventivi/nuovo/conversazione-apertura.test.ts
git commit -m "feat(wizard): estrai helper puri della conversazione di apertura"
```

---

### Task 4: Riscrivi `ChatApertura.tsx` come thread conversazionale

**Files:**
- Modify: `src/app/preventivi/nuovo/ChatApertura.tsx` (riscrittura completa)

**Interfaces:**
- Consuma: `Messaggio`, `testoCumulativo`, `messaggioAssistente` (Task 3); `statoFormDaCampiEstratti` (già esistente, ora produce anche `progettista`/`luogo`/`oggetto` da Task 2).
- Produce: `Props.onEstrazioneCompletata` cambia firma da `(parziale: Partial<StatoForm>, campiMancanti: string[]) => void` a `(parziale: Partial<StatoForm>) => void` — il secondo parametro era già ignorato dall'unico chiamante (`src/app/preventivi/nuovo/page.tsx`), che non richiede modifiche.

Non ci sono step TDD qui: il componente è UI (`.tsx`, nessuna infrastruttura di test — vedi Global Constraints). La verifica è manuale, nel Task 5.

- [ ] **Step 1: Sostituisci l'intero contenuto di `ChatApertura.tsx`**

```tsx
// src/app/preventivi/nuovo/ChatApertura.tsx
'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import { controlClassName } from '../ui/Field'
import { statoFormDaCampiEstratti } from './mappatura-estrazione'
import { messaggioAssistente, testoCumulativo, type Messaggio } from './conversazione-apertura'
import type { StatoForm } from './stato-form'

interface Props {
  onEstrazioneCompletata: (parziale: Partial<StatoForm>) => void
}

export function ChatApertura({ onEstrazioneCompletata }: Props) {
  const [messaggi, setMessaggi] = useState<Messaggio[]>([])
  const [bozza, setBozza] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  async function invia() {
    const testoUtente = bozza.trim()
    if (testoUtente === '') return

    const cronologia: Messaggio[] = [...messaggi, { ruolo: 'utente', testo: testoUtente }]
    setMessaggi(cronologia)
    setBozza('')
    setCaricamento(true)

    try {
      const risposta = await fetch('/api/estrazione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testo: testoCumulativo(cronologia) }),
      })
      if (!risposta.ok) throw new Error('Estrazione fallita')
      const campi = await risposta.json()
      onEstrazioneCompletata(statoFormDaCampiEstratti(campi))
      setMessaggi([...cronologia, { ruolo: 'assistente', testo: messaggioAssistente(campi.campiMancanti) }])
    } catch (e) {
      const testoErrore = e instanceof Error ? e.message : 'Errore imprevisto'
      setMessaggi([...cronologia, { ruolo: 'assistente', testo: testoErrore, errore: true }])
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

      {messaggi.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {messaggi.map((messaggio, i) => (
            <div
              key={i}
              className={`rounded-md px-3 py-2 text-sm ${
                messaggio.errore
                  ? 'bg-error/5 text-error'
                  : messaggio.ruolo === 'utente'
                    ? 'bg-border-warm/20 text-text'
                    : 'bg-accent/5 text-text-secondary'
              }`}
            >
              <span className="font-semibold">{messaggio.ruolo === 'utente' ? 'Tu' : 'FBE'}:</span> {messaggio.testo}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={bozza}
        onChange={(e) => setBozza(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            invia()
          }
        }}
        placeholder={
          messaggi.length === 0
            ? 'Descrivi il progetto in una frase: cliente, località, superfici, pacchetto...'
            : 'Rispondi qui...'
        }
        rows={3}
        className={`${controlClassName} mb-3 resize-none`}
      />
      <Button onClick={invia} disabled={caricamento || bozza.trim() === ''}>
        {caricamento ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Sto leggendo...
          </span>
        ) : (
          'Invia'
        )}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Verifica che il progetto compili**

Run: `npm run typecheck`
Expected: nessun errore. In particolare, verifica che `src/app/preventivi/nuovo/page.tsx` compili ancora senza modifiche: la sua callback `onEstrazioneCompletata={(parziale) => { setStatoIniziale(parziale); setVersioneEstrazione((v) => v + 1) }}` accetta un solo parametro, compatibile con la nuova firma a un parametro.

- [ ] **Step 3: Esegui l'intera suite di test**

Run: `npm test`
Expected: PASS — questo task non tocca file con test dedicati, ma verifica che nessuna suite esistente dipenda dalla vecchia firma a due parametri di `onEstrazioneCompletata` (nessuna lo fa: è solo un tipo TS, non testato a livello di dominio).

- [ ] **Step 4: Commit**

```bash
git add src/app/preventivi/nuovo/ChatApertura.tsx
git commit -m "feat(wizard): trasforma Apertura rapida in un thread conversazionale"
```

---

### Task 5: Verifica manuale end-to-end nel browser

**Files:** nessuno (solo verifica)

- [ ] **Step 1: Avvia il dev server e apri il wizard**

Usa il Browser pane per navigare su `http://localhost:3000/preventivi/nuovo` (avvia il dev server con `fbe-dev` da `.claude/launch.json` se non è già attivo).

- [ ] **Step 2: Riproduci lo scenario che ha fatto emergere il problema**

Nel campo "Apertura rapida" scrivi:
```
Progetto per la realizzazione casa in legno, cliente Pisanu Matteo, residente in Grisignano di Zocco, provincia di Vicenza, progettista sarà Mario Rossi
```
Premi Invio o clicca "Invia". Verifica nel tab Anagrafica che **Progettista = "Mario Rossi"** (prima era vuoto) e **Luogo = "Grisignano di Zocco"** (dedotto dal comune). Verifica che **Oggetto = "Fornitura e posa in opera di casa in legno MHM"** anche se non menzionato nel testo.

- [ ] **Step 3: Verifica il thread conversazionale con un campo davvero mancante**

Scrivi una frase che NON menziona il protocollo, es.:
```
Casa in legno per cliente Bianchi, a Schio
```
Invia. Verifica che compaia una bolla assistente tipo "Ho capito quasi tutto — mi manca ancora: protocollo." (il testo esatto dipende da cosa il modello elenca). Nella stessa casella di testo (senza che sia comparso un secondo riquadro separato) scrivi:
```
il protocollo è 2026099
```
Invia di nuovo. Verifica che il tab Anagrafica mostri ora **Protocollo = "2026099"** mantenendo Cliente = "Bianchi" e Comune = "Schio" già presenti dal turno precedente (nessuna perdita di dati), e che compaia una bolla assistente finale tipo "Perfetto, ho tutto quello che serve." (o un elenco più corto se restano altri campi mancanti non risolti).

- [ ] **Step 4: Verifica il caso di errore**

Ferma temporaneamente LM Studio (o disattiva il server locale) e invia un nuovo messaggio. Verifica che compaia una bolla assistente di errore (stile visivamente distinto, es. testo rosso) invece di un crash o di un riquadro Alert separato. Riavvia LM Studio prima di continuare.

- [ ] **Step 5: Rilancia l'intera suite una ultima volta**

Run: `npm test && npm run typecheck`
Expected: PASS su entrambi.
