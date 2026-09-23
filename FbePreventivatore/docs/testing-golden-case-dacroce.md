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

## 4. Test E2E automatico (Playwright, copre lo stesso caso in un browser reale)

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
case Crivellaro di [`CLAUDE.md`](../CLAUDE.md)): per Da Croce non esiste nel repo un golden case
commerciale a valle (con sconti/step Prezzi/Condizioni) — solo questo, a livello di computo
metrico.

**Attenzione — non confrontare voce per voce con `Offerta MHM rev.02_Dacroce Dalila
riscontro.pdf`.** Quel PDF è utile per l'anagrafica (comune, provincia) e per confermare
l'edificio a due piani (pag. 4), ma **non è la stessa revisione** del computo usato per questo
golden case: il computo committato è `DACROCE DALILA rev.03` (creato 19/12/2025 09:26, si veda
l'intestazione pag. 1 del PDF sorgente), l'offerta di riscontro è invece `rev.02` (creata lo
stesso giorno alle 14:59, quindi *dopo* il computo, ma su una revisione precedente del progetto).
Confrontando i due si vedono scostamenti reali di centinaia o migliaia di euro per singola voce
(es. `pareti-mhm`: categoria computo 105 987,63 € contro 123 200,00 € in offerta; `trave-larice`:
10 104,24 € contro 14 500,00 €; `solaio-interpiano`: 15 240,96 € contro 16 900,00 €;
`monoblocchi`: 14 495,00 € contro 13 200,00 €) — **non è un bug del motore**, è lo scarto fra due
revisioni diverse dello stesso progetto.

La controprova è il caso Crivellaro: lì il PDF computo (`Computo Crivellaro rev04.PDF.pdf`) e
l'offerta di riscontro (`Offerta MHM rev.04_crivellaro.pdf`) condividono la **stessa revisione**
(rev.04), e infatti gli importi per voce prodotti da `eseguiConteggio` coincidono al centesimo con
quelli scritti in offerta (vedi tabella in
[`testing-golden-case-crivellaro.md`](testing-golden-case-crivellaro.md)). Questo conferma che le
regole di conteggio generalizzano bene quando le revisioni combaciano: per costruire un vero
golden case commerciale su Da Croce servirebbe un computo rev.02 (o un'offerta rev.03), che oggi
non è nella cartella `Documentazione addestramento/`.
