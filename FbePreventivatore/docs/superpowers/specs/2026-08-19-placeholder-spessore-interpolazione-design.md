# Interpolazione degli spessori nelle descrizioni voce

## Problema

Tre voci del catalogo (`src/domain/voci.ts`, id `pareti-mhm`, `copertura-falda`, `cappotto`)
hanno `descrizioneTemplate` con placeholder testuali a doppia graffa (`{{spessoreEsterno}}`,
`{{spessoreInterno}}`, `{{spessoreCoibente}}`, `{{spessoreCappotto}}`) che nessun meccanismo
del progetto interpola oggi. `esportaOfferta()` (`src/documento/export-docx.ts`) si blocca
correttamente per non produrre un `.docx` con questo residuo in una cella che il cliente
firma — ma non esiste alcun modo per risolverli davvero. Questo design introduce il
meccanismo di interpolazione mancante, senza toccare il comportamento del guardrail per i
casi in cui il dato resta assente.

Vincolo di dominio confermato in
`docs/superpowers/specs/2026-08-04-fbe-preventivatore-design.md:618`: gli spessori reali
sono spesso testo libero composito (`sp. mm 205-160`, `sp. mm 60+40`, `160 mm (80+60+20)`),
non numeri semplici — vanno trattati come stringa libera, sullo stesso principio già
applicato alle superfici (CLAUDE.md vincolo di formato).

## 1. Meccanismo di interpolazione (dominio puro)

- Nuova funzione in `src/domain/calcolo.ts`:
  `interpolaPlaceholder(template: string, valori: Record<string, string> | undefined): string`.
  Per ogni token `{{chiave}}` presente nel template, sostituisce con `valori[chiave]` solo
  se il valore esiste ed è non vuoto (dopo trim); altrimenti lascia il token intatto.
- `InputCalcolo` guadagna il campo opzionale `spessori?: Record<string, string>`.
- `eseguiCalcolo` usa `interpolaPlaceholder(voce.descrizioneTemplate, input.spessori)` nei
  tre punti dove oggi assegna `descrizione: voce.descrizioneTemplate` (override, importo
  testuale di default, driver).
- **Perché "lascia intatto" e non "sostituisce con stringa vuota":** un campo lasciato in
  bianco deve continuare a far scattare il guardrail esistente con lo stesso errore
  leggibile di oggi — non deve produrre una descrizione tipo *"esterne sp. mm  ed interne
  sp. mm 160"* (senza numero) che passerebbe silenziosamente l'export.
- `rilevaPlaceholderSpessoreNonInterpolati` (oggi definita in `export-docx.ts`) si sposta in
  `src/domain/calcolo.ts`, stessa logica e stesso regex, invariata nel comportamento. Sia il
  guardrail export sia il nuovo avviso UI (sezione 3) leggono così un'unica fonte di verità,
  senza far dipendere `src/ai/` da `src/documento/` o viceversa.

## 2. Nuovi campi nel wizard

- `CaratteristicheCostruttive` (`src/app/preventivi/nuovo/stato-form.ts`) guadagna 4 campi
  stringa libera: `spessoreEsterno`, `spessoreInterno`, `spessoreCoibente`,
  `spessoreCappotto` — stesso trattamento di `manto`/`tetto` già presenti nella stessa
  struttura (testo libero, non un numero, per rappresentare valori compositi tipo `60+40`).
- `CARATTERISTICHE_DEFAULT`: tutti i 4 campi default `''`. Nessun valore plausibile
  precompilato: un default "tipico" (es. `205`) rischierebbe di finire per errore su un
  documento reale senza che l'operatore lo abbia mai verificato per quel cliente specifico.
- `inputCalcoloDaStato` popola `InputCalcolo.spessori` leggendo questi 4 campi da
  `stato.caratteristiche`.
- `StepConfigurazione.tsx`: 4 nuovi `Field` testuali nella sezione "Configurazione", stesso
  pattern UI di "Manto di copertura" / "Tetto (descrizione)", con un placeholder d'esempio
  (`es. 205 o 60+40`) per segnalare che il formato composito è accettato.

## 3. Avviso visibile quando un campo fondamentale manca

Riuso del meccanismo di avvisi già esistente (`src/ai/coerenza.ts` → `verificaCoerenza`),
già renderizzato come banner `Alert` in cima a `PannelloPreview.tsx` — usato sia nel wizard
(`WizardConSalvataggio`) sia nella pagina di revisione read-only. Un solo punto
d'inserimento copre entrambi i percorsi, nessuna duplicazione.

- Nuovo valore dell'union `Avviso['tipo']`: `'spessore-non-interpolato'`.
- `verificaCoerenza` chiama `rilevaPlaceholderSpessoreNonInterpolati(input.risultato.vociValorizzate)`;
  se trova placeholder residui, produce un avviso, es.:
  *"Spessori non compilati nelle descrizioni: {{spessoreEsterno}}, {{spessoreCappotto}} —
  completa Configurazione prima di esportare"*.
- L'avviso compare solo per le voci realmente incluse nel preventivo corrente (il gating per
  livello modulo è già gestito da `vociIncluse` a monte, dentro `eseguiCalcolo`): nessun
  falso allarme per una voce non applicabile a quel pacchetto.

## 4. Estrazione AI dalla frase iniziale (opzionale in ingresso)

- `SchemaCampiEstratti` (`src/ai/estrazione.ts`) guadagna 4 campi opzionali:
  `spessoreEsterno`, `spessoreInterno`, `spessoreCoibente`, `spessoreCappotto`
  (`z.string().optional()`).
- `PROMPT_SISTEMA` aggiornato con la stessa forma nell'esempio di JSON atteso, più
  l'istruzione esistente e già generale — "se un campo non è menzionato, ometterlo, non
  inventare valori" — si applica automaticamente anche a questi.
- `mappatura-estrazione.ts`: stesso pattern condizionale già usato per `tipoCopertura` e
  `finituraEsterna` nel blocco `caratteristiche`, ripetuto per i 4 campi nuovi
  (`...(campi.spessoreEsterno ? { spessoreEsterno: campi.spessoreEsterno } : {})`, ecc.).
- Restano comunque modificabili a mano nello step Configurazione dopo l'estrazione: nessun
  valore estratto dall'AI è vincolante o invisibile all'operatore (vincolo CLAUDE.md #7,
  "l'AI non decide i prezzi" — qui non decide nemmeno un dato tecnico senza che sia
  visibile e correggibile).

## Cosa NON cambia

- Il guardrail in `export-docx.ts` (`costruisciBufferOfferta`) resta identico nella logica:
  stesso messaggio d'errore, stesso opt-in `consentiPlaceholderNonRisolti`. Cambia solo la
  provenienza della funzione di rilevazione (import da `@/domain/calcolo` invece che locale).
- Nessuna migrazione dati. Le revisioni già congelate (vincolo CLAUDE.md #6) restano apribili
  con gli stessi numeri: se prive dei nuovi campi `spessori`, l'interpolazione non trova
  valori e i placeholder restano intatti — l'export resta bloccato come già accade oggi,
  comportamento invariato, nessuna regressione su dati storici.
- `costruisci-input-esportazione.ts` non richiede modifiche: continua a passare
  `risultato.vociValorizzate` (già interpolate a monte da `eseguiCalcolo`) senza mai passare
  `consentiPlaceholderNonRisolti: true` — la revisione già garantita da un test dedicato
  (`costruisci-input-esportazione.test.ts:188`) resta valida senza modifiche a quel test.

## Test da aggiornare/estendere

- `src/domain/calcolo.ts` (nuovo test o estensione dell'esistente): `interpolaPlaceholder`
  sostituisce solo chiavi con valore non vuoto, lascia intatti i token senza valore o con
  valore vuoto/spazi; `eseguiCalcolo` produce `descrizione` interpolata quando `spessori` è
  presente.
- `src/documento/export-docx.test.ts`: i test esistenti sul guardrail (righe ~198-219)
  restano validi verificando il nuovo import; aggiungere un caso con `spessori` completo in
  ingresso che produce un `.docx` senza errore (nessun placeholder residuo).
- `src/ai/coerenza.ts` (test esistente, da estendere): nuovo caso che verifica l'avviso
  `'spessore-non-interpolato'` quando `risultato.vociValorizzate` contiene descrizioni con
  `{{...}}` residuo, e la sua assenza quando tutte le voci incluse sono già interpolate.
- `src/ai/estrazione.ts` (test esistente, da estendere): verifica che i 4 nuovi campi
  vengano accettati dallo schema quando presenti nella risposta LLM e restino opzionali
  quando assenti.
- `mappatura-estrazione.test.ts`: verifica che i 4 campi, se presenti in `CampiEstratti`,
  finiscano in `caratteristiche`, e che restino ai default (`''`) se assenti.
