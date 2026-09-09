# Preventivatore v3 — chat di apertura + computo metrico

## Problema

Oggi esistono due percorsi che non si parlano:

- Il wizard (`src/app/preventivi/nuovo/`, v1) ricava gli importi delle voci dal listino
  parametrico (`src/domain/listino.ts`) a partire da geometria digitata a mano: mq per
  piano, perimetro, dimensioni dei serramenti. Per ottenere un prezzo corretto voce per
  voce serve che quei numeri siano precisi — un lavoro granulare che spesso duplica un
  calcolo già fatto altrove.
- La pagina `src/app/preventivi/conteggi/` (vedi
  `docs/superpowers/specs/2026-09-01-conteggi-da-computo-design.md`) ricava gli stessi
  importi dal computo metrico Primus già prodotto dall'ufficio tecnico, applicando le
  regole FBE. È autonoma: non scrive su nessun preventivo. Il suo stesso spec la
  chiudeva dicendo che "il collegamento al wizard è un passo successivo".

Questo design è quel passo successivo, ma non sostituisce il wizard: apre una **terza
versione** (`nuovo-v3/`) che tiene la chat di apertura come la v1 e aggiunge il computo
metrico come fonte di prezzo alternativa al calcolo parametrico, voce per voce. v1 e v2
restano invariate.

## Cosa cambia rispetto a v1

Nel wizard di v1, ogni voce del catalogo (`CATALOGO_VOCI`) prende il suo importo da una
di tre fonti, decise da `eseguiCalcolo` (`src/domain/calcolo.ts`) in quest'ordine:

1. `input.overrides[voce.id]`, se presente — digitato a mano in `StepPrezzi`;
2. `voce.importoTestualeDefault` — voci sempre `comprese` per catalogo;
3. il driver del listino (`src/domain/listino.ts`) applicato alla geometria del wizard —
   es. `pareti-mhm` = 597 €/mq × superficie lorda.

La (3) è il calcolo granulare che si vuole evitare quando esiste già un computo metrico:
non bisogna più fidarsi che mq digitati a mano diano lo stesso importo che l'ufficio
tecnico ha già misurato voce per voce nel computo. La v3 aggiunge una **quarta fonte**,
che si comporta come la (1) (un override) ma è popolata automaticamente dal computo
invece che digitata: la voce resta un override scritto in `stato.overrides`, con
provenienza `'manuale'` come qualunque altro override — non serve un quarto valore oltre
a `proposto | manuale | ripartito` del vincolo #7 di `CLAUDE.md`, perché scritto in
`overrides` è esattamente cosa succede oggi quando lo si digita a mano in `StepPrezzi`.

Questo è possibile perché gli `idMaster` usati da `src/domain/computo/regole-conteggio.ts`
sono **già allineati** agli id di `CATALOGO_VOCI` (`pareti-mhm`, `copertura-falda`,
`cartongesso-q2`, `infissi-pvc`, `monoblocchi`, `trave-larice`, `solaio-interpiano`,
`progettazione-esecutiva`, `tracciamento-impianti`, `pareti-telaio`,
`assistenza-cartongessisti`, `cappotto`) — non serve nessuna tabella di mappatura,
si scrive direttamente `overrides[voce.idMaster]`.

Restano fuori dal catalogo (nessuna voce corrispondente in `CATALOGO_VOCI` oggi):
`copertura-piana` e `veletta-perimetrale`. Il conteggio le produce comunque (di norma
`'compresa'`); lo step le mostra con un avviso non bloccante invece di scriverle in
`overrides`, coerente con la sezione "Fuori perimetro" dello spec dei conteggi.

## Cosa NON cambia

- `StepGeometria` e `StepConfigurazione` restano identici a v1, invariati byte per byte.
  Non sono ridondanti nemmeno quando tutte le voci prezzate arrivano dal computo:
  - `superfici` decide `numeroPianiAbitativi` (condizione di inclusione del
    `solaio-interpiano`) e `superficieGarage` (condizione di inclusione di `garage`);
  - `serramenti` alimenta la tabella "mq lordi/netti" mostrata nel documento (vedi il
    golden case di `CLAUDE.md`: `30,50 mq lordi · 15,89 mq netti`), che è testo del
    documento e non un driver di prezzo;
  - `caratteristiche` (spessori) alimenta l'interpolazione dei placeholder nelle
    descrizioni voce (`interpolaPlaceholder`), indipendente da chi ha prezzato la voce.
- `garage` e `opere-chiavi-in-mano` — non coperte dalle regole del computo — continuano a
  prezzarsi come in v1: driver da geometria o override manuale in `StepPrezzi`. Nessuna
  logica nuova per loro.
- `src/domain/calcolo.ts`, `src/domain/listino.ts`, `src/domain/voci.ts`,
  `src/domain/computo/*`: **zero modifiche**. La v3 è composizione di componenti
  esistenti, non un nuovo motore.
- Sconti a cascata, arrotondamento, riconciliazione con il totale target: la sequenza in
  `eseguiCalcolo` non sa da dove viene un override e continua a funzionare invariata.

## Architettura

Nuova cartella `src/app/preventivi/nuovo-v3/`, che **duplica** lo scheletro di `nuovo/`
invece di parametrizzare i componenti condivisi — stessa convenzione già in uso tra
`nuovo/` e `nuovo-v2/` (`ChatApertura` e `ImportazioneExcel` sono già due componenti
separati, non uno parametrizzato).

```
nuovo-v3/
  page.tsx                    — ChatApertura (v1, invariata) + WizardConSalvataggioV3
  WizardConSalvataggioV3.tsx  — copia di ../WizardConSalvataggio.tsx, punta a FormStrutturatoV3
  FormStrutturatoV3.tsx       — copia di ../nuovo/FormStrutturato.tsx, 7 step invece di 6
  steps/
    StepComputoMetrico.tsx    — nuovo
```

Tutti gli step tranne quello nuovo sono importati da `../nuovo/steps/...`, non duplicati:
`StepAnagrafica`, `StepConfigurazione`, `StepGeometria`, `StepPrezzi`, `StepCondizioni`,
`StepCondizioniContrattuali`. `stato-form.ts`, `mappatura-estrazione.ts`,
`conversazione-apertura.ts` restano quelli di `nuovo/`, importati senza modifiche.

Nessun file di v1 o v2 viene toccato.

### `FormStrutturatoV3.tsx`

Stessa struttura di `FormStrutturato.tsx` (stato locale, `aggiorna`, merge di
`aggiornamentoEsterno` per i follow-up della chat), con un titolo di step in più:

```
['Anagrafica', 'Configurazione', 'Geometria', 'Computo metrico', 'Prezzi', 'Condizioni', 'Condizioni contrattuali']
```

e il rendering di `StepComputoMetrico` fra `StepGeometria` e `StepPrezzi`.

### `StepComputoMetrico.tsx`

Firma standard di uno step: `{ stato, aggiorna }: { stato: StatoForm; aggiorna: (parziale: Partial<StatoForm>) => void }`.

Riusa senza modifiche, importandoli da `../conteggi/...` e `@/domain/computo/...`:

- `CaricamentoComputo` — area di drop del PDF, estrazione (`frammentiDaPdf`,
  `estraiComputo`), riscontro (voci lette, totale ricomposto, verifica di integrità);
- `eseguiConteggio` (`@/domain/computo/conteggio`) — regole e riconciliazione;
- `SchedaVoce` — una scheda per voce conteggiata con tariffa, formula, risultato,
  correggibile a mano;
- `Riconciliazione` — somma, target, delta, tabella master.

Stato locale dello step (non in `StatoForm`, per gli stessi motivi della pagina
`/conteggi`): `computo: Computo | null`, `overrideLocali: Record<string, number>` per le
correzioni pre-conferma sulle singole voci, prima che entrino nel wizard.

**Scrittura nel wizard.** Ogni volta che `eseguiConteggio` produce (o l'utente corregge)
un valore per una voce con `idMaster` presente in `CATALOGO_VOCI`, lo step chiama:

```ts
aggiorna({ overrides: { ...stato.overrides, [voce.idMaster]: valoreNormalizzato } })
```

Il merge parte sempre da `stato.overrides` corrente (non da un oggetto vuoto): non
sovrascrive override già presenti per voci che il computo non tocca (es. `garage`,
digitato a mano in `StepPrezzi`). Questo passa dalla stessa `aggiorna` locale di
`FormStrutturatoV3` già usata da ogni altro step — **non** dal meccanismo
`aggiornamentoEsterno` usato dalla chat, che fa un merge shallow a livello di
`StatoForm` intero e sovrascriverebbe l'intero oggetto `overrides` invece di fonderlo
voce per voce.

`valoreNormalizzato` converte il vocabolario del conteggio in quello di `StatoForm`:

```ts
function normalizzaImporto(importo: number | 'compresa'): number | 'comprese' {
  return importo === 'compresa' ? 'comprese' : importo
}
```

Le voci con `idMaster` senza corrispondenza in `CATALOGO_VOCI` (`copertura-piana`,
`veletta-perimetrale`) non scrivono in `overrides`: vengono mostrate con un avviso
("questa voce del computo non ha una voce corrispondente nel catalogo attuale") invece di
sparire in silenzio.

**Rimozione di un override.** "Ripristina" su una `SchedaVoce` (come già in `/conteggi`)
rimuove la chiave da `stato.overrides`, riportando la voce al comportamento di default di
`eseguiCalcolo` (driver da geometria, se esiste, altrimenti 0) — stesso comportamento di
cancellare a mano il campo in `StepPrezzi`.

**Nessun caricamento del computo.** Se l'utente non usa questo step, `stato.overrides`
resta quello che arriva dalla chat/da `StepPrezzi`: il comportamento è identico a v1.

## Navigazione

Aggiunto un link "Nuovo preventivo (da computo metrico)" nella dashboard
(`src/app/preventivi/page.tsx` o dove già vive il link a `/preventivi/conteggi`, aggiunto
di recente), verso `/preventivi/nuovo-v3`.

## Test

- `nuovo-v3/steps/normalizza-importo.test.ts` (o dentro `StepComputoMetrico.test.ts`):
  conversione `'compresa'` → `'comprese'`, passthrough dei numeri.
- Test che, dato un `stato.overrides` con una voce già impostata (es. `garage: 12000`) e
  un conteggio che valorizza `pareti-mhm`, il merge produce **entrambe** le chiavi in
  `overrides` — copre esplicitamente il rischio di sovrascrittura totale descritto sopra.
- Voci fuori catalogo (`copertura-piana`, `veletta-perimetrale`): non compaiono in
  `overrides`, compare l'avviso.
- Nessun nuovo test sul motore (`calcolo.ts`, `computo/*`): non cambia.
- Verifica manuale nel browser: caricare una fixture di computo (es. Crivellaro) nello
  step, controllare che `PannelloPreview` (a destra nel wizard) rifletta i nuovi importi
  e che il golden case di `CLAUDE.md` (Listino 2026 = 237 000,00, PARZIALE = 190 900,00,
  TOTALE = 300 000,00) sia raggiungibile impostando gli stessi sconti/arrotondamento.

## Fuori perimetro

- Nessuna modifica a v1 o v2.
- Nessuna modifica al motore di calcolo, al catalogo voci o alle regole di conteggio.
- Aggiungere `copertura-piana`/`veletta-perimetrale` al catalogo: fuori da questo giro,
  restano un avviso.
- Congelamento del listino per la v3 (vincolo #6): già gestito da
  `WizardConSalvataggioV3` esattamente come in v1/v2 (la revisione salva una copia di
  `inputCalcolo`/`risultatoCalcolo`, non un riferimento) — nessuna logica nuova da
  scrivere.
