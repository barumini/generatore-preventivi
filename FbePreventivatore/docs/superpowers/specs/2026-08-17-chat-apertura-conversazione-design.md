# Chat di apertura conversazionale + campi mancanti (progettista, luogo)

## Contesto

Testando il wizard con un input reale (`"Progetto per la realizzazione casa in
legno, cliente Pisanu Matteo, residente in Grisignano di Zocco, provincia di
Vicenza, progettista sarà Mario Rossi"`) sono emersi due problemi distinti in
`src/ai/estrazione.ts` e `src/app/preventivi/nuovo/ChatApertura.tsx`:

1. **Gap nello schema**: `progettista` e `luogo` non esistono in
   `SchemaCampiEstratti`/`PROMPT_SISTEMA`. Non è un bug di mappatura come quello
   già corretto per `tipoCopertura`/`finituraEsterna`/`pacchetto` — qui il
   modello non viene proprio istruito a cercarli, quindi un dato esplicito come
   "progettista sarà Mario Rossi" va perso silenziosamente.
2. **Nessun modo per completare l'estrazione**: `campiMancanti` viene calcolato
   dal modello ma non arriva mai all'utente in `ChatApertura` — l'unico modo
   per correggere è aprire manualmente i tab del wizard. L'utente vuole poter
   rispondere in linguaggio naturale ("il progettista è Mario Rossi") e vedere
   il form aggiornarsi, in una vera conversazione (non un riquadro che appare e
   scompare a ogni round).

`oggetto` (`StatoForm.oggetto`) è un caso diverso: è quasi sempre la stessa
frase standard ("Fornitura e posa in opera di casa in legno MHM") e non ha
senso chiederla via AI o via dialogo.

## Decisioni

1. **`progettista`** entra nello schema di estrazione come campo opzionale
   normale: se assente, il modello lo aggiunge a `campiMancanti` (stessa regola
   già in prompt per gli altri campi opzionali).
2. **`luogo`** entra nello schema come opzionale, ma con un fallback: se non
   detto esplicitamente si deduce dal comune del cliente
   (`mappatura-estrazione.ts`), quindi **non** va mai in `campiMancanti` anche
   se assente — il prompt lo dice esplicitamente, per non tediare l'utente con
   una domanda a cui c'è già una risposta ragionevole.
3. **`oggetto`** non entra nello schema di estrazione. `mappatura-estrazione.ts`
   lo imposta sempre alla frase standard fissa (modificabile a mano dal tab
   Anagrafica come oggi).
4. **Meccanismo di follow-up: testo cumulativo, non merge manuale.** Ogni turno
   della conversazione (messaggio iniziale + risposte successive) viene
   concatenato in un'unica stringa; ogni turno **ri-esegue `estraiCampi` da
   zero su tutto il testo accumulato**, non su solo l'ultima risposta. Questo
   evita di scrivere e testare una funzione di merge campo-per-campo (con tutte
   le ambiguità su cosa vince in caso di conflitto) — il modello vede sempre il
   contesto intero e ricalcola `campiMancanti` in modo sempre coerente. Aggiunta
   al prompt: *"se un'informazione compare più volte, usa l'ultima menzionata"*,
   per supportare correzioni naturali ("no, veramente è a Trissino").
5. **UI: chat vera, non riquadri che appaiono/scompaiono.** `ChatApertura`
   diventa un thread di messaggi (bolle utente/assistente) con **un'unica
   casella di testo persistente in basso**, usata sia per il primo messaggio
   sia per ogni risposta successiva — non ci sono più due componenti visivi
   diversi ("Apertura rapida" + un secondo riquadro di follow-up).
6. **Le risposte "assistente" nel thread sono sintetizzate in locale, non
   generate dal modello.** Dopo ogni estrazione riuscita, il componente aggiunge
   una bolla assistente deterministica: `"Ho capito quasi tutto — mi manca
   ancora: {campiMancanti.join(', ')}."` oppure `"Perfetto, ho tutto quello che
   serve."` se la lista è vuota. Evita un secondo giro di prompt-engineering
   solo per generare testo conversazionale, e mantiene il costo/latenza al
   minimo (un'unica chiamata LLM per turno, non due).
7. **Nessun limite di round.** L'utente può rispondere quante volte vuole, o
   ignorare il follow-up e compilare a mano nei tab in qualsiasi momento — il
   thread non blocca né richiede risposta.

## Design

### `src/ai/estrazione.ts`

`SchemaCampiEstratti` guadagna due campi opzionali:

```ts
progettista: z.string().optional(),
luogo: z.string().optional(),
```

`PROMPT_SISTEMA` aggiorna la forma del JSON atteso con questi due campi e
aggiunge due istruzioni:

- *"se 'luogo' non è specificato esplicitamente nel testo, NON aggiungerlo a
  campiMancanti — verrà dedotto automaticamente dal comune del cliente."*
  (Nota: `StatoForm.luogo`/`Revisione.luogo` non ha oggi una semantica
  documentata più precisa di "luogo associato alla revisione"; il golden case
  Crivellaro lo valorizza con il comune del cliente — `Trissino` — ed è il
  precedente che questa scelta segue, non una regola di business scritta
  altrove.)
- *"Il testo può contenere più affermazioni scritte in momenti diversi (una
  conversazione): se una stessa informazione compare più volte, usa l'ultima
  menzionata."*

Nessuna modifica all'interfaccia `ClienteEstrazione` o a `estraiCampi()`: il
meccanismo di conversazione vive tutto lato chiamante (`ChatApertura`), che
passa ogni volta il testo cumulativo intero.

### `src/app/preventivi/nuovo/mappatura-estrazione.ts`

```ts
if (campi.progettista) parziale.progettista = campi.progettista
parziale.luogo = campi.luogo ?? campi.cliente.comune ?? ''
parziale.oggetto = OGGETTO_STANDARD // costante, sempre impostata
```

`OGGETTO_STANDARD` è la stringa già usata nel golden case Crivellaro
("Fornitura e posa in opera di casa in legno MHM"), promossa a costante
condivisa (in `stato-form.ts`, vicino a `CARATTERISTICHE_DEFAULT`) invece di
restare un valore digitato a mano nei test/fixture.

### `src/app/preventivi/nuovo/ChatApertura.tsx`

Riscrittura dello stato interno da "un testo + un booleano di caricamento" a
un vero thread:

```ts
interface Messaggio {
  ruolo: 'utente' | 'assistente'
  testo: string
}

const [messaggi, setMessaggi] = useState<Messaggio[]>([])
const [bozza, setBozza] = useState('')       // contenuto della casella di testo
const [caricamento, setCaricamento] = useState(false)
const [errore, setErrore] = useState<string | null>(null)
```

Il testo passato a `estraiCampi` è la concatenazione di tutti i messaggi con
`ruolo: 'utente'` (i messaggi assistente sono feedback locale, non vanno
ri-mandati al modello). Ad ogni invio:

1. Aggiunge il messaggio utente al thread, svuota `bozza`, `caricamento = true`.
2. Chiama `estraiCampi(testoCumulativo, cliente)`.
3. Successo: chiama `onEstrazioneCompletata(statoFormDaCampiEstratti(campi))`
   (il form si aggiorna come oggi) e aggiunge la bolla assistente sintetizzata
   dal punto 6 delle Decisioni.
4. Errore: aggiunge una bolla assistente di errore (stesso testo che oggi va
   nell'`Alert`), il thread resta consultabile e l'utente può riprovare.

`onEstrazioneCompletata` perde il secondo parametro `campiMancanti` (era già
ignorato dall'unico chiamante, `page.tsx`): la lista mancanti ora vive solo
dentro `ChatApertura`, che è l'unico posto che deve saperlo per popolare il
thread.

### Data flow

```
utente scrive frase 1
  → messaggi = [utente: frase1]
  → estraiCampi(frase1) → campi1, mancanti1
  → onEstrazioneCompletata(mappa(campi1))   // form si aggiorna, remount wizard
  → messaggi += [assistente: "manca: progettista"]

utente scrive "il progettista è Mario Rossi"
  → messaggi += [utente: "il progettista è Mario Rossi"]
  → estraiCampi(frase1 + "\n" + rispostaFollowUp) → campi2, mancanti2 (= [])
  → onEstrazioneCompletata(mappa(campi2))   // form si aggiorna di nuovo, sovrascrive
  → messaggi += [assistente: "Perfetto, ho tutto quello che serve."]
```

Nota: ogni `onEstrazioneCompletata` fa ripartire da zero il remount del wizard
(`key={versioneEstrazione}` in `page.tsx`, comportamento già esistente, non
modificato da questo lavoro) — se l'utente ha già iniziato a modificare a mano
i tab prima di rispondere al follow-up, quelle modifiche manuali vengono perse
in favore dello stato AI più completo. È lo stesso comportamento di oggi
quando si preme "Compila dal testo" una seconda volta; non lo cambiamo qui.

### Test

- `src/ai/estrazione.test.ts`: nuovi casi per `progettista` opzionale (presente
  → passa; assente → non causa errori di validazione) e per `luogo` (idem).
- `src/app/preventivi/nuovo/mappatura-estrazione.test.ts`: `luogo` dedotto dal
  comune quando assente; `luogo` esplicito ha priorità sul comune quando
  presente; `oggetto` sempre uguale a `OGGETTO_STANDARD` indipendentemente
  dall'input.
- **Nessun test automatico per `ChatApertura.tsx`**: il progetto non ha
  infrastruttura di test per componenti React (`CLAUDE.md`: i test vivono in
  `app/domain/`, TypeScript puro). Verifica manuale nel browser, come fatto per
  le funzionalità precedenti di questa stessa sessione di lavoro.

## Fuori scope

- Editing/cancellazione di messaggi già inviati nel thread.
- Persistenza del thread di conversazione (si perde se si ricarica la pagina,
  come oggi si perde il testo nella textarea).
- Un secondo modello/prompt per generare le risposte "assistente" in linguaggio
  naturale invece che sintetizzate in locale (Decisione 6).
