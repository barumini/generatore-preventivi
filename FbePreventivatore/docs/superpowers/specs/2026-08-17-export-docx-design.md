# Collegare l'export DOCX al wizard

## Contesto

`esportaOfferta()` (`src/documento/export-docx.ts`) genera già il documento
`mod.05-COM` completo a partire da `InputEsportazione`, con guardrail seri
(blocca l'export se restano placeholder o tag non risolti). Ma è isolata: la
chiama solo il proprio test e lo script CLI `scripts/genera-offerta-esempio.ts`.
Nessun componente React, nessuna route API la richiama. L'utente del wizard non
ha alcun modo di scaricare un documento.

Lo spec `2026-08-07-wizard-estensioni-design.md` aveva già dichiarato questo
esplicitamente fuori scope: *"cablare `esportaOfferta()`/`InputEsportazione` a
partire da questi nuovi campi resta un follow-up separato — mancano ancora
troppi altri campi (condizioni di pagamento, riferimenti pratiche,
revisione/data)"*. Questo spec copre quel follow-up.

**Gap principale**: `InputEsportazione.condizioni` (consegna, caparra, SAL,
validità, optional, esclusioni) non è raccolto da nessuno step del wizard oggi
— la preview (`PannelloPreview.tsx`) usa un placeholder fisso
(`CONDIZIONE_DA_DEFINIRE`, `SAL_DEFAULT`). Manca anche un campo dedicato per
`superfici.totaleLorda` (la stringa libera tipo `'134+13+14= 161'`).

**Decisioni prese in fase di brainstorming:**
- Le condizioni contrattuali si raccolgono con un nuovo step del wizard (non
  restano un default fisso).
- Il pulsante di export compare sia nel wizard sia nella pagina di revisione.
- Generare il documento **non** fa avanzare lo stato del preventivo
  (`bozza`/`inviata`/`firmata` restano fuori scope — nessun flusso di invio è
  collegato a questo lavoro).

**Esplicitamente fuori scope:**
- Avanzamento stato `bozza → inviata/firmata`.
- Catalogo strutturato di voci optional/esclusioni ricorrenti (la spec
  principale, §6.1, lo segnala già come miglioramento futuro non implementato).
- Formato PDF o stampa (`print.css` resta invariato).
- Invio email o firma del documento generato.

---

## 1. Nuovo step wizard: "Condizioni contrattuali"

Nuovo file `src/app/preventivi/nuovo/steps/StepCondizioniContrattuali.tsx`.
Nome deliberatamente diverso da `StepCondizioni.tsx` esistente, che nonostante
il nome gestisce solo gli sconti a cascata — nessuna sovrapposizione di
responsabilità, ma il nome esistente è già ambiguo e non va peggiorato.

Campi raccolti:

- **Consegna** — testo libero, obbligatorio.
- **Caparra** — importo numerico, obbligatorio.
- **Validità offerta** — testo libero, obbligatorio.
- **SAL** — lista editabile di `{ percentuale, descrizione }`, precompilata da
  `SAL_DEFAULT` (7 righe). Aggiungi/rimuovi riga. Nessun vincolo che la somma
  faccia 100 in UI (il documento accetta ciò che il commerciale inserisce).
- **Optional** — lista dinamica di `{ descrizione, importo }`. La lettera
  (`A)`, `B)`, ...) si genera dalla posizione, non si digita. Una riga può
  essere marcata "riferimento pratica Genio Civile" (checkbox); al più una
  riga per volta può avere questo flag — è l'unico id con un rimando nel testo
  fisso del master (`{riferimenti.praticaGenioCivile}`).
- **Esclusioni** — lista dinamica di `{ descrizione, importo }`, lettera
  minuscola (`a)`, `b)`, ...) generata dalla posizione.

Per `importo` in optional/esclusioni: campo testo. Se il valore digitato è un
numero valido (formato italiano, virgola decimale) viene salvato come
`number`; altrimenti resta `string` letterale (es. `€ 35,00/ora`) — stesso
principio già usato per `overrides` in `StepPrezzi`.

Consegna/caparra/validità sono obbligatori con la stessa convenzione di
validazione già usata negli altri step (blocco avanzamento step, non blocco
del salvataggio bozza). SAL/optional/esclusioni restano opzionali: liste vuote
sono valide (un'offerta può non avere optional).

## 2. Campo `totaleLorda` nello step Geometria

Aggiungo un campo testo libero nello step esistente `StepGeometria.tsx`,
accanto alle superfici per piano. Precompilato con un auto-suggerimento
costruito unendo i piani non vuoti con `+` e aggiungendo `= totale` (dove
`totale` è `totaleSuperficiLorde(superfici)` o `totaleLordoManuale` se
impostato) — ma resta **editabile**: l'utente può correggere la forma scritta,
coerente col vincolo CLAUDE.md sulle superfici come stringhe libere non
derivabili meccanicamente in ogni caso.

## 3. Estensione di `StatoForm`

```ts
export interface CondizioniForm {
  consegna: string
  caparra: number
  validita: string
  sal: { percentuale: number; descrizione: string }[] // split salPrimi/salSuccessivi solo a export time
  optional: { descrizione: string; importo: number | string; praticaGenioCivile?: boolean }[]
  esclusioni: { descrizione: string; importo: number | string }[]
}
```

Aggiunto a `StatoForm.condizioni` (`stato-form.ts`) e `StatoForm.superfici`
guadagna un campo `totaleLordoTesto?: string` per il punto 2.

Default `CONDIZIONI_DEFAULT` in `condizioni-default.ts`, costruito da
`SAL_DEFAULT` (rinominando `milestone`→`descrizione`) + stringhe vuote +
liste vuote. **Nessuna migrazione Prisma**: `statoForm` è già un blob JSON, e
il merge esistente `{ ...STATO_INIZIALE, ...statoIniziale }`
(`FormStrutturato.tsx:41`) garantisce che le bozze salvate prima di questa
modifica ricevano il default al primo caricamento (il blob salvato
semplicemente non ha la chiave `condizioni`, lo spread non la sovrascrive).

`PannelloPreview.tsx` smette di usare `CONDIZIONE_DA_DEFINIRE`/`SAL_DEFAULT`
come dato fisso e legge `stato.condizioni`; `CONDIZIONE_DA_DEFINIRE` resta
come fallback di visualizzazione solo per i campi ancora vuoti (stringa
vuota → mostra il placeholder), non più come unico valore possibile.

## 4. Mapping `StatoForm` → `InputEsportazione`

Nuova funzione pura `costruisciInputEsportazione(stato, revisioneMeta)` in
`src/documento/costruisci-input-esportazione.ts`. Nessun I/O (niente `fs`),
testabile senza filesystem. `revisioneMeta` è `{ numero: number; protocollo:
string }` — dati che vivono nel record Prisma `Revisione`/`Preventivo`, non in
`StatoForm`.

Responsabilità:

- `abaco`: chiama `generaAbacoPerCategoria(stato.serramenti)` (oggi usata solo
  dalla preview).
- `revisione`: `String(revisioneMeta.numero - 1).padStart(2, '0')` (la prima
  revisione salvata è `numero: 1` → `'00'`).
- `dataOfferta`: nuovo formattatore data-italiana-estesa (`src/documento/formatta-data-italiana.ts`),
  da `stato.data` (ISO) + `stato.luogo` → `'Castelgomberto, 6 agosto 2026'`.
- `superfici.totaleLorda`: `stato.superfici.totaleLordoTesto` se valorizzato,
  altrimenti l'auto-suggerimento ricalcolato al volo (stesso algoritmo del
  punto 2, come rete di sicurezza se il campo non è mai stato toccato).
- `condizioni.salPrimi`/`salSuccessivi`: split posizionale di `stato.condizioni.sal`
  — `slice(0, 3)` / `slice(3)`, rinominando `descrizione` (già coerente, a
  differenza di `SalDefault.milestone`).
- `condizioni.optional`/`esclusioni`: genera `lettera` dalla posizione
  (maiuscola/minuscola + `)`), passa `id: 'pratica-genio-civile'` solo sulla
  riga marcata `praticaGenioCivile: true` (nessuna riga marcata → stringa
  vuota, comportamento identico a un'offerta senza quella pratica).
- `percorsoMaster`: costante `path.join(process.cwd(), 'template', 'Offerta MHM master.docx')`.
  Nessuna configurazione esterna (env var) — il file fa parte del repository.

## 5. Refactor minimo di `export-docx.ts`

Separo la costruzione del buffer dalla scrittura su disco:

```ts
export function costruisciBufferOfferta(input: InputEsportazione): Buffer {
  // logica attuale di esportaOfferta, meno l'ultima riga
}

export function esportaOfferta(input: InputEsportazione): void {
  fs.writeFileSync(input.percorsoOutput, costruisciBufferOfferta(input))
}
```

`percorsoOutput` resta nel tipo `InputEsportazione` per compatibilità con lo
script CLI esistente e il test attuale (`export-docx.test.ts`), ma diventa
opzionale (`percorsoOutput?: string`) perché il flusso HTTP non scrive su
disco. Nessun altro comportamento cambia — stesso test, stesso golden case.

## 6. Nuova route API

`POST /api/preventivi/[id]/revisioni/[numero]/export`
(`src/app/api/preventivi/[id]/revisioni/[numero]/export/route.ts`):

1. Carica la revisione (stesso `caricaRevisione` già usato dalla route GET
   esistente), deserializza `statoForm`/`risultatoCalcolo` con
   `deserializzaRevisione`.
2. Chiama `costruisciInputEsportazione(stato, { numero, protocollo })`.
3. Chiama `costruisciBufferOfferta(input)`.
4. Risponde con `Content-Type:
   application/vnd.openxmlformats-officedocument.wordprocessingml.document` e
   `Content-Disposition: attachment; filename="..."` (nome file da
   protocollo+revisione, es. `2026059-rev00.docx`).

Se `costruisciBufferOfferta` lancia (placeholder di spessore non interpolati,
tag non risolti, campo obbligatorio mancante), la route risponde 422 con il
messaggio d'errore in JSON — niente file corrotto scaricato in silenzio.

## 7. UI

Pulsante "Genera documento" (icona download), accanto a "Salva bozza" in
`WizardConSalvataggio.tsx` — abilitato solo quando esiste già
`preventivoEsistente` (cioè dopo il primo salvataggio, perché la route ha
bisogno di un id e un numero di revisione persistiti). Al click: `fetch` POST
alla route, se OK avvia il download nel browser (blob + link temporaneo), se
errore mostra il messaggio restituito dall'API in un banner (stesso pattern
di gestione errori già usato per il salvataggio bozza).

Stesso pulsante nella pagina di revisione di sola lettura
(`revisioni/[numero]/page.tsx`), sempre visibile perché lì la revisione è già
salvata per definizione.

## Test

- `costruisci-input-esportazione.test.ts` (nuovo): golden case Crivellaro
  costruito a partire da uno `StatoForm` completo (non da `InputEsportazione`
  letterale come oggi in `export-docx.test.ts`), verifica che l'output combaci
  campo per campo con l'`InputEsportazione` attuale del test esistente.
- `formatta-data-italiana.test.ts` (nuovo): casi noti (mesi, anno).
- `export-docx.test.ts` (esistente): invariato, verifica solo che
  `costruisciBufferOfferta`/`esportaOfferta` continuino a produrre lo stesso
  golden case a partire da un `InputEsportazione` letterale.
- Route `export/route.ts` (nuovo test): mock di `caricaRevisione`, verifica
  200 con headers corretti sul caso valido e 422 con messaggio leggibile sul
  caso con placeholder non risolti.
- Nessun test per il refactor di `esportaOfferta`: comportamento invariato,
  coperto dai test esistenti.
