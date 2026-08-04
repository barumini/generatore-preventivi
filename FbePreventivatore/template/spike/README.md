# template/spike/README.md

## Esito

- [x] docxtemplater inietta correttamente placeholder in paragrafi di testo semplice
- [x] docxtemplater inietta correttamente placeholder dentro caselle di testo
- [x] Verdetto: PROCEDI con docxtemplater / ~~RIPIEGA su HTML→PDF~~

## Note

### Deviazione dal brief: i `.docx` non sono committati

Lo Step 7 del brief dice `git add template/spike`, ma questo committerebbe
tre copie binarie (~25-33 MB l'una, ~83 MB totali) di un file derivato dal
master FBE. Il progetto ha già una convenzione esplicita contro questo
(`.gitignore` esclude `Documentazione addestramento/` con la nota "~33 MB,
non versionati"; stesso principio in `CLAUDE.md`). Per coerenza è stata
aggiunta a `.gitignore` la riga `template/spike/*.docx`: sono committati
solo `spike.ts`, `build_placeholder_docx.py` e questo `README.md`. I tre
`.docx` (`master-originale.docx`, `master-con-placeholder.docx`,
`output-spike.docx`) restano su disco locale ma non entrano in git. Sono
comunque banalmente rigenerabili:

```bash
cp "Documentazione addestramento/Offerta MHM rev.00_.docx" template/spike/master-originale.docx
python3 template/spike/build_placeholder_docx.py
npx tsx template/spike/spike.ts
```

Se questa deviazione dal brief non è gradita, va detto esplicitamente e i
tre file possono essere aggiunti a git rimuovendo la riga da `.gitignore`.

### Come sono stati inseriti i placeholder

Non avendo un'interfaccia Word/LibreOffice disponibile in questo ambiente, i
placeholder sono stati inseriti modificando direttamente `word/document.xml`
dentro lo zip del `.docx` (script `template/spike/build_placeholder_docx.py`),
invece di aprire il file in un editor grafico come indicato nello Step 2
originale. Il file è stato ricostruito riscrivendo un nuovo zip voce per
voce (`zipfile.ZipFile`), copiando ogni membro originale invariato tranne
`word/document.xml`, per evitare la corruzione tipica di un extract+rezip
naive dei pacchetti Office Open XML.

**Caso ad alto rischio (`{cliente}`):** il nome cliente "Baetta Matteo" in
copertina si è rivelato *duplicato* dentro un blocco `mc:AlternateContent`:
il testo "Sig. Baetta Matteo" compare identico sia nel ramo
`mc:Choice/wps:txbx` (casella di testo DrawingML moderna) sia nel ramo
`mc:Fallback` (casella di testo VML legacy) — esattamente il pattern di
rischio descritto in spec §10.3. Il nome era inoltre spezzato su due run
separati (`Baetta` e ` Matteo`, con un terzo run precedente `Sig. ` lasciato
intatto). Sono state modificate entrambe le occorrenze: il run `Baetta` è
diventato `{cliente}`, il run ` Matteo` è stato svuotato. Una terza
occorrenza di "Baetta Matteo", in una cella di tabella non correlata alla
casella di testo (probabile blocco indirizzo), non è stata toccata perché
fuori perimetro del task.

**Caso di controllo (`{totaleNetto}`):** la tabella prezzi in "Preventivo"
è di fatto un'immagine incorporata (`image15.png`), non testo editabile,
quindi come indicato non si è tentata l'iniezione lì. È stato invece
aggiunto un nuovo paragrafo semplice `<w:p><w:r><w:t>{totaleNetto}</w:t>
</w:r></w:p>` appena prima del `<w:sectPr>` finale del body. Nota tecnica:
l'inserimento è stato fatto *prima* di `<w:sectPr>` e non letteralmente
prima di `</w:body>`, perché l'ultimo `<w:sectPr>` deve restare l'ultimo
figlio di `<w:body>` per la validità OOXML — inserire un paragrafo dopo lo
avrebbe reso invalido.

### Esecuzione dello spike

`npx tsx template/spike/spike.ts` (dopo `npm install --no-save tsx`, non
presente come dipendenza del progetto) è stata eseguita **senza eccezioni**:

```
Scritto /Users/matteopisanu/ClaudeCode/FbePreventivatore/template/spike/output-spike.docx
```

### Verifica (non ci si è fermati a "non lancia eccezioni")

Ispezionando `word/document.xml` dentro `output-spike.docx`:

- `{cliente}` sostituito correttamente in **entrambi** i rami
  Choice/Fallback della casella di testo, con `Spike Test Cliente` (2
  occorrenze, come atteso), es.:
  ```xml
  <w:r ...><w:t xml:space="preserve">Sig. </w:t></w:r>
  <w:r ...><w:t xml:space="preserve">Spike Test Cliente</w:t></w:r>
  <w:r ...><w:t/></w:r>
  ```
  Nessun frammento residuo del nome originale, nessuna sintassi `{...}`
  residua nel testo visibile.
- `{totaleNetto}` sostituito correttamente con `300 000,00 €` (1
  occorrenza), subito prima del `<w:sectPr>` finale:
  ```xml
  <w:p><w:r><w:t xml:space="preserve">300 000,00 €</w:t></w:r></w:p><w:sectPr ...>
  ```
- Conteggi di controllo su `output-spike.docx`: `{cliente}` → 0 rimanenti,
  `{totaleNetto}` → 0 rimanenti, `Spike Test Cliente` → 2, `300 000,00` →
  1, `Baetta`/`Matteo` residui → 1 ciascuno (la cella di tabella non in
  perimetro, invariata come atteso).
- Integrità del file: `unzip -t output-spike.docx` → nessun errore;
  `word/document.xml` è XML ben formato (`xml.dom.minidom.parseString`
  senza eccezioni); il file si apre correttamente con `python-docx`
  (455 paragrafi, l'ultimo è esattamente `300 000,00 €`).
- Nessuna perdita di contenuto collaterale: stesso numero di immagini
  incorporate prima/dopo (96 file in `word/media/`), stesso numero di
  `<w:tbl>` in `document.xml` prima/dopo (36). Le uniche differenze tra i
  namelist dello zip originale e quello prodotto da docxtemplater sono due
  voci di cartella esplicite (`word/`, `docProps/`) aggiunte da JSZip in
  fase di rigenerazione — un artefatto innocuo e comune di re-zip, non una
  perdita di contenuto.
- Non è stato possibile un confronto visivo in Word/LibreOffice reale
  (nessuna GUI disponibile in questo ambiente, `soffice`/`libreoffice`
  assenti): la verifica si è fermata al livello XML/struttura zip, che è
  comunque conclusiva per la domanda posta dallo spike (il tag-parser di
  docxtemplater regge la struttura `mc:AlternateContent` senza corromperla
  né lanciare errori).

### Errori osservati

Nessuno. Non è stato necessario il tentativo alternativo previsto dallo
Step 4 del brief (spostare il placeholder fuori dalla casella di testo),
perché il caso ad alto rischio ha funzionato al primo tentativo.

### Verdetto

**PROCEDI con docxtemplater.** Il tag-parser di docxtemplater ha gestito
correttamente sia il caso semplice (nuovo paragrafo di testo) sia il caso a
rischio (placeholder dentro `mc:AlternateContent`/casella di testo, con
run spezzati), producendo un `.docx` valido, apribile, senza eccezioni e
senza corruzione osservabile del resto del documento (immagini, tabelle,
altre caselle di testo invariate). L'unica riserva è la mancata verifica
visiva in un vero Word/LibreOffice (non disponibili in questo ambiente):
si raccomanda un controllo visivo rapido da parte di un umano con Word
prima di considerare il rischio del tutto chiuso, ma nulla nella struttura
XML suggerisce un problema.
