# Estensioni del wizard: persistenza, sicurezza, caratteristiche, abaco per categoria

## Contesto

Il Task 17 (`docs/superpowers/plans/2026-08-04-fbe-preventivatore-implementation.md`,
amendment post-Task 16) ha dichiarato esplicitamente un follow-up non risolto:
`FormStrutturato`/`StatoForm` non raccolgono ancora caratteristiche costruttive
testuali, condizioni di pagamento/SAL, o riferimenti pratiche — `esportaOfferta()`
prende un `InputEsportazione` con valori letterali, non derivato da `StatoForm`.

Questo spec copre **quattro** di quei buchi:

1. **Sicurezza editabile** — oggi hardcoded in `stato-form.ts`.
2. **Caratteristiche costruttive reali** — oggi letterali fissi in `PannelloPreview.tsx`.
3. **Abaco diviso per categoria** — oggi una sola stringa piatta; `AbacoPerCategoria`
   (già definito in `export-docx.ts` per l'export) non è mai popolato dai serramenti
   del wizard.
4. **Persistenza collegata** — `domain/persistenza.ts` e lo schema Prisma esistono
   ma nessuna parte dell'app li richiama (niente salvataggio, niente elenco, niente
   riapertura).

**Fuori scope, deciso esplicitamente**: cablare `esportaOfferta()`/`InputEsportazione`
a partire da questi nuovi campi resta un follow-up separato — mancano ancora troppi
altri campi (condizioni di pagamento, riferimenti pratiche, revisione/data) per
farlo in un colpo solo, e le condizioni di pagamento non sono in scope qui.

## Architettura condivisa

Le quattro estensioni toccano `StatoForm` (nuovi campi), `FormStrutturato.tsx`
(nuova UI) e `PannelloPreview.tsx` (dati reali al posto dei letterali). Nessuna
modifica al motore di calcolo puro (`calcolo.ts`, `listino.ts`, `voci.ts`): la
`Sicurezza` è già un campo di `InputCalcolo`, si tratta solo di smettere di
hardcodarla. Il layer `domain/` resta TypeScript puro (CLAUDE.md), i nuovi campi
`categoria` e `caratteristiche`/`sicurezza` in `StatoForm` sono dati, non logica.

---

## 1. Sicurezza editabile

`StatoForm.sicurezza: { costoDichiarato: number; valorizzata: number | 'OMAGGIO' }`.

Default nello stato iniziale del form: `{ costoDichiarato: 2000, valorizzata: 'OMAGGIO' }`
— lo stesso valore hardcodato oggi in `stato-form.ts:42`, ma ora è un default di UI
sovrascrivibile, non una costante nel codice.

UI: nuovo blocco nello step **Prezzi** di `FormStrutturato.tsx`, due campi:
- `costoDichiarato` — input numerico.
- `valorizzata` — stesso pattern testo-libero già usato per `overrides`
  (`parseValoreOverride`/`formattaValoreOverride`), ma con dominio ristretto a
  `number | 'OMAGGIO'` (non l'intero set `comprese | escluso | escluse | OMAGGIO`
  usato dagli overrides — la sicurezza nel golden case è sempre un importo o
  un omaggio, mai "escluso").

`inputCalcoloDaStato` (stato-form.ts) legge `stato.sicurezza` invece del letterale.

### Test

`stato-form.test.ts` (nuovo, se non esiste già un file per `inputCalcoloDaStato`):
verifica che `sicurezza` passata nello stato arrivi intatta in `InputCalcolo`, sia
con un numero che con `'OMAGGIO'`.

---

## 2. Caratteristiche costruttive reali

```ts
export interface CaratteristicheCostruttive {
  copertura: 'falde' | 'piano'
  manto: string
  finituraEsterna: 'intonaco' | 'rivestimento'
  tetto: string
}
```

Aggiunto a `StatoForm.caratteristiche`. `copertura` e `finituraEsterna` sono select
a dominio chiuso — lo spec principale (§9.2) li dichiara già domini chiusi.
`manto` e `tetto` restano testo libero: lo spec non li chiude, e per `copertura:
'piano'` **non esiste nel catalogo (`voci.ts`) nessuna voce alternativa** a
`copertura-falda` (niente `tetto-piano`/`veletta-copertura-piana`, mai
implementate). Quindi in questo giro `copertura: 'piano'` è **solo descrittivo,
non cambia i prezzi** — un vincolo da rendere esplicito anche nel commento del
codice, per non far credere a chi legge che selezionare "piano" ricalcoli il
listino.

Default = valori reali Crivellaro: `{ copertura: 'falde', manto: 'Tegole in
cemento', finituraEsterna: 'intonaco', tetto: 'Tetto con travi e perline in
abete' }`.

### `pacchetto` derivato, non un campo

`pacchetto` (Grezzo / Grezzo avanzato / Chiavi in mano) **non** è un nuovo campo
di `StatoForm`: si deriva da `livelli` + `chiaviInManoNelTotale`, già presenti,
secondo la tabella §5 dello spec principale:

```ts
export type Pacchetto = 'Grezzo' | 'Grezzo avanzato' | 'Chiavi in mano'

export function pacchettoDaLivelli(
  livelli: Record<Modulo, LivelloModulo>,
  chiaviInManoNelTotale: boolean,
): Pacchetto {
  if (livelli.finiture === 'completo' || chiaviInManoNelTotale) return 'Chiavi in mano'
  if (livelli.involucro === 'completo') return 'Grezzo avanzato'
  return 'Grezzo'
}
```

(la funzione esatta di mappatura va verificata riga per riga contro la tabella §5
durante l'implementazione — questa è la lettura di base, non ancora testata).
Vive in `stato-form.ts` insieme al resto della logica di derivazione da `StatoForm`.

UI: due `<select>` (`copertura`, `finituraEsterna`) + due input testo (`manto`,
`tetto`) nello step **Configurazione**, accanto ai controlli di `livelli` già
esistenti.

`PannelloPreview` passa `stato.caratteristiche.*` e `pacchettoDaLivelli(...)` a
`PaginaCaratteristiche` invece dei letterali attuali (righe 49-57 di
`PannelloPreview.tsx`). `sistemaCostruttivo` resta come letterale fisso (è
davvero una costante, MHM è l'unico sistema costruttivo dell'azienda) — non fa
parte di questo cambio.

### Test

`stato-form.test.ts`: casi per `pacchettoDaLivelli` che coprano almeno le tre
righe della tabella §5 (Grezzo / Grezzo avanzato / Chiavi in mano) più il caso
`chiaviInManoNelTotale: true` con `finiture: 'impoverito'`.

---

## 3. Abaco per categoria

Nuovo campo obbligatorio su `Serramento` (`domain/geometria.ts`):

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
  categoria: CategoriaSerramento
  b: number
  h: number
}
```

`tipologia` resta il campo testuale descrittivo esistente (es. "doppia finestra"
del caso Crivellaro); `categoria` è il bucket fisso che guida l'abaco. Aggiungere
un campo obbligatorio a un'interfaccia esistente **rompe** tutti i literal object
che costruiscono `Serramento` senza `categoria` (fixture di test, `SERRAMENTI_CRIVELLARO`
in `abaco.test.ts` e nel piano) — vanno aggiornati per compilare. Il golden case
Crivellaro non cambia numeri (categoria non influenza `calcolaApertura`/`totaliSerramenti`),
ma la fixture va comunque annotata con una categoria per riga (dedotta dalla
`tipologia` originale: "porta di ingresso" → `portoncino`, "portafinestra" →
`portafinestra-battente`, "finestra"/"doppia finestra" → `finestra-battente`).

Nuova funzione in `ai/abaco.ts`:

```ts
export interface AbacoPerCategoria {
  tutti: string
  finestreBattente: string
  portefinestreBattente: string
  fissiVetrate: string
  alzantiScorrevoli: string
  portoncini: string
}

export function generaAbacoPerCategoria(serramenti: Serramento[]): AbacoPerCategoria
```

(il tipo `AbacoPerCategoria` esiste già in `export-docx.ts` — questo spec lo
sposta/riesporta da `ai/abaco.ts` come sorgente di verità, per evitare due
definizioni della stessa forma in moduli diversi; `export-docx.ts` importa da lì).

Implementazione: raggruppa `serramenti` per `categoria`, e per ciascun gruppo
riusa la logica di raggruppamento-per-dimensione già scritta in
`generaAbacoSerramenti` (estratta in una funzione interna condivisa, non
duplicata). `tutti` resta `generaAbacoSerramenti(serramenti)` invariato, per
compatibilità con l'uso attuale.

UI: in `FormStrutturato.tsx`, ogni riga serramento nello step **Geometria**
guadagna un `<select categoria>` accanto ai campi esistenti (piano, tipologia,
base, altezza). Default per una riga nuova: `'finestra-battente'`.

`PannelloPreview.tsx` chiama `generaAbacoPerCategoria(stato.serramenti)` invece
di (o in aggiunta a) `generaAbacoSerramenti`. `PaginaAbacoSerramenti.tsx` viene
esteso per mostrare le 5 categorie come paragrafi separati (con intestazione),
invece di una sola stringa — coerente con come pag. 19-20 del master reale è
strutturata (§3.6 dello spec principale) e con come `export-docx.ts` già si
aspetta i dati.

### Test

`ai/abaco.test.ts`: nuovi casi per `generaAbacoPerCategoria` sul dataset
Crivellaro (ora con `categoria` su ogni riga), che verificano che ogni bucket
contenga esattamente le righe attese e che `tutti` sia identico all'output
esistente di `generaAbacoSerramenti`.

---

## 4. Persistenza collegata

### Schema

```prisma
model Revisione {
  id           String     @id @default(cuid())
  preventivoId String
  preventivo   Preventivo @relation(fields: [preventivoId], references: [id])
  numero       Int
  data         DateTime
  luogo        String
  stato        String     @default("bozza") // bozza | inviata | firmata

  // NUOVO: stato grezzo del wizard (StatoForm serializzato), per poter riaprire
  // una bozza e continuare a modificarla nel form strutturato.
  statoForm String

  // Invariati: lo snapshot immutabile usato per i numeri (CLAUDE.md vincolo 6).
  inputCalcolo     String
  risultatoCalcolo String

  @@unique([preventivoId, numero])
}
```

Migrazione Prisma additiva (nuova colonna non-nullable su una tabella già
esistente: se ci sono righe pre-esistenti nel DB di sviluppo la migrazione
richiede un default o un backfill — da verificare al momento di generarla; se
il DB locale è vuoto/di test, nessun problema).

### `domain/persistenza.ts`

Estende `serializzaRevisione`/`deserializzaRevisione` per includere `statoForm`:

```ts
export function serializzaRevisione(
  stato: StatoForm,
  input: InputCalcolo,
  risultato: RisultatoCalcolo,
): { statoForm: string; inputCalcolo: string; risultatoCalcolo: string }

export function deserializzaRevisione(
  statoForm: string,
  inputCalcolo: string,
  risultatoCalcolo: string,
): { stato: StatoForm; input: InputCalcolo; risultato: RisultatoCalcolo }
```

`StatoForm` è definito in `src/app/preventivi/nuovo/stato-form.ts` (lato app, non
`domain/`) — `persistenza.ts` ne importa il tipo per la firma ma resta comunque
TypeScript puro (nessun import di Prisma/rete: prende/restituisce stringhe JSON,
la query DB vera e propria vive nelle API route).

### API

Route sotto `src/app/api/preventivi/`:

- `POST /api/preventivi` — corpo: `{ statoForm: StatoForm, protocollo, cliente,
  ... }`. Crea (o riusa, cercando per nome+comune+provincia) il `Cliente`, crea
  `Preventivo` (il protocollo deve essere nuovo — altrimenti 409, usare invece
  `POST /api/preventivi/[id]/revisioni`) e una `Revisione` numero 1 con
  `stato: 'bozza'`, salvando i tre JSON serializzati.
- `POST /api/preventivi/[id]/revisioni` — corpo: `{ statoForm: StatoForm }`.
  Aggiunge una nuova `Revisione` a un `Preventivo` esistente, con
  `numero = ultimoNumero + 1` e `stato: 'bozza'`. È il modo per modificare un
  preventivo che ha già una revisione `inviata`/`firmata` senza toccarla
  (vincolo 6): non un update, una nuova riga.
- `PUT /api/preventivi/[id]/revisioni/[numero]` — aggiorna una revisione
  **solo se `stato === 'bozza'`**; su una revisione `inviata`/`firmata` risponde
  409 (va creata una nuova revisione con `POST .../revisioni`, non sovrascritta —
  altrimenti si viola il vincolo 6 per la prima volta proprio nel percorso che
  dovrebbe proteggerlo).
- `GET /api/preventivi` — elenco preventivi con l'ultima revisione di ciascuno
  (numero, stato, data, cliente, protocollo) per la pagina di elenco.
- `GET /api/preventivi/[id]/revisioni/[numero]` — carica una revisione
  (`deserializzaRevisione`).

### UI

- Bottone **"Salva bozza"** in `src/app/preventivi/nuovo/page.tsx`, accanto al
  wizard: chiama `POST` (creazione) o `PUT` (se si sta già editando una bozza
  esistente — la pagina tiene un `preventivoId`/`numero` in stato locale una
  volta salvata la prima volta).
- Nuova pagina `src/app/preventivi/page.tsx`: tabella con elenco preventivi
  (cliente, protocollo, ultima revisione, stato), ciascuna riga linka a
  `/preventivi/[id]/revisioni/[numero]`.
- Nuova pagina `src/app/preventivi/[id]/revisioni/[numero]/page.tsx`:
  - se `stato === 'bozza'`: monta `FormStrutturato` con `statoIniziale` dal
    `StatoForm` deserializzato — comportamento identico a oggi quando arriva da
    `ChatApertura`, stesso meccanismo di remount già usato in `page.tsx`.
  - se `stato !== 'bozza'`: monta solo `PannelloPreview`-equivalente in sola
    lettura, costruito dal `risultatoCalcolo` congelato — **non** monta
    `FormStrutturato`, per rendere impossibile modificare per sbaglio una
    revisione già firmata.

### Test

- `domain/persistenza.test.ts`: round-trip con `statoForm` incluso (estende il
  test esistente).
- Route API: test con un client Prisma reale su SQLite in-memory/file
  temporaneo (stesso approccio già usato per lo schema esistente, da
  verificare quale libreria di test DB il progetto usa già, se nessuna va
  scelta la più semplice: query dirette con `@prisma/client` contro un file
  SQLite temporaneo creato/distrutto nel test).
- Nessun cambiamento al golden case numerico: la persistenza salva un
  `RisultatoCalcolo` già calcolato, non lo ricalcola.

---

## Fuori scope

- `esportaOfferta()` / `InputEsportazione`: non cablati a `StatoForm` in questo
  giro (deciso esplicitamente con l'utente).
- Nessuna voce di catalogo nuova per `copertura: 'piano'` (`tetto-piano`,
  `veletta-copertura-piana`): il campo è solo descrittivo per ora.
- Nessuna estensione di `ChatApertura`/estrazione AI per riempire i nuovi campi
  (`sicurezza`, `caratteristiche`, `categoria` serramenti) dalla frase iniziale:
  restano da compilare a mano nel form strutturato, come già oggi `livelli`,
  `serramenti`, `sconti`, `overrides`.
- Nessuna cancellazione/eliminazione di preventivi o revisioni dall'elenco.
- Nessuna autenticazione/autorizzazione sulle nuove route — fuori scope per il
  prototipo, come per il resto del progetto.
