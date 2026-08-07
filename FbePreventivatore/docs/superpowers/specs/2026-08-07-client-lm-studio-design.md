# Client LLM locale (LM Studio) per l'estrazione campi

## Contesto

`src/ai/estrazione.ts` (Task 12 del piano principale) espone un'interfaccia
`ClienteEstrazione` con un solo metodo, `estrai(testo: string): Promise<string>`,
pensata esattamente per essere sostituibile: `estraiCampi()` la usa, valida la
risposta con uno zod schema (`SchemaCampiEstratti`), e non sa né le importa come
il testo grezzo è stato ottenuto. L'unica implementazione esistente è
`ClienteEstrazioneAnthropic`, che chiama l'API cloud di Anthropic.

L'utente vuole sostituirla con un modello locale servito da LM Studio, per non
dipendere da una API key cloud. Decisione: **sostituzione completa**, non
un'opzione selezionabile — `ClienteEstrazioneAnthropic` e la dipendenza
`@anthropic-ai/sdk` vengono rimosse.

## Decisioni

1. **Sostituzione totale**, non coesistenza selezionabile a runtime.
2. **Integrazione via `fetch`** verso l'endpoint OpenAI-compatible che LM Studio
   espone quando il server locale è attivo — non l'SDK ufficiale `@lmstudio/sdk`.
   Stesso pattern (una chiamata HTTP, parsing testo→JSON già gestito da
   `estraiCampi()`) del client che sostituisce.
3. **Configurazione via variabili d'ambiente**, con default dove ha senso averne:
   - `LM_STUDIO_BASE_URL` — default `http://localhost:1234/v1` (il default di LM
     Studio quando si attiva "Local Server").
   - `LM_STUDIO_MODEL` — **nessun default**: è il nome del modello caricato in
     LM Studio, cambia da installazione a installazione. Se manca, il
     costruttore lancia subito un errore leggibile — non una richiesta HTTP
     con `model: undefined` che fallirebbe più a valle con un errore oscuro.

## Design

### `ClienteEstrazioneLMStudio`

Sostituisce `ClienteEstrazioneAnthropic` in `src/ai/estrazione.ts`, implementando
la stessa interfaccia `ClienteEstrazione`:

```ts
export class ClienteEstrazioneLMStudio implements ClienteEstrazione {
  constructor(
    private baseUrl: string = process.env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234/v1',
    private modello: string = requireModello(),
  ) {}

  async estrai(testo: string): Promise<string> {
    // POST a `${baseUrl}/chat/completions`, corpo OpenAI-compatible:
    // { model: this.modello, messages: [...], temperature: 0.1 }
    // Risposta letta da choices[0].message.content.
  }
}
```

`requireModello()` legge `process.env.LM_STUDIO_MODEL` e lancia
`Estrazione fallita: variabile LM_STUDIO_MODEL non impostata — imposta il nome
esatto del modello caricato in LM Studio` se assente. Nessun fallback silenzioso
su stringa vuota (a differenza del client Anthropic che sostituisce, che aveva
questo difetto già noto e non risolto).

### Corpo della richiesta

```json
{
  "model": "<LM_STUDIO_MODEL>",
  "messages": [
    { "role": "system", "content": "<PROMPT_SISTEMA invariato>" },
    { "role": "user", "content": "<testo dell'utente>" }
  ],
  "temperature": 0.1
}
```

Temperatura bassa per favorire un output JSON strutturalmente coerente da un
modello locale (in genere meno affidabile di Claude nel seguire l'istruzione
"rispondi solo con un oggetto JSON"). Il prompt di sistema (`PROMPT_SISTEMA`)
resta identico — non dipende dal backend.

### Gestione errori

Due casi distinti, entrambi con messaggio `Estrazione fallita: ...` (stesso
prefisso già usato nel modulo, così l'errore resta riconoscibile dal chiamante):

- **LM Studio non raggiungibile** (fetch lancia, es. `ECONNREFUSED`): messaggio
  che invita a verificare che LM Studio sia in esecuzione con il server locale
  attivo.
- **Risposta HTTP non ok** (es. modello non trovato, richiesta malformata):
  messaggio che include lo status HTTP e, se presente, il corpo dell'errore
  restituito da LM Studio.

Il parsing JSON della risposta e la validazione contro lo zod schema restano
**invariati** in `estraiCampi()` — non toccati da questo cambio.

### Test

Stesso principio già stabilito per il client Anthropic: **nessuna chiamata di
rete vera**. `global.fetch` viene mockato:

1. Un test verifica che la richiesta sia costruita correttamente: URL (usando
   `baseUrl` custom), corpo (modello, messaggi, temperatura), e che il testo
   della risposta mockata arrivi intatto dal metodo `estrai()`.
2. Un test verifica che un fetch rifiutato (simulando `ECONNREFUSED`) produca
   l'errore leggibile atteso, non un'eccezione grezza non gestita.
3. Un test verifica che `LM_STUDIO_MODEL` mancante faccia fallire subito la
   costruzione del client, prima di qualunque tentativo di rete.

I test esistenti di `estraiCampi()` (che usano un client finto, non
`ClienteEstrazioneLMStudio`) non cambiano.

### Rimozione dipendenza

`@anthropic-ai/sdk` viene rimosso da `package.json` **solo dopo aver verificato**
che nessun altro file del progetto lo importi (grep su `src/`) — al momento
dell'ultima verifica in questa sessione era usato solo in `estrazione.ts`.

### Documentazione

Nuovo file `.env.example` nella root del progetto, con le due variabili
commentate:

```bash
# URL del server locale di LM Studio (Impostazioni > Local Server > Start Server)
LM_STUDIO_BASE_URL=http://localhost:1234/v1

# Nome esatto del modello caricato in LM Studio (visibile nell'interfaccia)
LM_STUDIO_MODEL=
```

Questo colma anche un buco già segnalato nella review finale del branch
principale (`ANTHROPIC_API_KEY` non era documentata da nessuna parte) — non lo
si ripete per le nuove variabili.

## Fuori scope

- Non tocca `ClienteEstrazione`, `estraiCampi()`, lo zod schema, o la mappatura
  verso `StatoForm` (`statoFormDaCampiEstratti`) — tutti già corretti e
  indipendenti dal backend LLM.
- Non aggiunge retry, timeout configurabile, o fallback multi-provider: fuori
  scope per questo cambio, si può aggiungere in futuro se necessario.
- Non modifica `PROMPT_SISTEMA`: stesso testo, stesso vincolo CLAUDE.md §7
  (l'AI non decide mai prezzi — il prompt non menziona importi, invariato).
