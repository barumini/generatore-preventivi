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

### Passi

1. Apri `http://localhost:3000/preventivi/nuovo-v3`.
2. Vai allo step **"3. Computo metrico"**.
3. Carica il PDF Da Croce (drag&drop sulla zona di caricamento, oppure selettore file). Il PDF
   resta nel browser: l'estrazione con `pdfjs-dist` gira lato client, nessun upload a un server.
4. Verifica nel riquadro "Computo metrico":
   - **File letto** → `166 voci`, `8 categorie`, **Totale computo `323 643,58 €`**
   - Alert verde "Verifica superata: la somma delle voci pareggia il riepilogo"
5. Nella sezione "Riconciliazione fra le voci conteggiate e il totale del computo", verifica i
   tre numeri della sezione 2 sopra (somma voci / target / delta).
6. Scorri le schede voce sopra la riconciliazione e confronta ogni importo con la tabella della
   sezione 2. In particolare verifica che `solaio-interpiano` mostri **15 240,96 €** (un numero,
   non la scritta `compresa` — è il segnale che l'edificio è stato riconosciuto come multipiano).
7. Verifica l'avviso sicurezza (giallo, non bloccante) con il testo indicato sopra.

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
automatico dei passi 1–7 sopra. Al primo utilizzo serve installare il browser:

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
