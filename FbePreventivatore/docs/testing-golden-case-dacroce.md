# Golden case Da Croce rev.03 — tutorial per il test manuale

Riferimento: motore in [`src/domain/computo/`](../src/domain/computo/), stesso principio dei
golden case in [`CLAUDE.md`](../CLAUDE.md) — se questi numeri non tornano, il motore è rotto,
non è un dettaglio di documentazione.

Cliente / cantiere: **Dacroce Dalila — Rovereto (TN)**, edificio a due piani (Piano Terra 138 mq
+ Piano Primo 62 mq). A differenza di Crivellaro (monopiano), qui la categoria SOLAIO del
computo Primus è valorizzata: `solaio-interpiano` entra nel Listino invece di risultare
`compresa`.

Questo file copre **solo** il caso Da Croce. Per Crivellaro e per il golden case commerciale
(sconti a cascata, `TOTALE AL NETTO`) vedi [`testing-golden-case-crivellaro.md`](testing-golden-case-crivellaro.md)
e [`testing-computo-metrico-nuovo-v3.md`](testing-computo-metrico-nuovo-v3.md) (che copre
entrambi i casi insieme).

---

## 1. Stato dei test automatici (verificato in questa sessione)

```bash
npm test -- src/domain/computo/ src/app/preventivi/nuovo-v3/
```

Risultato: **9 file di test, 126 test, tutti verdi** (eseguito il 2026-09-23). I test rilevanti
per il caso Da Croce sono in
[`src/domain/computo/conteggio.test.ts`](../src/domain/computo/conteggio.test.ts)
(`describe('eseguiConteggio — golden case Dacroce rev.03', …)`), oltre ai casi puntuali in
[`accesso.test.ts`](../src/domain/computo/accesso.test.ts),
[`estrai-voci.test.ts`](../src/domain/computo/estrai-voci.test.ts) e
[`fixtures.test.ts`](../src/domain/computo/fixtures.test.ts) che usano la stessa fixture
[`dacroce.json`](../src/domain/computo/fixtures/dacroce.json).

Per isolare solo quel `describe`:

```bash
npm test -- src/domain/computo/conteggio.test.ts -t Dacroce
```

---

## 2. Numeri attesi (golden case Da Croce rev.03)

```
File letto              166 voci · 8 categorie
Totale computo           323 643,58 €
Somma voci conteggiate   278 787,93 €
Target (totale − sicurezza forfettaria)   300 343,58 €
Delta caricato su pareti-mhm               21 555,65 €
```

Importo per voce di catalogo:

| id voce | Importo |
|---|---:|
| `pareti-mhm` | 127 543,28 € *(105 987,63 di categoria + 21 555,65 di delta)* |
| `trave-larice` | 10 104,24 € |
| `solaio-interpiano` | 15 240,96 € *(non `compresa`: qui il computo rileva un edificio multipiano)* |
| `copertura-falda` | 54 474,19 € |
| `cappotto` | 21 624,51 € |
| `cartongesso-q2` | 18 975,90 € |
| `assistenza-cartongessisti` | 2 655,50 € |
| `infissi-pvc` | 31 230,00 € |
| `monoblocchi` | 14 495,00 € |
| `progettazione-esecutiva` | 4 000,00 € *(importo fisso, non dal computo)* |

Avviso atteso: "Il computo riporta costi sicurezza di 23 352,50, mentre il pareggio usa i
23 300,00 forfettari" (codice `sicurezza-diversa`, livello `avviso`, non blocca nulla). Nessun
avviso di livello `errore`. Voci scartate (nel catalogo, senza corrispondenza in questo
computo): `copertura-piana`, `veletta-perimetrale`. **Nessuna voce esclusa** dalla
configurazione (a differenza di Crivellaro, dove `solaio-interpiano` viene esclusa).

---

## 3. Test manuale in browser — `/preventivi/nuovo-v3`

### Prerequisiti

- Il PDF sorgente vive in `Documentazione addestramento/x IA/Computo Dacroce Dalila - senza
  terrazzo.PDF` (cartella **non committata**, ~33 MB — verifica di averla in locale). In
  alternativa, per un test ripetibile senza quella cartella, usa la copia committata in
  [`e2e/fixtures/computo-dacroce.pdf`](../e2e/fixtures/computo-dacroce.pdf) (stesso file,
  rinominato senza spazi).
- Server di sviluppo avviato:

  ```bash
  npm run dev
  ```

### Anagrafica via chat "Apertura rapida"

Prima di caricare il PDF, puoi far compilare lo step **"1. Anagrafica"** dall'AI invece che a
mano: nella pagina, sopra il wizard, c'è il riquadro "Apertura rapida" (componente
[`ChatApertura`](../src/app/preventivi/nuovo/ChatApertura.tsx)) — invia un testo libero e
`POST /api/estrazione` lo trasforma nei campi dello `StatoForm` tramite un modello locale
(schema e prompt di sistema in [`src/ai/estrazione.ts`](../src/ai/estrazione.ts)).

**Prerequisito**: LM Studio in esecuzione in locale con il server attivo (Impostazioni > Local
Server > Start Server) e la variabile d'ambiente `LM_STUDIO_MODEL` impostata al nome esatto del
modello caricato (`LM_STUDIO_BASE_URL` opzionale, default `http://localhost:1234/v1`).

Lo schema `CampiEstratti` copre per l'anagrafica solo: `cliente.nome`, `cliente.comune`,
`cliente.provincia`, `protocollo`, `progettista`, `luogo` — **non** `oggetto` né `data`, che
restano sempre da compilare a mano (non sono nello schema di estrazione, indipendentemente dal
testo inviato).

Incolla questo testo nella chat (dati reali presi dall'intestazione del computo Primus, pag. 1
di `Computo Dacroce Dalila - senza terrazzo.PDF`: committente, comune, provincia e tecnico
redattore — vedi fixture [`dacroce.json`](../src/domain/computo/fixtures/dacroce.json)):

```
Preventivo per il cliente Dacroce Dalila, comune di Rovereto, provincia TN.
Progettista: Campana Tommaso. Luogo del cantiere: Rovereto.
```

Verifica dopo l'invio:

- il form si precompila con `Cliente = Dacroce Dalila`, `Comune = Rovereto`,
  `Provincia = TN`, `Progettista = Campana Tommaso`, `Luogo = Rovereto`
- il messaggio dell'assistente segnala `protocollo` tra i campi da completare a mano (nel testo
  sopra non compare apposta: il computo Primus non riporta un numero di protocollo commerciale,
  solo dati tecnici — non va inventato, vincolo CLAUDE.md §7)
- `oggetto` e `data` restano vuoti: compilali a mano (l'intestazione del computo riporta
  `REALIZZAZIONE IN MHM DI n. 1 ABITAZIONE - NO TERRAZZO` come oggetto, se vuoi riprodurlo
  fedelmente, e la data del computo è `19/12/2025` — quest'ultima è la data del computo, non
  necessariamente quella da mettere sul preventivo)

### Passi

1. Apri `http://localhost:3000/preventivi/nuovo-v3`.
2. (Facoltativo) compila l'Anagrafica via chat come sopra, oppure a mano nello step
   **"1. Anagrafica"**.
3. Vai allo step **"3. Computo metrico"**.
4. Carica il PDF Da Croce (drag&drop sulla zona di caricamento, oppure selettore file). Il PDF
   resta nel browser: l'estrazione con `pdfjs-dist` gira lato client, nessun upload a un server.
5. Verifica nel riquadro "Computo metrico":
   - **File letto** → `166 voci`, `8 categorie`, **Totale computo `323 643,58 €`**
   - Alert verde "Verifica superata: la somma delle voci pareggia il riepilogo"
6. Nella sezione "Riconciliazione fra le voci conteggiate e il totale del computo", verifica i
   tre numeri della sezione 2 sopra (somma voci / target / delta).
7. Scorri le schede voce sopra la riconciliazione e confronta ogni importo con la tabella della
   sezione 2. In particolare verifica che `solaio-interpiano` mostri **15 240,96 €** (un numero,
   non la scritta `compresa` — è il segnale che l'edificio è stato riconosciuto come multipiano).
8. Verifica l'avviso sicurezza (giallo, non bloccante) con il testo indicato sopra.

### Se non hai un mouse/file-picker (sessione automatizzata)

L'`<input type="file">` non è scrivibile via JavaScript per motivi di sicurezza del browser.
Percorso alternativo verificato (passa dal vero `onDrop`, non è un bypass del codice
applicativo):

```bash
cp "Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF" public/_tmp-test.pdf
```

poi in console del browser:

```js
const resp = await fetch('/_tmp-test.pdf')
const buf = await resp.arrayBuffer()
const file = new File([buf], 'Computo Dacroce Dalila - senza terrazzo.PDF', { type: 'application/pdf' })
const dt = new DataTransfer()
dt.items.add(file)
const dropZone = document.querySelector('input[type="file"][accept*="pdf"]').closest('label')
dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
```

Al termine, **rimuovi il file temporaneo**: non va committato né lasciato nel working tree.

```bash
rm public/_tmp-test.pdf
```

### Selettori utili per l'ispezione (data-testid)

`computo-voci-lette`, `computo-categorie`, `computo-totale`, `riconciliazione-somma-voci`,
`riconciliazione-target`, `riconciliazione-delta`, `importo-voce-<idMaster>`,
`avviso-<codice avviso>` (es. `avviso-sicurezza-diversa`).

---

## 4. Dal computo al preventivo commerciale — step "4. Prezzi" + "5. Condizioni"

Lo step "3. Computo metrico" produce solo gli importi `proposto` (sezione 2 sopra): PARZIALE e
TOTALE restano a `0,00 €` finché non si passa dagli step successivi — **non è un bug**, è lo
stato di default prima della revisione umana (CLAUDE.md §7).

Attenzione a dove si trovano i campi, perché non sono ovvi in `nuovo-v3`:

- **sconti (percentuale + causale)** → si inseriscono nello step **"5. Condizioni"**, *non* in
  "4. Prezzi" (lì c'è solo l'override delle voci di listino e il totale target)
- **"Totale target (per risoluzione arrotondamento)"** → è invece nello step **"4. Prezzi"**, in
  fondo sotto l'override delle voci

Finché il totale target resta a `0` (default) e non c'è nessuno sconto, `risolviArrotondamento`
risolve l'Arrotondamento esattamente uguale al Listino — la preview mostra
`Arrotondamento -300 343,58 €`, `PARZIALE 0,00 €`, `TOTALE 0,00 €`. Verificato dal vivo: è lo
stesso comportamento già documentato per Crivellaro quando si salta lo step Prezzi (sezione
"Nota" di [`testing-golden-case-crivellaro.md`](testing-golden-case-crivellaro.md)).

### Riprodurre il riscontro (255 000,00 €) dell'offerta rev.02

1. Dopo aver caricato il computo (sezione 3), vai a **"5. Condizioni"** e aggiungi due sconti
   (pulsante "Aggiungi sconto" — verificato dal vivo, il primo click sull'unico bottone presente
   crea la prima riga):
   - `5` → causale `sconto cliente`
   - `10` → causale `per conferme entro il 31.01.2026`
2. Vai a **"4. Prezzi"** e imposta **Totale target = `255000`**.
3. Nella preview a destra, la tabella prezzi ora mostra:

   ```
   Listino 2026                              300 343,58 €
   SCONTO RISERVATO: 5% sconto cliente        - 15 017,18 €
   SCONTO RISERVATO: 10% per conferme...      - 28 532,64 €
   Arrotondamento                              - 1 793,76 €
   PARZIALE AL GREZZO AVANZATO                255 000,00 €
   COSTI SICUREZZA: OMAGGIO
   TOTALE AL NETTO esclusa I.V.A.             255 000,00 €
   ```

`PARZIALE` e `TOTALE` combaciano con l'offerta rev.02 (255 000,00 €), perché il motore risolve
l'Arrotondamento per atterrare esattamente sul target dato. Il valore dell'Arrotondamento risolto
(−1 793,76 €) **non** coincide con quello scritto a mano in offerta (−2 184,00 €): dipende dal
Listino di partenza diverso (300 343,58 € proposto dal conteggio contro 300 800,00 € digitato in
offerta) — è lo stesso scarto voce-per-voce spiegato nella sezione "Nota" più sotto, non un nuovo
problema. Il target di 255 000 va scelto a mano guardando l'offerta di riscontro: il motore non lo
propone da solo.

---

## 5. Dalla preview all'esportazione (.docx) — campi obbligatori prima di "Genera documento"

Il bottone "Genera documento" (accanto a "Salva bozza", compare solo dopo il primo salvataggio)
chiama `POST /api/preventivi/[id]/revisioni/[numero]/export`, che passa da
`esportaOfferta` (`src/documento/export-docx.ts`). Quella funzione ha due guardrail che bloccano
l'export con un errore esplicito finché non si compilano i campi giusti — **verificato dal vivo**:
prima di compilarli l'export fallisce con l'errore, dopo restituisce `200 OK` e genera il `.docx`.

### Guardrail 1 — spessori non interpolati (step "2. Configurazione")

Se gli spessori sono vuoti, la preview mostra le descrizioni con i placeholder letterali
(`{{spessoreEsterno}}` ecc., si vede anche negli avvisi sopra la preview) e l'export si rifiuta
con:

```
esportaOfferta: descrizioni con placeholder di spessore non interpolati: {{spessoreEsterno}},
{{spessoreInterno}}, {{spessoreCoibente}}, {{spessoreCappotto}}. [...]
```

Si risolve in fondo allo step **"2. Configurazione"**, 4 campi testo libero (non numerici: il
formato è quello scritto sull'offerta, es. `60+40`, non un singolo mm — vincolo CLAUDE.md sulle
stringhe libere per i dati "a strati"). Per Da Croce, gli stessi valori scritti nell'offerta
rev.02 (identici a quelli di Crivellaro, stesso sistema costruttivo FBE standard):

| Campo | Valore |
|---|---|
| Spessore pareti esterne (mm) | `205` |
| Spessore pareti interne (mm) | `205-160` |
| Spessore coibente falda (mm) | `80+60+20` |
| Spessore cappotto (mm) | `60+40` |

`consentiPlaceholderNonRisolti: true` sblocca l'export senza compilare nulla, ma è pensato solo
per un giro di test/dev con uno spessore deliberatamente vuoto — non usarlo per un documento
destinato a un cliente reale.

### Guardrail 2 — placeholder di protocollo in copertina (step "1. Anagrafica")

Col campo `Protocollo` vuoto, la preview mostra l'avviso "È presente un placeholder di protocollo
non sostituito in copertina" e l'export si blocca allo stesso modo. Si compila a mano nello step
**"1. Anagrafica"** — per Da Croce il protocollo reale è `2022077` (dall'intestazione dell'offerta
rev.02, "PROT 2022077_REV. 02"); non va inventato (CLAUDE.md §7), va preso dal riscontro o da un
nuovo numero assegnato da chi scrive l'offerta.

### Passi completi per un export pulito

1. Step "1. Anagrafica": compila anche `Protocollo` (`2022077`), oltre a Cliente/Comune/ecc.
2. Step "2. Configurazione": compila i 4 campi spessore della tabella sopra.
3. Step "3. Computo metrico": carica il PDF (sezione 3).
4. Step "5. Condizioni" e "4. Prezzi": sconti e Totale target (sezione 4 sopra).
5. "Salva bozza" (crea il preventivo/la revisione se non esistono ancora), poi "Genera documento".

Con tutti i campi compilati, l'export restituisce `200 OK` senza nessun avviso residuo in preview.

---

## 6. Test E2E automatico (Playwright, copre lo stesso caso in un browser reale)

```bash
npm run test:e2e
```

[`e2e/computo-metrico-golden-cases.spec.ts`](../e2e/computo-metrico-golden-cases.spec.ts) apre
`/preventivi/nuovo-v3` in Chromium reale, carica `e2e/fixtures/computo-dacroce.pdf` con un vero
upload di file e verifica dal DOM gli stessi numeri della sezione 2 — è l'equivalente
automatico dei passi 3–8 sopra (l'anagrafica non fa parte della suite E2E). Al primo utilizzo
serve installare il browser:

```bash
npx playwright install chromium
```

---

## Nota — perché questi numeri non sono "il preventivo finale"

I numeri di questo file sono quelli proposti dalla pipeline `computo → conteggio` a partire dal
PDF reale: valori parametrici, non arrotondati. Non vanno confusi con un preventivo commerciale
firmato (che avrebbe sconti, arrotondamento manuale e un totale target tondo, come nel golden
case Crivellaro di [`CLAUDE.md`](../CLAUDE.md)). La sezione 4 sopra mostra come arrivare dal
computo al TOTALE commerciale (255 000,00 €, coerente con l'offerta rev.02) passando dagli step
Prezzi/Condizioni — ma resta un test manuale, non un `describe` automatico come il golden case
Crivellaro in `calcolo.test.ts`/`persistenza.test.ts`: il Listino di partenza è quello proposto
dal conteggio (300 343,58 €), non quello digitato in offerta (300 800,00 €), quindi l'Arrotondamento
risolto differisce da quello reale (si veda sotto il perché).

**Attenzione — non aspettarsi che questi importi coincidano voce per voce con
`Offerta MHM rev.02_Dacroce Dalila riscontro.pdf`.** Quel PDF resta il riscontro giusto da usare
per Da Croce (comune, provincia, edificio a due piani a pag. 4) — è il *totale* pareggiato che
conta, non i singoli importi di riga. (Nota a margine, non è la causa dello scarto sotto: il
computo committato è `DACROCE DALILA rev.03`, l'offerta è `rev.02`, create lo stesso giorno
19/12/2025 a poche ore di distanza.)

Confrontando le voci prodotte da `eseguiConteggio` con quelle scritte in offerta si vedono
scostamenti reali di centinaia o migliaia di euro: `pareti-mhm` 127 543,28 € proposti contro
123 200,00 € in offerta, `trave-larice` 10 104,24 € contro 14 500,00 €, `solaio-interpiano`
15 240,96 € contro 16 900,00 €, `monoblocchi` 14 495,00 € contro 13 200,00 €. **Non è un bug**, e
non è nemmeno solo "l'AI propone, l'umano poi digita" in astratto: si può mostrare *dove* va il
denaro. La tariffa `104.01.024` ("POSA cordolo pareti", 4 401,36 € su Dacroce) sta, nel computo
Primus, dentro la categoria PARETI IN LEGNO — quindi oggi finisce nel totale di `pareti-mhm`
(`regolaTraveBase` la esclude apposta da `TARIFFE_TRAVE_BASE` per non contarla due volte, vedi il
commento sopra `TARIFFE_TRAVE_BASE`). Nell'offerta reale, invece, quel costo di posa sembra essere
stato spostato dalla riga "pareti" (1) alla riga "trave alla base" (1.c) — sommando i due importi
proposti (127 543,28 + 10 104,24 = 137 647,52 €) e i due dell'offerta (123 200,00 + 14 500,00 =
137 700,00 €) lo scarto crolla a 52,48 €, contro i 4 343,28 € e i 4 395,76 € che si vedono
guardando le righe singolarmente. È la prova che il confine "cosa va sotto pareti, cosa sotto
trave" è una scelta di chi ha scritto l'offerta a mano, non qualcosa che il computo Primus dichiara
in modo univoco — **e non è una scelta stabile**: lo stesso spostamento applicato a Crivellaro
peggiora, non migliora, il confronto (dettagli sotto). Non c'è quindi una regola fissa da
correggere nel codice: è lo stesso principio del vincolo CLAUDE.md §7 ("l'AI non decide i prezzi",
ogni importo qui è `provenienza: 'calcolato'`, cioè proposto, non quello firmato dal cliente).

**La controprova (corretta) è il caso Crivellaro**, ma dice l'opposto di quanto scritto qui in una
versione precedente di questa nota: eseguendo `eseguiConteggio` sul *vero* fixture
`crivellaro.json` (non sui valori digitati a mano nel golden case commerciale di
[`testing-golden-case-crivellaro.md`](testing-golden-case-crivellaro.md), che sono un test a parte
sul motore sconti, non l'output della pipeline computo → conteggio) si trovano scostamenti
paragonabili contro `Offerta MHM rev.04_crivellaro.pdf`: `pareti-mhm` 100 645,84 € proposti contro
96 100,00 € in offerta, `copertura-falda` 58 849,06 € contro 63 600,00 €, `monoblocchi`
9 450,00 € contro 10 200,00 €. Qui `104.01.024` vale 2 660,57 €: sommandolo a `trave-larice`
(5 843,70 € proposti, già vicini ai 5 800,00 € in offerta) il confronto peggiora invece di
migliorare — la stessa tariffa che "spiega" lo scarto su Da Croce non generalizza a Crivellaro.
Conclusione verificata su entrambi i casi reali disponibili: gli importi per voce della pipeline
computo → conteggio sono scostati dall'offerta firmata di qualche punto percentuale in entrambi i
golden case, non solo su Da Croce — è il comportamento atteso di un valore `proposto` in attesa di
revisione umana, non un difetto del motore.
