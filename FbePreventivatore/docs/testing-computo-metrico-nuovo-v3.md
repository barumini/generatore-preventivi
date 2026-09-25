# Guida al test — `/preventivi/nuovo-v3`, step "Computo metrico"

Riferimento: motore in [`src/domain/computo/`](../src/domain/computo/) (estrazione PDF → conteggio
per categoria → override del catalogo). Due golden case coprono l'intera pipeline:
**Crivellaro rev.04** e **Da Croce rev.03**. Se questi numeri non tornano, il motore è rotto —
sono test, non documentazione (stesso principio del golden case commerciale in
[`CLAUDE.md`](../CLAUDE.md) e in [`testing-golden-case-crivellaro.md`](testing-golden-case-crivellaro.md)).

`nuovo-v3` aggiunge un terzo punto di ingresso rispetto ai due descritti in
`testing-golden-case-crivellaro.md`: oltre alla compilazione manuale (`/nuovo`) e all'import Excel
(`/nuovo-v2`), lo step **"3. Computo metrico"** legge direttamente il PDF Primus del computo e
propone gli importi di listino calcolati per categoria — non i valori "digitati" e arrotondati del
golden case commerciale.

**Importante — due livelli di verità diversi, non confonderli:**

- I numeri di questo file (`sommaVoci`, `target`, `delta`, importo per voce) sono quelli prodotti
  dalla pipeline `computo → conteggio` a partire dal PDF reale: valori parametrici, non tondi.
- I numeri di `testing-golden-case-crivellaro.md` (Listino 237 000, PARZIALE 190 900, TOTALE
  300 000) sono quelli del preventivo firmato dal cliente, con override **digitati a mano** nello
  step "Prezzi" — deliberatamente diversi da quelli proposti dal computo (vedi CLAUDE.md §7:
  "l'AI non decide i prezzi").

---

## 1. Dati di test

| | Crivellaro rev.04 | Da Croce rev.03 |
|---|---|---|
| PDF computo | `Documentazione addestramento/Computo Crivellaro rev04.PDF.pdf` | `Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF` |
| Offerta di riscontro | `Documentazione addestramento/Offerta MHM rev.04_crivellaro.pdf` | `Documentazione addestramento/x IA/Offerta MHM rev.02_Dacroce Dalila riscontro.pdf` |
| Fixture committata (JSON, usata dai test Vitest di dominio) | [`src/domain/computo/fixtures/crivellaro.json`](../src/domain/computo/fixtures/crivellaro.json) | [`src/domain/computo/fixtures/dacroce.json`](../src/domain/computo/fixtures/dacroce.json) |
| Copia PDF committata (usata dalla suite E2E) | [`e2e/fixtures/computo-crivellaro.pdf`](../e2e/fixtures/computo-crivellaro.pdf) | [`e2e/fixtures/computo-dacroce.pdf`](../e2e/fixtures/computo-dacroce.pdf) |
| Cliente / cantiere | Crivellaro Mariano — Trissino (VI) | Dacroce Dalila — Rovereto (TN) |

I PDF sorgente vivono in `Documentazione addestramento/` (**non committata**, ~33 MB, verifica di
averla in locale). Le fixture JSON in `src/domain/computo/fixtures/` sono invece committate e sono
la fonte di verità per i test Vitest di dominio: se il PDF non è disponibile, `npm test` resta
comunque eseguibile. Le due copie in `e2e/fixtures/` sono committate apposta per la suite E2E
(sezione 3): stessi PDF, rinominati senza spazi.

---

## 2. Test automatici (equivalenti di dominio)

```bash
npm test -- src/domain/computo/
```

Copre entrambi i golden case end-to-end (estrazione, riepilogo, conteggio, avvisi, guardrail) su
7 file / ~110 test. Per isolare solo il livello di pipeline che arriva fino al `Listino` (usato da
`nuovo-v3`):

```bash
npm test -- src/app/preventivi/nuovo-v3/
```

`pipeline-computo.integration.test.ts` verifica in particolare il percorso completo
`estraiComputo → eseguiConteggio → mappaConteggioAOverride → eseguiCalcolo` sul caso Crivellaro.

---

## 3. Test E2E automatico (Playwright, browser reale)

```bash
npm run test:e2e
```

A differenza della sezione 2, questa suite ([`e2e/computo-metrico-golden-cases.spec.ts`](../e2e/computo-metrico-golden-cases.spec.ts))
non chiama le funzioni di dominio: apre `/preventivi/nuovo-v3` in un browser Chromium reale (via
`@playwright/test`), passa allo step "3. Computo metrico", carica i PDF committati in
`e2e/fixtures/` con un vero upload di file e legge i risultati dal DOM — la stessa `pdfjs-dist`
che gira per un utente vero, non una fixture JSON pre-estratta. Copre entrambi i golden case
(Crivellaro e Da Croce) con gli stessi numeri delle sezioni 4.1/4.2 sotto: voci lette, categorie,
totale computo, riconciliazione (`sommaVoci`/`target`/`delta`), importo per ogni voce di catalogo,
avviso sicurezza, voci scartate/escluse.

Il `webServer` in [`playwright.config.ts`](../playwright.config.ts) avvia `npm run dev` da solo se
la porta 3000 è libera, altrimenti riusa il dev server già in esecuzione — non serve avviarlo a
mano prima di lanciare la suite. Al primo utilizzo serve il browser Chromium di Playwright:

```bash
npx playwright install chromium
```

Per debuggare un test che fallisce, `npm run test:e2e:ui` apre l'UI interattiva di Playwright
(timeline, DOM snapshot per ogni step, screenshot/trace al fallimento).

Selettori: le schede voce e i valori chiave dello step hanno `data-testid` dedicati
(`computo-voci-lette`, `computo-categorie`, `computo-totale`, `riconciliazione-somma-voci`,
`riconciliazione-target`, `riconciliazione-delta`, `importo-voce-<idMaster>`,
`avviso-<codice avviso>`) aggiunti apposta in
[`CaricamentoComputo.tsx`](../src/app/preventivi/conteggi/CaricamentoComputo.tsx),
[`SchedaVoce.tsx`](../src/app/preventivi/conteggi/SchedaVoce.tsx) e
[`StepComputoMetrico.tsx`](../src/app/preventivi/nuovo-v3/steps/StepComputoMetrico.tsx): non
dipendono dal testo visibile (che può cambiare per motivi di copy) né dalle classi Tailwind (che
possono cambiare per motivi di stile).

---

## 4. Test manuale in browser

```bash
npm run dev
```

Apri `http://localhost:3000/preventivi/nuovo-v3`, vai allo step **"3. Computo metrico"** e carica
il PDF (drag&drop o dal selettore file: "Il PDF resta nel browser: non viene caricato da nessuna
parte" — l'estrazione con `pdfjs-dist` gira lato client). Se non hai un mouse/file-picker a
disposizione (es. sessione automatizzata), vedi la nota a fondo pagina.

### 4.1 Caso Crivellaro rev.04

Dopo il caricamento, verifica nel riquadro "Computo metrico":

- **File letto** → `166 voci`, `8 categorie`, **Totale computo `260 260,99 €`**
- Alert verde "Verifica superata: la somma delle voci pareggia il riepilogo"

Nella sezione "Riconciliazione fra le voci conteggiate e il totale del computo":

```
Somma delle voci conteggiate        215 815,97 €
Totale computo − 23 300,00 € sicurezza   236 960,99 €   (da 260 260,99 €)
Delta caricato sulle pareti strutturali   21 145,02 €
```

Importi per voce (schede sopra la riconciliazione):

| Voce | Importo |
|---|---:|
| `pareti-mhm` | 100 645,84 € *(79 500,82 di categoria + 21 145,02 di delta)* |
| `trave-larice` | 5 843,70 € |
| `solaio-interpiano` | `compresa` *(categoria SOLAIO = 0 nel computo)* |
| `copertura-falda` | 58 849,06 € |
| `cappotto` | 21 253,32 € |
| `cartongesso-q2` | 15 506,77 € |
| `assistenza-cartongessisti` | 2 162,30 € |
| `infissi-pvc` | 19 250,00 € |
| `monoblocchi` | 9 450,00 € |

Avvisi attesi: "Il computo riporta costi sicurezza di 23 352,50, mentre il pareggio usa i
23 300,00 forfettari" (`sicurezza-diversa`, livello avviso — non blocca nulla). Nessun avviso di
livello `errore`.

Voci scartate (nel catalogo ma senza corrispondenza in questo computo): `copertura-piana`,
`veletta-perimetrale`. Voci escluse dalla configurazione: `solaio-interpiano` — qui perché la
categoria SOLAIO di *questo* computo vale zero (Crivellaro è monopiano), non perché il wizard la
escluda sempre: vedi Note in fondo su come `numeroPianiAbitativiDalComputo` la deriva dal
computo caricato, non da uno step "Geometria" che non esiste in questa versione.

### 4.2 Caso Da Croce rev.03

Stessa procedura, PDF Da Croce. Verifica:

- **File letto** → `166 voci`, `8 categorie`, **Totale computo `323 643,58 €`**
- Alert verde "Verifica superata..."

Riconciliazione:

```
Somma delle voci conteggiate        278 787,93 €
Totale computo − 23 300,00 € sicurezza   300 343,58 €   (da 323 643,58 €)
Delta caricato sulle pareti strutturali   21 555,65 €
```

Importi per voce:

| Voce | Importo |
|---|---:|
| `pareti-mhm` | 127 543,28 € *(105 987,63 di categoria + 21 555,65 di delta)* |
| `trave-larice` | 10 104,24 € |
| `solaio-interpiano` | 15 240,96 € *(categoria SOLAIO non a zero → numeroPianiAbitativiDalComputo rileva "multipiano" ed entra nel Listino, a differenza di Crivellaro — vedi 4.3)* |
| `copertura-falda` | 54 474,19 € |
| `cappotto` | 21 624,51 € |
| `cartongesso-q2` | 18 975,90 € |
| `assistenza-cartongessisti` | 2 655,50 € |
| `infissi-pvc` | 31 230,00 € |
| `monoblocchi` | 14 495,00 € |
| `progettazione-esecutiva` | 4 000,00 € *(importo fisso, non dal computo)* |

Stesso avviso sicurezza (23 352,50 vs 23 300 forfettari). Stesse voci scartate (`copertura-piana`,
`veletta-perimetrale`), ma **nessuna voce esclusa dalla configurazione** — a differenza di
Crivellaro, qui `solaio-interpiano` entra nel Listino: Da Croce è davvero un edificio a due piani
(Piano Terra 138 mq + Piano Primo 62 mq, confermato nell'offerta reale
`Documentazione addestramento/x IA/Offerta MHM rev.02_Dacroce Dalila riscontro.pdf`, pag. 4), e il
computo lo segnala da solo.

### 4.3 Verifica di coerenza incrociata

Entrambi i computi condividono la stessa struttura (166 voci, 8 categorie, stesso ordine di voci
master, stesso avviso sicurezza) pur avendo importi diversi: è un segnale che il parser Primus
(`estrai-voci.ts`) e le regole di conteggio (`regole-conteggio.ts`) generalizzano bene, non che i
due PDF sono uguali. Se una futura modifica cambia il numero di voci/categorie per uno solo dei
due casi senza una ragione nel PDF sorgente, è quasi certamente un regressione nel parser.

---

## 5. Dal computo all'esportazione (.docx) — Prezzi, Condizioni e i due guardrail

Stesso percorso documentato per Da Croce in
[`testing-golden-case-dacroce.md`](testing-golden-case-dacroce.md#4-dal-computo-al-preventivo-commerciale--step-4-prezzi--5-condizioni),
qui **verificato dal vivo anche su Crivellaro** — i campi sono nello stesso posto per entrambi i
casi, essendo lo stesso `StatoForm`/wizard:

- **sconti (percentuale + causale)** → step **"5. Condizioni"**, non "4. Prezzi"
- **"Totale target (per risoluzione arrotondamento)"** → step **"4. Prezzi"**, sotto l'override
  delle voci
- **"Chiavi in mano nel totale"** (checkbox, default **deselezionata**) → step
  **"2. Configurazione"**: senza spuntarla, la voce `opere-chiavi-in-mano` resta esclusa (vedi
  Note in fondo per la voce `garage`, che invece non è mai raggiungibile in questa versione)

Con gli 11 override del golden case, i 2 sconti (10% + 10%) e "Chiavi in mano" spuntata,
`TOTALE AL NETTO` risolve comunque a **300 000,00 €** (l'Arrotondamento assorbe l'assenza del
`garage`) — numeri completi nella Nota in fondo alla pagina.

### Guardrail export 1 — spessori non interpolati (step "2. Configurazione")

Identico a Da Croce: coi 4 campi spessore vuoti, `esportaOfferta` si rifiuta con
`descrizioni con placeholder di spessore non interpolati: {{spessoreEsterno}}, ...`. Per
Crivellaro, l'offerta reale (`Offerta MHM rev.04_crivellaro.pdf`) usa **lo stesso identico
wording di Da Croce** (stesso sistema costruttivo FBE standard), quindi gli stessi valori:

| Campo | Valore |
|---|---|
| Spessore pareti esterne (mm) | `205` |
| Spessore pareti interne (mm) | `205-160` |
| Spessore coibente falda (mm) | `80+60+20` |
| Spessore cappotto (mm) | `60+40` |

(Da non confondere con gli spessori `205/160/200/140` usati in
[`testing-golden-case-crivellaro.md`](testing-golden-case-crivellaro.md#31-precompilazione-via-ai--chat-apertura-rapida):
quelli sono valori di comodo scelti solo per testare la copertura dello schema di estrazione AI,
non una trascrizione dell'offerta reale — i due file testano cose diverse, non c'è un numero
"giusto" unico.)

### Guardrail export 2 — placeholder di protocollo in copertina (step "1. Anagrafica")

Col campo `Protocollo` vuoto, la preview mostra l'avviso "È presente un placeholder di protocollo
non sostituito in copertina" e l'export si blocca allo stesso modo di Da Croce. Per Crivellaro il
protocollo reale è `2026059` (dall'intestazione dell'offerta rev.04, "PROT 2026059_REV. 04" —
coincide col valore già usato in `testing-golden-case-crivellaro.md`).

**Verificato dal vivo**: con `Protocollo` e i 4 spessori compilati, entrambi gli avvisi
scompaiono dalla preview. Non ho completato l'export per questo caso specifico — il database di
sviluppo aveva già un preventivo salvato con protocollo `2026059` da una sessione precedente, e
`Salva bozza` rifiuta un secondo preventivo con lo stesso protocollo ("usa aggiungiRevisione per
aggiungere una revisione, non crearne uno nuovo") — comportamento atteso, non un guardrail rotto,
ma noto per chi ripete il test partendo da un database non vuoto.

---

## 6. Nota: caricare il PDF senza dialog di sistema (senza Playwright)

Per un test ripetibile, la sezione 3 (Playwright) è il modo giusto: `setInputFiles` carica un file
reale senza dialog nativi, senza questo escamotage. Questa nota resta utile per un'ispezione
manuale ad-hoc dentro una sessione che pilota un browser via CDP/accessibility tree ma senza
Playwright installato (es. un agente con solo gli strumenti di automazione del browser).

In una sessione senza controllo diretto del mouse/file-picker del sistema operativo (es. un
agente che pilota il browser via CDP/accessibility tree), l'input `<input type="file">` non è
scrivibile via JavaScript per motivi di sicurezza del browser. Percorso alternativo verificato:

1. Copia temporaneamente il PDF in `public/` (root servita da Next.js), es.
   `cp "Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF" public/_tmp-test.pdf`.
2. Nella pagina, esegui:

   ```js
   const resp = await fetch('/_tmp-test.pdf')
   const buf = await resp.arrayBuffer()
   const file = new File([buf], 'Computo Dacroce Dalila - senza terrazzo.PDF', { type: 'application/pdf' })
   const dt = new DataTransfer()
   dt.items.add(file)
   const dropZone = document.querySelector('input[type="file"][accept*="pdf"]').closest('label')
   dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
   ```

   Questo passa dal vero `onDrop` del componente ([`CaricamentoComputo.tsx`](../src/app/preventivi/conteggi/CaricamentoComputo.tsx)),
   quindi esercita la stessa `frammentiDaPdf` → `estraiComputo` → `eseguiConteggio` che gira per un
   utente reale — non è un bypass del codice applicativo, solo dell'interazione manuale col
   file-picker del sistema operativo.
3. **Rimuovi il file temporaneo da `public/` a fine test** (`rm public/_tmp-test.pdf`): non va
   committato né lasciato nel working tree.

---

## Note

- `nuovo-v3` non ha uno step "Geometria" (rimosso su richiesta esplicita: i conteggi si ricavano
  esclusivamente dal computo metrico, non da un dato inserito a mano). Superfici, perimetro e
  serramenti restano ai default vuoti/0, ma `numeroPianiAbitativi` **non** ne dipende più:
  [`numeroPianiAbitativiDalComputo`](../src/app/preventivi/nuovo-v3/mappa-conteggio.ts) lo deriva
  dal computo stesso — se la categoria SOLAIO del Primus è valorizzata (voce
  `solaio-interpiano` numerica, non `'compresa'`), riconosce un edificio multipiano e la include
  nel Listino, esattamente come nel caso Da Croce (sezione 4.2). `superficieGarage` resta invece
  sempre 0: il Primus non ha una categoria "garage" distinta da cui dedurne la presenza, quindi
  la voce `garage` (che comunque il conteggio non calcola mai: non è fra gli idMaster prodotti da
  `eseguiConteggio`, va sempre digitata a mano) resta configurabile solo nello step "Prezzi", non
  proponibile automaticamente in nessuna versione del wizard basata sul computo.
- **Limitazione verificata — la voce `garage` resta esclusa anche con override digitato a mano.**
  `garage` è condizionata da `garage-presente` (`src/domain/voci.ts`), che dipende da
  `superficieGarage > 0`. Siccome `nuovo-v3` non ha uno step "Geometria", `superficieGarage` non è
  mai impostabile e resta 0 per l'intera sessione: digitare un valore nell'override `garage` dello
  step "Prezzi" (es. `20000`, il valore del golden case Crivellaro) **non basta** — la condizione
  resta falsa e la riga "Garage" non compare mai nel preventivo, silenziosamente (nessun errore,
  nessun avviso). Verificato manualmente in browser il 2026-09-23: con tutti gli 11 override del
  golden case compilati, i 2 sconti a cascata e "Chiavi in mano nel totale" spuntata, il motore
  ottiene comunque `TOTALE AL NETTO` = 300 000,00 € (risolve correttamente l'arrotondamento
  inverso, vincolo CLAUDE.md §3), ma con numeri intermedi diversi da quelli "canonici" perché manca
  l'addendo garage: `Arrotondamento` = **+ 18 930,00 €** (non − 1 070,00 €) e `PARZIALE AL GREZZO
  AVANZATO` = **210 900,00 €** (non 190 900,00 €). Chi riproduce il golden case commerciale su
  `nuovo-v3` deve aspettarsi questi due numeri diversi, non un bug del motore — per il golden case
  "pieno" con la riga Garage, usare `/nuovo` o `/nuovo-v2` (che hanno lo step Geometria).
- Le sezioni 1–2 del [golden case commerciale](testing-golden-case-crivellaro.md) restano valide
  per testare gli step successivi (4. Prezzi, 5. Condizioni) di `nuovo-v3`: sono lo stesso
  `StatoForm` e lo stesso motore `src/domain/calcolo.ts` di `/nuovo`. La differenza è solo nella
  provenienza degli override di listino: digitati a mano lì, proposti dal conteggio qui — con
  l'eccezione della voce `garage`, vedi punto precedente.
- "Ripristina" su una scheda dello step "Computo metrico" annulla solo una correzione manuale
  fatta in quella pagina, non rimuove l'importo dal preventivo (resta comunque nello step
  "Prezzi").
- La suite E2E (sezione 3) non sostituisce i test Vitest di dominio (sezione 2): copre il
  cablaggio reale (upload → `pdfjs-dist` → DOM), i test di dominio coprono la logica di calcolo
  con molti più casi e guardrail (166 test contro 2 scenari E2E). Un bug nella pipeline di
  estrazione/conteggio va aggiunto prima come test Vitest — l'E2E è la prova che il browser vede
  davvero quello che i test di dominio promettono, non il posto dove esplorare i casi limite.
