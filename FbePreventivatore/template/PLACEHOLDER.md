# Placeholder del master `Offerta MHM master.docx`

## ⚠️ STATO: verifica visiva in Word fatta — 1 dettaglio cosmetico accettato così com'è

Questo master è stato preparato senza accesso a Word/LibreOffice (nessuna GUI
in questo ambiente): tutte le correzioni sono fatte alla cieca sull'XML, poi
verificate a vista da un umano su un export reale generato da
`scripts/genera-offerta-esempio.ts`. Stato dei controlli (2026-08-07):

1. **pag. 5, tabella prezzi nativa** (colonne, bordi, importi a destra,
   sta in una pagina) — ✅ confermato a vista.
2. **pag. 5, rientro delle righe di riepilogo** (`SCONTO RISERVATO`,
   `Arrotondamento`, `PARZIALE`, `COSTI SICUREZZA`, `TOTALE` a sinistra;
   `Listino 2026` rientrata) — ✅ confermato a vista.
3. **pag. 6, tabella Pagamento** — ✅ corretta e confermata, con tre round di
   fix trovati dal controllo visivo:
   - la colonna dell'importo caparra (1027 dxa nell'originale, dimensionata
     per uno spazio da riempire a mano tipo `€ ____,____`) troncava un
     importo vero (`€ 30 000,00` → `€ 30 000,0`) — allargata a 2000 dxa
     (colonna descrizione ridotta da 8700 a 7727, stessa larghezza totale);
   - la tabella non aveva bordi e il rientro sinistro della prima colonna
     era incoerente tra le righe (alcune ereditavano un default non zero,
     altre lo azzeravano esplicitamente) — aggiunti bordi grigi coerenti con
     pag. 5, rientro forzato a zero su tutte le righe;
   - la tabella aveva un rientro di 357 dxa dal margine di pagina, diverso
     dalle altre due tabelle del documento — rimosso.
   Tutto in `template/build_master_placeholder.py`, funzione
   `sostituisci_tabella_sal`. Resta un residuo cosmetico minore (un piccolo
   spazio percepito a sinistra, non isolato con certezza — margine di cella
   normale o scarto residuo) che l'utente ha scelto di accettare così com'è,
   non bloccante.
4. **copertina** (nessuno spazio anomalo dove stava `PROT. 000-22 REV.00`)
   — ✅ confermato a vista.
5. **pagg. 19-20, abaco serramenti** (nessun testo che tracima dalle caselle)
   — ✅ confermato a vista.

Tutti i punti della checklist sono stati controllati a vista in Word. Restare
comunque attenti a colonne strette analoghe altrove nel documento (qualunque
punto dell'originale pensato per essere riempito a mano è un candidato allo
stesso problema del punto 3).

## Come si rigenera

Il master è prodotto da uno script deterministico, non a mano:

```bash
python3 template/build_master_placeholder.py
```

Legge `Documentazione addestramento/Offerta MHM rev.00_.docx` (~25 MB, **non
versionato**, cfr. CLAUDE.md) e riscrive `template/Offerta MHM master.docx`.
Ogni sostituzione dichiara quante occorrenze si aspetta e lo script si ferma
se il conto non torna. Le modifiche sono fatte sull'XML grezzo dentro lo zip
(tecnica validata dallo spike del Task 2, `template/spike/README.md`): nessun
extract+rezip, nessun `python-docx` in scrittura.

Prova di rendering end-to-end con dati fittizi su tutti i placeholder:

```bash
npx tsx template/spike/spike-master.ts
```

**Versionamento:** a differenza dei `.docx` di scratch dello spike (esclusi da
`.gitignore` con `template/spike/*.docx`), questo master **è versionato**: è
l'artefatto finale del task ed è un asset di runtime — l'export di Task 17 lo
carica per generare l'offerta, quindi un checkout pulito senza di esso non
funziona, e il sorgente da cui si rigenera non è in git. Costa ~25 MB per
versione: se il master verrà aggiornato spesso, conviene valutare Git LFS
prima di accumulare copie.

## Convenzione dei nomi con il punto — leggere prima di usare docxtemplater

Il parser di default di docxtemplater **non** risolve i path annidati:
`{cliente.nome}` cerca la chiave letterale `"cliente.nome"` nello scope, non
`scope.cliente.nome`. Quindi i dati vanno passati **piatti**, con il punto nel
nome della chiave:

```ts
doc.render({ 'cliente.nome': 'Crivellaro Giovanni', /* ... */ })
```

L'alternativa è configurare `parser` con `docxtemplater/expressions.js`, che
richiede la dipendenza `angular-expressions` (oggi **non** installata).

Due note operative per Task 17:

- il `nullGetter` di default stampa la stringa `"undefined"` per un tag
  semplice senza dato: **non basta** però passare semplicemente
  `nullGetter: () => ''` — una review (Task 17, Finding 1) ha dimostrato che in
  quel caso un refuso nella chiave passata a `render()` svuota in silenzio una
  cella, con la suite verde. `esportaOfferta()` usa quindi un `nullGetter` che
  registra il nome di ogni tag semplice non risolto (`part.module` assente — i
  cicli con dato mancante restano legittimamente equivalenti a lista vuota) e
  fa fallire l'export con un errore leggibile se l'elenco non è vuoto;
- gli importi vanno passati **già formattati** (`96 100,00 €`, formato
  italiano di `formattaImportoItaliano`), placeholder inclusi quelli testuali
  (`comprese`, `escluso`, `OMAGGIO`): il master non fa formattazione.

## Tabella dei placeholder

### Copertina (pag. 1) e header di ogni pagina

| Placeholder | Pagina | Occorrenze | Sorgente in `RisultatoCalcolo`/`StatoForm` |
|---|---|---|---|
| `{cliente.nome}` | 1 (casella di testo, 2 rami) + 4 (blocco destinatario) | 3 | `stato.cliente.nome` |
| `{cliente.comune}` | 1, 4 | 3 | `stato.cliente.comune` |
| `{cliente.provincia}` | 1, 4 — reso come `({cliente.provincia})` | 3 | `stato.cliente.provincia` (sigla, es. `VI`) |
| `{protocollo}` | 1 + header (`word/header1.xml`) | 2 + 1 | `stato.protocollo` |
| `{revisione}` | 1 (`REV.{revisione}`) + header | 2 + 1 | `stato.revisione` (2 cifre, es. `04`) |

Il segnaposto mai sostituito `PROT. 000-22 REV.00` in copertina (bug della
spec §3.8, presente in entrambi i documenti originali) è stato **rimosso**
svuotando i tre run che lo componevano, in entrambi i rami della casella di
testo.

### Pagina 4 — anagrafica e caratteristiche

| Placeholder | Occorrenze | Sorgente |
|---|---|---|
| `{dataOfferta}` | 1 | data di emissione della revisione (`Castelgomberto lì {dataOfferta}`) |
| `{sistemaCostruttivo}` | 1 | costante `MassivHolzMauer® (M.H.M.)` |
| `{tetto}` | 1 | `stato.caratteristiche.tetto` (le righe `Sporgenza`/`Pendenza` restano fisse) |
| `{mantoCopertura}` | 1 | `stato.caratteristiche.mantoCopertura` |
| `{finituraEsterna}` | 1 | `stato.caratteristiche.finituraEsterna` |
| `{pacchettoConsegna}` | 1 | `stato.caratteristiche.pacchettoConsegna` |
| `{superficie.totaleLorda}` | 1 | stringa libera, es. `134+13+14= 161` (cfr. CLAUDE.md: forma scritta conservata) |
| `{superficie.pianoTerra}` | 1 | `stato.geometria.superficie[].valoreLordo` (stringa libera) |
| `{superficie.pianoPrimo}` | 1 | idem |
| `{superficie.sottotetto}` | 1 | idem |
| `{superficie.portico}` | 1 | idem |
| `{superficie.terrazzo}` | 1 | idem |
| `{superficie.garage}` | 1 | idem (nel master di partenza la cella era vuota) |

Le celle importo restano nella forma `Mq {superficie.…}`: il valore va passato
come stringa, vuota se la riga non si applica.

### Pagina 5 — tabella prezzi (tabella Word **nativa**)

Struttura: 3 colonne senza intestazione (`n.` | `Descrizione` | `Importo`
allineato a destra), 13 righe-modello di cui 5 sono righe di ciclo.

Le colonne non sono le stesse su tutte le righe, e riprodurre l'originale
richiede tre forme di riga:

- **3 celle** (`n.` | descrizione | importo): righe delle voci e la riga
  `Listino`, che nell'originale è rientrata;
- **2 celle** con `gridSpan=2` sulla prima: le 5 righe di riepilogo (sconti,
  arrotondamento, parziale, costi sicurezza, totale), che nell'originale
  partono dal bordo sinistro attraversando la colonna del numero voce;
- **1 cella** con `gridSpan=3`: le intestazioni di banda (`GREZZO AVANZATO`,
  `Optional:`, `Esclusioni :`).

| Riga | Celle | Placeholder | Sorgente |
|---|---|---|---|
| intestazione | 1 (span 3) | *(fissa)* `GREZZO AVANZATO` | — |
| ciclo | 3 | `{#voci}{numero}` · `{descrizione}` · `{importo}{/voci}` | `risultato.vociValorizzate` filtrate su `gruppo === 'grezzo'` |
| fissa | 3 | `Listino {annoListino}` · `{listinoTotale}` | `stato.annoListino`, `risultato.listinoTotale` |
| ciclo | 2 (span 2) | `{#sconti}SCONTO RISERVATO: {percentuale}   {causale}` · `{importo}{/sconti}` | `risultato.sconti` (a cascata, nell'ordine di applicazione) |
| fissa | 2 (span 2) | `Arrotondamento` · `{arrotondamento}` | `risultato.arrotondamento` (con segno, cfr. `PaginaPrezzi.tsx`) |
| fissa | 2 (span 2) | `PARZIALE AL GREZZO AVANZATO esclusa I.V.A.` · `{parziale}` | `risultato.parziale` |
| fissa | 2 (span 2) | `COSTI SICUREZZA : SICUREZZA ***` · `{sicurezza.valorizzata}` | `risultato.sicurezza.valorizzata` |
| ciclo | 3 | `{#vociPostSconto}{numero}` · `{descrizione}` · `{importo}{/vociPostSconto}` | `risultato.vociValorizzate` filtrate su `gruppo === 'post_sconto'` (**non** scontate) |
| fissa | 2 (span 2) | `TOTALE AL NETTO esclusa I.V.A.` · `{totaleNetto}` | `risultato.totaleNetto` |
| intestazione | 1 (span 3) | *(fissa)* `Optional:` | — |
| ciclo | 3 | `{#optional}{lettera}` · `{descrizione}` · `{importo}{/optional}` | `stato.condizioni.optional` — importi **non sommati** (spec §4.2) |
| intestazione | 1 (span 3) | *(fissa)* `Esclusioni :` | — |
| ciclo | 3 | `{#esclusioni}{lettera}` · `{descrizione}` · `{importo}{/esclusioni}` | `stato.condizioni.esclusioni` — colonna destra testuale (`escluso`, `€ 35,00/ora`) |

Nella riga di ciclo degli sconti il tag di apertura sta nella cella unita e
quello di chiusura nella cella dell'importo: sono comunque due celle diverse
della stessa riga, quindi la regione fra i due tag attraversa un confine
`<w:tc>` e docxtemplater espande ancora a `w:tr` (verificato con 0, 1 e 3
sconti).

Chiavi attese dentro i cicli: `voci`/`vociPostSconto` → `{numero, descrizione,
importo}`; `sconti` → `{percentuale, causale, importo}` (percentuale già come
stringa `10%`, importo già col segno `- 23 700,00 €`); `optional`/`esclusioni`
→ `{lettera, descrizione, importo}`.

I `{numero}` delle voci **non** vanno mai scritti a mano: arrivano da
`numeraVoci()`, che li ricalcola sulle voci incluse (CLAUDE.md §4).

### Pagina 6 — note, condizioni, pagamento

| Placeholder | Occorrenze | Sorgente |
|---|---|---|
| `{riferimenti.praticaGenioCivile}` | 1 | numero/lettera della voce optional «pratica Genio Civile», calcolato al render |
| `{riferimenti.tracciamentoImpianti}` | 1 | numero della voce `tracciamento-impianti` (era `1.a` costante) |
| `{riferimenti.progettazioneEsecutiva}` | 1 | numero della voce `progettazione-esecutiva` (era `7` costante) |
| `{consegna}` | 1 | `stato.condizioni.consegna` (es. `da pattuire`) |
| `{caparra}` | 1 | `stato.condizioni.pagamento.caparra`, reso come `€ {caparra}` |
| `{#salPrimi}{percentuale}` · `{descrizione}{/salPrimi}` | 1 riga di ciclo | `pagamento.sal.slice(0, 3)` — i SAL **prima** della clausola di fidejussione |
| `{#salSuccessivi}{percentuale}` · `{descrizione}{/salSuccessivi}` | 1 riga di ciclo | `pagamento.sal.slice(3)` — i SAL **dopo** la clausola |
| `{validita}` | 1 | `stato.condizioni.validita` (es. `31.08.2026`) |

I tre `{riferimenti.…}` esistono perché CLAUDE.md §4 vieta che un testo citi un
numero di voce come costante: nel master originale le note di pag. 6 citavano
`punto 1.a`, `punto 7` e `punto a)` come testo fisso.

**Perché due cicli e non un `{#sal}` unico:** fra il 3° e il 4° SAL c'è una
riga fissa con la clausola di fidejussione, che si riferisce ai «seguenti SAL»
e all'«ammontare dei primi 3 SAL» — non è spostabile. Un ciclo di
docxtemplater su righe di tabella non può scavalcare una riga fissa, quindi la
scaletta è divisa in due gruppi. La divisione è quella del documento stesso.

**Le percentuali di default non sono più nel master:** le 7 righe SAL fisse
sono state ridotte a 2 righe-modello, quindi chi renderizza deve fornire i
dati. Il default osservato nei documenti FBE (spec §4.3), da usare come valore
iniziale del form:

```
salPrimi:       20% Acconto al contratto
                10% Informativa di cantiere
                40% Inizio montaggio
salSuccessivi:  10% Al tetto primo tavolato (escluso tegole)
                10% Cappotto esterno grezzo (escluso intonachino)
                 5% Inizio posa Cartongesso
                 5% Fine lavori
```

### Pagine 19-20 — abaco serramenti e portoncino

Sono dentro caselle di testo duplicate nei rami `mc:Choice` e `mc:Fallback`:
ogni placeholder compare quindi **2 volte** nell'XML ma una sola volta a
schermo. Tutti i valori sono output di `generaAbacoSerramenti()`
(`src/ai/abaco.ts`), con il gruppo di serramenti pertinente.

| Placeholder | Occorrenze | Sorgente |
|---|---|---|
| `{abaco.finestreBattente}` | 2 | `generaAbacoSerramenti(finestre a battente)` |
| `{abaco.portefinestreBattente}` | 2 | `generaAbacoSerramenti(portefinestre a battente)` |
| `{abaco.fissiVetrate}` | 2 | `generaAbacoSerramenti(fissi/vetrate)` |
| `{abaco.alzantiScorrevoli}` | 2 | `generaAbacoSerramenti(alzanti scorrevoli)` |
| `{abacoSerramenti}` | 1 | `generaAbacoSerramenti(tutti)` — elenco completo, riga dei monoblocchi Hella (pag. 20) |
| `{abaco.portoncini}` | 2 | `generaAbacoSerramenti(portoncini, { prefisso: 'n. {n} portoncini di ingresso dim. standard {dim}' })` |

## ⚠️ Placeholder di spessore nelle descrizioni (pag. 5)

Tre `descrizioneTemplate` del catalogo voci (`src/domain/voci.ts`, id `pareti-mhm`,
`copertura-falda`, `cappotto`) contengono placeholder testuali a **doppia** graffa
(`{{spessoreEsterno}}`, `{{spessoreInterno}}`, `{{spessoreCoibente}}`,
`{{spessoreCappotto}}` — 4 in totale). Non sono tag docxtemplater (quelli sono a
graffa singola): sono testo letterale nel dato di dominio, interpolato con i valori
raccolti nello step "Configurazione" del wizard (`spessoreEsterno`, `spessoreInterno`,
`spessoreCoibente`, `spessoreCappotto` — vedi
`src/app/preventivi/nuovo/steps/StepConfigurazione.tsx`).

L'interpolazione è gestita da `interpolaPlaceholder` in `src/domain/calcolo.ts`: se il
campo corrispondente è compilato, il token viene sostituito con il valore (ripulito
dagli spazi superflui) prima della generazione del `.docx`; se il campo è lasciato
vuoto, il token resta intatto — non viene mai sostituito con una stringa vuota, che
produrrebbe una descrizione senza numero e senza più nessun `{{...}}` da rilevare.
`segmentaPlaceholder` spezza la descrizione in segmenti di testo normale e
segmenti-placeholder nello stesso file, usati dalla preview React
(`src/documento/preview/DescrizioneVoce.tsx`, montata da `PaginaPrezzi.tsx`) per
evidenziare in grigio solo il token ancora non interpolato — un operatore lo vede
prima di esportare. Lo stesso rilevamento alimenta anche l'avviso di coerenza
`spessore-non-interpolato` (`src/ai/coerenza.ts`), che segnala gli spessori mancanti e
invita a completare lo step Configurazione.

`esportaOfferta()` (`src/documento/export-docx.ts`) si blocca comunque per default se,
dopo l'interpolazione, restano token non risolti nelle descrizioni delle voci incluse,
e lancia un errore invece di scrivere il `.docx` — un campo spessore lasciato in
bianco nel wizard resta quindi un residuo bloccante, non un difetto silenzioso. Per
esportare comunque (solo per un giro di test/dev in cui si lascia deliberatamente uno
spessore non compilato) va passato l'opt-in esplicito
`consentiPlaceholderNonRisolti: true` su `InputEsportazione`. **Non usare
`consentiPlaceholderNonRisolti: true` con un cliente reale**: il rimedio corretto è
sempre compilare il campo spessore mancante nello step "Configurazione", non bypassare
il blocco.

## Cosa NON è stato reso variabile (e perché)

- Le 19 pagine di boilerplate (chi siamo, certificazioni, fasi, opere escluse,
  pacchetti parete/tetto, scuri, avvolgibili, annotazioni e firme) restano
  testo fisso: la spec §4 le classifica immutabili.
- Gli spessori nominali citati nelle pagine tecniche 13-18 (`320 mm`,
  `185 mm`, …) restano fissi: sono fuori dall'elenco della spec §4 per questo
  task e servono un giro di verifica sui disegni, non una sostituzione
  meccanica.
- `image15.png` (la vecchia tabella prezzi come immagine) resta dentro il
  pacchetto `.docx` ma non è più referenziata dal flusso del documento:
  toglierla richiederebbe di riscrivere anche
  `word/_rels/document.xml.rels`, e una relazione non usata è valida OOXML.
  Rimane come riferimento visivo del layout originale.

## Deviazione dal brief, dichiarata

Il brief del Task 16 elencava per pag. 5 dei placeholder singoli
`{sconto1.percentuale}`, `{sconto1.importo}`, `{sconto2.percentuale}`,
`{sconto2.importo}`. Sono stati sostituiti da un **ciclo** `{#sconti}` per due
motivi concreti:

1. `RisultatoCalcolo.sconti` è un array (`applicaScontiACascata` ne restituisce
   uno per ogni sconto configurato): due chiavi fisse costringerebbero a
   spacchettarlo e romperebbero con 1 o 3 sconti;
2. con due righe fisse, un'offerta con un solo sconto stamperebbe una riga
   vuota — o addirittura `undefined` col `nullGetter` di default — su un
   documento che il cliente firma.

Il ciclo copre entrambi i casi senza righe fantasma. Se il vincolo era voluto,
si torna indietro modificando `tabella_prezzi()` in
`template/build_master_placeholder.py` e rilanciando lo script.
