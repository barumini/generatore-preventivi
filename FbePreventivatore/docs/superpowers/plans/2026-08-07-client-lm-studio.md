# Client LLM locale (LM Studio) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire `ClienteEstrazioneAnthropic` (client cloud Anthropic) con `ClienteEstrazioneLMStudio`, un client che parla con un modello locale servito da LM Studio, dietro l'interfaccia `ClienteEstrazione` già esistente in `src/ai/estrazione.ts`.

**Architettura:** Nessuna modifica all'interfaccia `ClienteEstrazione`, a `estraiCampi()`, allo zod schema, o alla mappatura verso `StatoForm` — tutti indipendenti dal backend LLM. Il nuovo client parla via `fetch` nativo (Node 20, nessuna libreria aggiuntiva) con l'endpoint OpenAI-compatible che LM Studio espone in locale, configurato via variabili d'ambiente.

**Tech Stack:** TypeScript, `fetch`/`Response` nativi di Node 20, Vitest (`vi.stubGlobal`/`vi.stubEnv` per mockare rete e variabili d'ambiente senza chiamate reali).

## Global Constraints

- Sostituzione **completa**: `ClienteEstrazioneAnthropic` e la dipendenza `@anthropic-ai/sdk` vengono rimossi, non affiancati.
- `LM_STUDIO_BASE_URL` ha un default (`http://localhost:1234/v1`); `LM_STUDIO_MODEL` **non ha default** — il costruttore lancia un errore leggibile se manca, subito, prima di qualunque chiamata di rete.
- Ogni errore lanciato dal client ha il prefisso `Estrazione fallita: ` (stessa convenzione già usata nel resto del modulo).
- Nessuna chiamata di rete vera nei test: `global.fetch` va mockato con `vi.stubGlobal`.
- `PROMPT_SISTEMA` non cambia: nessun campo di prezzo o importo, coerente con CLAUDE.md vincolo 7 (l'AI non decide mai prezzi).
- File toccati: solo `src/ai/estrazione.ts`, `src/ai/estrazione.test.ts`, `src/app/api/estrazione/route.ts`, `package.json`, `.gitignore`, `.env.example` (nuovo). Nessun altro file del progetto dipende dal backend LLM.

---

### Task 1: `ClienteEstrazioneLMStudio` — client e test

**Files:**
- Modify: `src/ai/estrazione.ts` (rimuove `ClienteEstrazioneAnthropic` e l'import di `@anthropic-ai/sdk`, aggiunge `ClienteEstrazioneLMStudio`)
- Test: `src/ai/estrazione.test.ts` (aggiunge test per il nuovo client; i test esistenti di `estraiCampi`/`PROMPT_SISTEMA` restano invariati)

**Interfaces:**
- Consuma: `ClienteEstrazione` (interfaccia già esistente, invariata), `PROMPT_SISTEMA` (costante già esistente, invariata).
- Produce: `ClienteEstrazioneLMStudio` — classe con costruttore `(baseUrl?: string, modello?: string)` e metodo `estrai(testo: string): Promise<string>` — usata da Task 2 in `route.ts`.

- [ ] **Step 1: Scrivere i test del nuovo client**

Aggiungi questo blocco alla fine di `src/ai/estrazione.test.ts` (non toccare i test esistenti sopra):

```ts
// aggiunta a src/ai/estrazione.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClienteEstrazioneLMStudio } from './estrazione'

describe('ClienteEstrazioneLMStudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('costruisce la richiesta HTTP verso l\'endpoint di default e restituisce il testo della risposta', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'qwen2.5-7b-instruct')
    const fetchFinto = vi.fn(async (url: string, opzioni: RequestInit) => {
      expect(url).toBe('http://localhost:1234/v1/chat/completions')
      const corpo = JSON.parse(opzioni.body as string)
      expect(corpo.model).toBe('qwen2.5-7b-instruct')
      expect(corpo.temperature).toBe(0.1)
      expect(corpo.messages).toEqual([
        { role: 'system', content: expect.any(String) },
        { role: 'user', content: 'casa per Rossi a Vicenza' },
      ])
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"cliente":{"nome":"Rossi"}}' } }] }),
        { status: 200 },
      )
    })
    vi.stubGlobal('fetch', fetchFinto)

    const cliente = new ClienteEstrazioneLMStudio()
    const risultato = await cliente.estrai('casa per Rossi a Vicenza')

    expect(risultato).toBe('{"cliente":{"nome":"Rossi"}}')
    expect(fetchFinto).toHaveBeenCalledTimes(1)
  })

  it('usa LM_STUDIO_BASE_URL personalizzato quando impostato', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubEnv('LM_STUDIO_BASE_URL', 'http://192.168.1.50:1234/v1')
    const fetchFinto = vi.fn(async (url: string) => {
      expect(url).toBe('http://192.168.1.50:1234/v1/chat/completions')
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchFinto)

    await new ClienteEstrazioneLMStudio().estrai('testo')

    expect(fetchFinto).toHaveBeenCalledTimes(1)
  })

  it('lancia un errore leggibile se LM Studio non è raggiungibile', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-test')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('fetch failed')
      }),
    )

    const cliente = new ClienteEstrazioneLMStudio()
    await expect(cliente.estrai('testo')).rejects.toThrow(/LM Studio.*in esecuzione/)
  })

  it('lancia un errore leggibile se LM Studio risponde con uno stato di errore', async () => {
    vi.stubEnv('LM_STUDIO_MODEL', 'modello-inesistente')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('modello non trovato', { status: 404 })))

    const cliente = new ClienteEstrazioneLMStudio()
    await expect(cliente.estrai('testo')).rejects.toThrow(/404/)
  })

  it('lancia un errore se LM_STUDIO_MODEL non è impostata', () => {
    vi.stubEnv('LM_STUDIO_MODEL', undefined)
    expect(() => new ClienteEstrazioneLMStudio()).toThrow(/LM_STUDIO_MODEL/)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npm test -- estrazione`
Expected: FAIL — `ClienteEstrazioneLMStudio` non esiste ancora in `./estrazione`.

- [ ] **Step 3: Rimuovere `ClienteEstrazioneAnthropic` e implementare `ClienteEstrazioneLMStudio`**

In `src/ai/estrazione.ts`:

1. Rimuovi la riga `import Anthropic from '@anthropic-ai/sdk'`.
2. Rimuovi l'intera classe `ClienteEstrazioneAnthropic` (dal commento `// NOTA: l'estrazione LLM...` fino alla sua chiusura `}`).
3. Al suo posto, aggiungi:

```ts
// src/ai/estrazione.ts — sostituisce ClienteEstrazioneAnthropic

function leggiModelloRichiesto(): string {
  const modello = process.env.LM_STUDIO_MODEL
  if (!modello) {
    throw new Error(
      'Estrazione fallita: variabile LM_STUDIO_MODEL non impostata — imposta il nome esatto del modello caricato in LM Studio',
    )
  }
  return modello
}

// NOTA: l'estrazione LLM qui riguarda SOLO campi anagrafici/geometrici dal testo libero
// iniziale (nome cliente, comune, superfici dichiarate, tipo copertura, ecc.).
// L'AI non decide MAI prezzi o importi (vincolo CLAUDE.md #7): quelli vengono dal
// listino parametrico o sono digitati altrove nel flusso.
export class ClienteEstrazioneLMStudio implements ClienteEstrazione {
  private baseUrl: string
  private modello: string

  constructor(
    baseUrl: string = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
    modello: string = leggiModelloRichiesto(),
  ) {
    this.baseUrl = baseUrl
    this.modello = modello
  }

  async estrai(testo: string): Promise<string> {
    let risposta: Response
    try {
      risposta = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modello,
          messages: [
            { role: 'system', content: PROMPT_SISTEMA },
            { role: 'user', content: testo },
          ],
          temperature: 0.1,
        }),
      })
    } catch {
      throw new Error(
        `Estrazione fallita: impossibile raggiungere LM Studio su ${this.baseUrl} — verifica che LM Studio sia in esecuzione con il server locale attivo (Impostazioni > Local Server > Start Server)`,
      )
    }

    if (!risposta.ok) {
      const corpo = await risposta.text()
      throw new Error(`Estrazione fallita: LM Studio ha risposto ${risposta.status} — ${corpo.slice(0, 300)}`)
    }

    const dati = await risposta.json()
    return dati.choices?.[0]?.message?.content ?? ''
  }
}
```

Nota per chi implementa: `leggiModelloRichiesto()` è usata come valore di default di un parametro del costruttore — in TypeScript/JavaScript i default dei parametri si valutano ad ogni chiamata, non alla definizione della classe, quindi l'errore scatta quando si scrive `new ClienteEstrazioneLMStudio()`, non quando si importa il modulo.

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npm test -- estrazione`
Expected: PASS su tutti i test del file (quelli esistenti di `estraiCampi`/`PROMPT_SISTEMA` + i 5 nuovi).

- [ ] **Step 5: Verificare che il progetto compili**

Run: `npm run typecheck`
Expected: nessun errore. (A questo punto `src/app/api/estrazione/route.ts` fallirà la compilazione perché importa ancora `ClienteEstrazioneAnthropic`, rimossa in questo task — è atteso, si risolve nel Task 2. Se vuoi verificare solo `estrazione.ts` in isolamento, va bene anche solo controllare che non ci siano errori nuovi *in quel file specifico* nell'output di `tsc`.)

- [ ] **Step 6: Commit**

```bash
git add src/ai/estrazione.ts src/ai/estrazione.test.ts
git commit -m "feat(ai): sostituisce il client Anthropic con LM Studio locale per l'estrazione campi"
```

---

### Task 2: Completare la sostituzione — route, dipendenza, documentazione

**Files:**
- Modify: `src/app/api/estrazione/route.ts`
- Modify: `package.json` (rimuove `@anthropic-ai/sdk`)
- Modify: `.gitignore` (eccezione per `.env.example`)
- Create: `.env.example`

**Interfaces:**
- Consuma: `ClienteEstrazioneLMStudio` (Task 1).
- Produce: nessuna nuova interfaccia — questo task collega quanto già costruito e chiude il cambio.

- [ ] **Step 1: Aggiornare `route.ts`**

Sostituisci il contenuto di `src/app/api/estrazione/route.ts` con:

```ts
// src/app/api/estrazione/route.ts
import { NextResponse } from 'next/server'
import { estraiCampi, ClienteEstrazioneLMStudio } from '@/ai/estrazione'

export async function POST(richiesta: Request) {
  const { testo } = await richiesta.json()
  try {
    const campi = await estraiCampi(testo, new ClienteEstrazioneLMStudio())
    return NextResponse.json(campi)
  } catch (errore) {
    return NextResponse.json({ errore: errore instanceof Error ? errore.message : 'Errore' }, { status: 400 })
  }
}
```

- [ ] **Step 2: Verificare che nessun altro file citi ancora Anthropic**

Run: `grep -rn "Anthropic\|@anthropic-ai" src/`
Expected: nessun risultato. Se ne trovi uno fuori da `estrazione.ts`/`route.ts` che non ti aspettavi, fermati e segnalalo — non cancellarlo alla cieca.

- [ ] **Step 3: Rimuovere la dipendenza `@anthropic-ai/sdk`**

In `package.json`, rimuovi la riga `"@anthropic-ai/sdk": "^0.68.0",` dalla sezione `dependencies`.

Run: `npm install`
Expected: aggiorna `package-lock.json` di conseguenza, nessun errore.

- [ ] **Step 4: Aggiungere `.env.example`**

`.gitignore` contiene la riga `.env*`, che esclude anche `.env.example` — ma quel file va invece versionato (è solo documentazione, nessun segreto). Aggiungi subito dopo la riga `.env*` in `.gitignore`:

```gitignore
!.env.example
```

Poi crea `.env.example` nella root del progetto:

```bash
# URL del server locale di LM Studio (Impostazioni > Local Server > Start Server)
LM_STUDIO_BASE_URL=http://localhost:1234/v1

# Nome esatto del modello caricato in LM Studio (visibile nell'interfaccia)
LM_STUDIO_MODEL=
```

- [ ] **Step 5: Eseguire l'intera suite e verificare che compili**

Run: `npm test && npm run typecheck`
Expected: tutti i test verdi (nessuna regressione), nessun errore di tipo — in particolare `route.ts` ora deve compilare senza errori, dato che importa `ClienteEstrazioneLMStudio` invece della classe rimossa.

- [ ] **Step 6: Verifica manuale (richiede LM Studio in esecuzione)**

Questo passo non è automatizzabile con i test e richiede un umano con LM Studio installato:

1. Avvia LM Studio, carica un modello, vai su "Local Server" e premi "Start Server".
2. Copia `.env.example` in `.env.local` e imposta `LM_STUDIO_MODEL` con il nome esatto del modello caricato.
3. `npm run dev`, apri `/preventivi/nuovo`, scrivi una frase nella chat di apertura (es. "casa per Rossi a Vicenza, 150 mq lordi") e premi "Compila dal testo".
4. Verifica che il form si precompili. Se vedi un errore, il messaggio dovrebbe dirti esattamente cosa non va (LM Studio non raggiungibile, modello non impostato, o risposta del modello non valida) — non un errore criptico.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/estrazione/route.ts package.json package-lock.json .gitignore .env.example
git commit -m "chore(ai): completa il passaggio a LM Studio, rimuove @anthropic-ai/sdk"
```

---

## Self-Review

**Copertura spec:** sostituzione completa (Task 1+2 rimuovono la classe e la dipendenza Anthropic) ✓; fetch verso endpoint OpenAI-compatible (Task 1) ✓; configurazione via env con default solo su `LM_STUDIO_BASE_URL` (Task 1, `leggiModelloRichiesto` senza default) ✓; errori con prefisso `Estrazione fallita:` per connessione e per risposta non-ok (Task 1) ✓; test senza chiamate di rete vere (Task 1, `vi.stubGlobal`) ✓; rimozione dipendenza verificata prima di toglierla (Task 2, Step 2-3) ✓; `.env.example` (Task 2, Step 4) ✓.

**Scan placeholder:** nessun TBD/TODO nei blocchi di codice.

**Coerenza dei tipi:** `ClienteEstrazioneLMStudio` implementa `ClienteEstrazione` con la stessa firma `estrai(testo: string): Promise<string>` usata ovunque nel modulo; il nome della classe usato in Task 2 (`route.ts`) coincide esattamente con quello prodotto in Task 1.
