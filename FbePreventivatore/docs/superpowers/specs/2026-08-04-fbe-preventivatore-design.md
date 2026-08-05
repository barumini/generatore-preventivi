# FBE Preventivatore — Design

**Data:** 2026-08-04
**Stato:** approvato
**Committente:** FBE WoodLiving (Castelgomberto, VI) — tramite DIH Vicenza

---

## 1. Obiettivo

Prototipo di applicazione che guida la redazione di un'offerta commerciale FBE
(`mod.05-COM`, 25-28 pagine) tramite un wizard assistito da AI, mostrando in tempo reale
la preview del documento che si sta componendo, ed esportando il `.docx` finale.

Sostituisce l'attuale catena manuale: metratura in Excel → computo Primus → ripartizione a
mano dei prezzi → copia-incolla nel master Word.

**Non** sostituisce il computo metrico Primus, che resta lo strumento tecnico di FBE.

---

## 2. Il processo attuale (ricostruito dai documenti reali)

Analizzati i file in `Documentazione addestramento/`:
`flowchart.pdf`, `Offerta MHM rev.04_crivellaro.pdf`, `Computo Crivellaro rev04.PDF.pdf`,
`Conteggi pulito.xlsx`, `Offerta MHM rev.00_.docx`, `Tav_06 ... .dwg`, `image001.jpg`.

```
  Disegno architettonico del cliente (+ tavola DWG)
                    │
                    ▼
  ① Conteggi pulito.xlsx — metratura a mano (T. Campana, 30/06/2026)
     serramenti b×h → 30,50 mq lordi / 15,89 mq netti (detrazioni 0,60 × 0,30)
     falde "5,8x16,5" · grondaia 45,60 ml · travi "16,5x0,2x0,32" · pareti Sp 20/16/11 cm
     NESSUN PREZZO: solo geometria. Le pareti non hanno nemmeno il b×h calcolato.
                    │
                    ▼
  ② Computo Primus rev.04 — 166 voci, di cui 74 a quantità 0,00 (template-listino FBE)
     prezzi = listino interno FBE, fornitura e posa scorporate
     grafo di dipendenze: "Vedi voce n° 21 [m2 170.18] × 0,50"
     8 categorie → TOTALE 260 260,99 €
                    │
                    ▼
  ③ Ponte al commerciale
     260 260,99 − 23 352,50 (categoria COSTI SICUREZZA) = 236 908,49
                                       ≈ arrotondato a  237 000,00 € = "Listino 2026"
     (delta 91,51 € — verificato aritmeticamente)
                    │
                    ▼
  ④ Ripartizione sulle 6 voci d'offerta — DISCREZIONALE, nessuna formula
     pareti +22 399 · copertura −13 101 · cappotto −4 964 · cartongesso −1 637 · infissi −2 605
     (il totale è vincolato, l'allocazione è una scelta commerciale)
                    │
                    ▼
  ⑤ Sconti a cascata + arrotondamento → 190 900 + 89 100 + 20 000 = 300 000 € tondi
                    │
                    ▼
  ⑥ docx master "mod.05-COM" compilato a mano → 25-28 pagine, di cui 19 boilerplate
```

### 2.1 Il flowchart fornito da FBE

```
Inizio → AI chatbot: cliente · località · progettista · protocollo (es. 2026-066)+rev ·
         tipo copertura (piano/falde) · finitura esterna · pacchetto di consegna
                              ↓
         [Tipo di pacchetto] → Modulo 1 / Modulo 2 / Modulo 3
                               es. "grezzo da 1, 2 + 3 impoverita"
                              ↓
         Tabella caratteristiche fabbricato (calcolo per piano) + Totale lordo manuale
                              ↓
         Primus (excel/pdf) + aggiungere conteggi a mano
                              ↓
         Compilazione documento tramite master
```

---

## 3. Fatti verificati che vincolano il design

Ognuno di questi è stato ricavato e verificato numericamente sui documenti reali. Sono
requisiti, non preferenze.

### 3.1 Gli sconti sono a cascata, non additivi

```
Listino 2026                                      237 000,00
  − 10% sconto cliente             = 23 700,00  → 213 300,00
  − 10% conferma entro 30.06.2026  = 21 330,00  → 191 970,00   (10% di 213 300, NON di 237 000)
  − Arrotondamento (manuale)       =  1 070,00  → 190 900,00   = PARZIALE GREZZO AVANZATO
  + voce 7 chiavi in mano  89 100,00
  + voce 8 garage          20 000,00
  = TOTALE AL NETTO                               300 000,00   ← cifra tonda voluta
```

10% + 10% fa 19%, non 20%. Verificato anche sul rev.00: `4 000 − 2% = 3 920 → −3% = 3 802,40`.

### 3.2 Il prezzo si riconcilia top-down, non si calcola bottom-up

L'`Arrotondamento` di −1 070,00 € esiste solo per far atterrare il totale su 300 000 tondi.
Il prezzo finale è **deciso** e poi riconciliato. Il motore deve quindi risolvere anche
il problema inverso: *dato un totale target, quale arrotondamento serve*.

### 3.3 Due gruppi di voci con comportamento diverso

| Gruppo | Voci (numerazione Crivellaro, cfr. §5.1) | Comportamento |
|---|---|---|
| `GREZZO` | 1, 1.a, 1.b, 1.c, 2, 3, 4, 4.a, 5, 5.a, 6 | entrano nel `Listino 2026`, **subiscono gli sconti** |
| `POST_SCONTO` | sicurezza, 7 (chiavi in mano), 8 (garage) | si sommano **dopo** il `PARZIALE`, **non scontate** |

Trattarle uniformemente sbaglierebbe di ~19%.

### 3.4 L'importo di una voce non è sempre un numero

Valori testuali osservati: `comprese` (voci 1.a, 1.b), `escluso`, `escluse`,
`OMAGGIO` (sicurezza: costo dichiarato 2 000,00 € ma valorizzata zero), `€ 35,00/ora`.

Modello: `importo: number | 'comprese' | 'escluso' | 'escluse' | 'OMAGGIO'`.
Solo i `number` entrano nelle somme.

### 3.5 Tutto il sistema FBE è "template + azzeramento"

Lo stesso pattern a tre livelli:

- **computo**: 166 voci, 74 a quantità 0,00 con prezzo valorizzato
- **offerta**: elenco-superset di voci da cui si cancellano le non pertinenti
  (in Crivellaro manca il solaio interpiano — è monopiano — e coerentemente il computo
  ha `SOLAIO (Cat 2) = 0,00`)
- **boilerplate**: sezioni condizionali (`SCURI – da definire`, tetto piano `(ESCLUSO)`,
  sughero/CalceCanapa optional)

→ Il modello dati è un **catalogo di voci e blocchi con regole di inclusione**.

### 3.6 La geometria dei serramenti alimenta l'abaco, verificato riga per riga

L'abaco a pag. 19 dell'offerta corrisponde esattamente alla tabella di `Conteggi pulito.xlsx`:

| Offerta pag. 19 | Conteggi.xlsx |
|---|---|
| `n. 4 dim. 90x120` | R11-R14: tre `0,9×1,2` + `doppia finestra 0,9×1,2` |
| `n. 1 dim. 200x180` | R9 `2×1,8` |
| `n. 1 dim. 260x220` | R15 `2,6×2,2` |
| `n. 1 dim. 280x220` | R16 `2,8×2,2` |
| `n. 1 dim. 220x220` | R17 portafinestra `2,2×2,2` |
| `n. 1 dim. 90x220` | R10 `0,9×2,2` |
| `n. 1 dim. 80x220` | R18 `0,8×2,1` |
| `n. 1 portoncino 100x220` | R8 `porta di ingresso 1×2,2` |

Formule del foglio (le uniche presenti):

```
L = b · h                    area lorda del foro
O = b − M   (M = 0,60 m)     larghezza netta
P = h − N   (N = 0,30 m)     altezza netta
Q = O · P                    area netta detraibile
ΣL = 30,50 mq   ΣQ = 15,89 mq   (52%)
```

Interpretazione di M/N: detrazione vuoti per intonaco/cappotto — non si sottrae l'intero
foro ma il foro meno gli sguinci (0,30 m per lato in larghezza, 0,30 in alto).

Questo è l'unico passaggio automatizzabile al 100%, e oggi è ricopiato a mano.

### 3.7 La revisione deve congelare il listino

`PROT 2026059 REV.04` — quel preventivo è stato rifatto 4 volte. Il computo ha la revisione
incollata dentro il campo committente (`CRIVELLARO rev.04`).

Ogni revisione salva **i valori di listino usati**, non un riferimento al listino. Altrimenti
aggiornare i €/mq al `Listino 2027` cambierebbe i numeri di una rev.01 già inviata e firmata
dal cliente pagina per pagina.

### 3.8 Errori presenti nei documenti attuali, da prevenire

- **`PROT. 000-22 REV.00`** in copertina: placeholder di template mai sostituito, presente in
  **entrambi** i documenti analizzati
- somma superfici ≠ totale dichiarato (rev.00: righe = 193,5 mq, dichiarato 187 mq)
- sezioni ancora marcate `da definire` (scuri, avvolgibili/frangisole) nel documento inviato
- spessori delle stratigrafie ricopiati a mano in 4-5 punti (`sp. mm 205`, `sp. mm 60+40`,
  `160 mm (80+60+20)`) — fonte di incoerenze contestabili in cantiere
- il computo, se consegnato, espone 74 righe con i prezzi di alternative non scelte
- `COSTI SICUREZZA` = 23 352,50 € nel riepilogo categorie ma `TOTALE COSTI SICUREZZA = 0,00`
  a pag. 24 (voci non flaggate in Primus)
- `QUADRO ECONOMICO DEI LAVORI` (pag. 25 del computo) tutto a 0,00: boilerplate per appalti
  pubblici, mai compilato

### 3.9 Validazione su tre preventivi reali aggiuntivi (Zapparoni, Fabrello, Lucarelli)

Dopo l'implementazione dei Task 1-6, FBE ha fornito tre offerte reali ulteriori. Confermano
le regole del motore e correggono due assunzioni della prima versione della spec.

**Confermato, con dati più forti:**

- **Sconti a cascata**, verificati a mano su tutti e tre (Zapparoni 3%+4%, Fabrello 10%+10%,
  **Lucarelli 10%+10%+5%** — tre scaglioni, etichette diverse "SCONTO RISERVATO"/"ULTERIORE
  SCONTO"). La cascata regge con un numero arbitrario di scaglioni.
- **`sicurezza` post-sconto** in entrambe le forme: OMAGGIO (Fabrello, Lucarelli) e importo
  reale sommato (Zapparoni, 2 000,00 €, verificato: 378 000 + 2 000 = 380 000 esatto).
- **`progettazione-esecutiva` = 4 000,00 € a corpo fisso**, confermato su **tutti e quattro**
  i preventivi indipendentemente da dimensioni e complessità.
- **I numeri di voce non sono costanti — bug reale intercettato**: in Lucarelli la voce "1.a"
  è stata rimossa dalla tabella prezzi, ma una nota a pag. 6 cita ancora "punto 1.a". Prova
  diretta che il controllo di coerenza previsto (§9.3, punto 4) deve includere: *riferimento
  testuale a un numero di voce che non esiste più nell'elenco numerato*.

**Corretto — il "Totale Lordi" non è sempre una somma piena:**

Crivellaro (134+13+14=161), Fabrello (131+6,5=137,5) e Lucarelli (107+86+13+24=230) sono
somme piene. Zapparoni usa **`189+100+(10+48+6)/3 = 310 mq`**: le superfici accessorie
(soppalco, portico, terrazzo) pesano 1/3, non al 100%. È una convenzione commerciale
decisa caso per caso da chi scrive il preventivo, non un algoritmo fisso.

**Implicazione**: il totale calcolato sommando le righe (`totaleSuperficiLorde`) resta la
proposta di default corretta nella maggioranza dei casi, ma **non va mai trattato come
autorevole** — deve restare sovrascrivibile con lo stesso meccanismo di provenienza
(`proposto`/`manuale`) usato per i prezzi delle voci, non solo per gli importi.

**Corretto — un unico driver "mq totali" non regge per tutte le voci di involucro:**

Confronto quantitativo Crivellaro→altri progetti (stessi coefficienti €/mq applicati alla
superficie lorda totale del progetto): scostamenti dal 12% al 93% a seconda della voce.
Il caso più istruttivo è **Lucarelli (2 piani, 230 mq totali)**: la sua copertura reale
(47 100 €) costa MENO di quella di Crivellaro (1 piano, 161 mq totali, 63 600 €) nonostante
più mq totali — perché il tetto segue l'impronta a terra dell'edificio, non la somma dei
piani (un tetto copre l'edificio una sola volta, indipendentemente da quanti piani ci sono
sotto).

Verificato che questo vale **solo per la copertura**, non per pareti/cappotto: Lucarelli
include pareti divisorie/strutturali interne che scalano col numero di piani, e usare
l'impronta a terra come driver per pareti e cappotto peggiora la stima (dal 10-12% di
errore al 38-50%) invece di migliorarla. Decisione presa: **solo `copertura-falda` cambia
driver**, da `mq_superficie_lorda` a una nuova quantità geometrica `mq_superficie_sedime`
(l'impronta a terra, approssimata dal valore della riga "Piano Terra"), con il coefficiente
ricalibrato di conseguenza (395 → 475 €/mq, usando 63 600 / 134 anziché 63 600 / 161).
Pareti e cappotto restano su `mq_superficie_lorda` invariati.

**Corretto — l'inclusione di "opere chiavi in mano" nel totale è una scelta, non una regola:**

In Fabrello la "Stima opere chiavi in mano" (90 000 €) è in sezione `Optional:`, **esclusa**
dal totale. In Crivellaro la stessa voce (89 100 €) **è sommata** in `TOTALE AL NETTO`.
La spec originale (§5) derivava l'inclusione automaticamente dal livello del Modulo 3
(`finiture !== 'completo'`) — ma è invece una decisione commerciale esplicita per ogni
offerta (proporre la stima come riferimento, o impegnarsi a un totale formale che la
include). Il modello aggiunge un campo booleano esplicito, di default `false`.

---

## 4. Struttura del documento target

`Offerta MHM rev.04_crivellaro.pdf`, 25 pagine A4. Header di ogni pagina:
`PROT 2026059_REV. 04 mod.05-COM`. Footer: `uffici: 0445 940066 – info@fbe.it www.fbecaseinlegno.com`.

| Pag. | Contenuto | Variabile? |
|---|---|---|
| 1 | Copertina `LA MIA CASA IN LEGNO MASSICCIO SENZA COLLE` | cliente, comune(prov.), protocollo, rev |
| 2 | `Chi siamo` (fondazione 1980, filiera completa) + firma titolari | fisso |
| 3 | `Certificazioni` (PEFC, CE, S.A.L.E., SOA OS32 cl.III, ISO 9001, FederlegnoArredo, CasaClima) | fisso |
| **4** | `Preventivo` — anagrafica, `CARATTERISTICHE STRUTTURA`, `CARATTERISTICHE FABBRICATO` | **sì** |
| **5** | `Preventivo` — **tabella prezzi**, sconti, totali, `Optional:`, `Esclusioni :` | **sì (cuore)** |
| **6** | Note `*`/`**`/`***`, polizze, `Consegna:`, `Pagamento:` (SAL), `Validità offerta:`, `IVA:` | **sì** |
| 7 | `FASE DI PROGETTAZIONE` / `DALL'IDEA ALLA CASA` / `INGEGNERIZZAZIONE` | fisso |
| 8 | `FASE DI PRODUZIONE "M.H.M." e "P.H.E."` | fisso |
| 9 | `FASE DI TRASPORTO e MONTAGGIO` | fisso |
| 10 | `PREDISPOSIZIONE IMPIANTO ELETTRICO E IDRAULICO` + tabella CEI 64-8 (immagine) | fisso |
| 11 | `OPERE ESCLUSE DAL "GREZZO AVANZATO"` (34 bullet) + `Allestimento cantiere` (9 bullet) | fisso |
| 12 | `OPERE ESCLUSE: FONDAZIONE – OPERE C.A. - PARTICOLARI` + 5 disegni | fisso |
| 13 | `1. LA STRUTTURA` / `PARETE ESTERNA MASSICCIA` (320 mm, U 0,22, sfasamento 22,70 h) | spessori |
| 14 | `PARETE INTERNA MASSICCIA` (185 mm) | spessori |
| 15 | `PARETI NON STRUTTURALI A TELAIO` (125 mm) | spessori |
| 16 | `SOLAIO PHE` + optional | condizionale |
| 17 | `TETTO VENTILATO CON TRAVATURA A VISTA` (U 0,20, sfasamento 11,70 h) | spessori |
| 18 | `ISOLAMENTI e FINITURE ESTERNE-INTERNE` (Gutex / CORKPAN optional / CalceCanapa optional) | condizionale |
| **19** | `SERRAMENTI e PORTONCINO D'INGRESSO` + **abaco serramenti** | **sì** |
| **20** | `PORTONCINO D'INGRESSO` (Steel Project serie Steel 3) | **sì (dimensioni)** |
| 21 | `SCURI – da definire` | condizionale |
| 22 | `AVVOLGIBILI o FRANGISOLE da definire` (Hella) | condizionale |
| 23 | Pagina full-image (render sezionato MHM / SOLAIO PHE) | fisso |
| 24 | `Annotazioni e firme` | fisso |
| 25 | Retro copertina | fisso |

**19 pagine su 25 sono boilerplate immutabile.**

### 4.1 Pagina 4 — le due tabelle

`CARATTERISTICHE STRUTTURA` — 6 righe a dominio chiuso:

```
SISTEMA COSTRUTTIVO     MassivHolzMauer® (M.H.M.)
TETTO                   Tetto con travi e perline in abete
                        Sporgenza tetto: come da disegno
                        Pendenza tetto: come da disegno
MANTO DI COPERTURA      Tegole in cemento
FINITURA ESTERNA        Intonaco
PACCHETTO DI CONSEGNA   Grezzo avanzato
```

`CARATTERISTICHE FABBRICATO – Totale Lordi : 134+13+14= 161 mq. + Garage 41m` — righe fisse,
valore vuoto se non applicabile, **valori come stringhe libere** (`13+14`, non numeri):

```
Piano Terra        Sup. lorda   134     Mq
Piano Primo        Sup. lorda           Mq
Piano sottotetto   Sup. lorda           Mq
Portico            Sup. lorda   13+14   Mq
Terrazzo           Sup. lorda           Mq
Garage             Sup. lorda   41      Mq
```

### 4.2 Pagina 5 — la tabella prezzi

3 colonne senza intestazione: `n.` (interi + suffisso lettera per sottovoci) |
`Descrizione` (multiriga, fino a 8 righe) | `Importo` allineato a destra,
formato italiano `96 100,00 €`.

Voci osservate in Crivellaro: `1, 1.a, 1.b, 1.c, 2, 3, 4, 4.a, 5, 5.a, 6, 7, 8`.

`Optional:` — lettere maiuscole con parentesi, importi **non sommati**
(`A) Pratica per deposito al Genio Civile dei calcoli sismici — 5 000,00 €`).

`Esclusioni :` — lettere minuscole, colonna destra testuale
(`a) Gru da cantiere — escluso`, `d) Operaio specializzato — € 35,00/ora`).

### 4.3 Pagina 6 — condizioni

`Pagamento` — scaletta SAL, percentuali che sommano 100% + caparra a importo libero:

```
€________  Caparra confirmatoria da restituire al SAL 7
20%   Acconto al contratto
10%   Informativa di cantiere
40%   Inizio montaggio
      [clausola fidejussione bancaria/assicurativa sull'importo escluso i primi 3 SAL]
10%   Al tetto primo tavolato (escluso tegole)
10%   Cappotto esterno grezzo (escluso intonachino)
 5%   Inizio posa Cartongesso
 5%   Fine lavori
```

`Consegna: da pattuire` · `Validità offerta: 30.06.2026` · `IVA: esclusa dai prezzi sopra
indicati` (mai calcolata nel documento; 22% in fattura salvo agevolazioni) ·
`POLIZZA C.A.R.` inclusa, `POLIZZA DECENNALE POSTUMA` a richiesta (art. 1669 c.c.) ·
firma `FBE Woodliving / Resp. Ufficio Comm.le / Cesare Cappellazzo`.

---

## 5. Moduli e pacchetti

Confermato da FBE: i moduli sono blocchi di lavorazioni, e "impoverita" indica sia un
sottoinsieme di voci sia specifiche ridotte.

```
Modulo 1 · STRUTTURA   →  pareti-mhm, tracciamento-impianti, pareti-telaio, trave-larice,
                          solaio-interpiano (solo se piani > 1), progettazione-esecutiva
Modulo 2 · INVOLUCRO   →  copertura-falda | tetto-piano, veletta-copertura-piana,
                          cappotto, infissi-pvc, monoblocchi
Modulo 3 · FINITURE    →  cartongesso-q2, assistenza-cartongessisti, opere-chiavi-in-mano
```

### 5.1 I numeri di voce NON sono identificatori — si rinumerano

Confronto fra i due documenti analizzati:

| Contenuto | rev.00 Baetta (2 piani) | rev.04 Crivellaro (monopiano) |
|---|---|---|
| Pareti strutturali MHM | 1 | 1 |
| Solaio interpiano | **2** | *assente* |
| Copertura a falda | **3** | **2** |
| Cappotto | 4 | **3** |
| Cartongesso Q2 | 5 | **4** |
| Infissi PVC | 6 | **5** |
| Consulenza progettazione | **7** | **6** |

Escludere il solaio fa slittare tutte le voci successive. Quindi:

- il catalogo usa **id stabili** (`pareti-mhm`, `copertura-falda`, …)
- il **numero visualizzato** (`1`, `1.a`, `2`, `4.a`) è **calcolato al momento del render**,
  scorrendo le voci incluse in ordine di catalogo
- i suffissi lettera (`.a`, `.b`, `.c`) numerano le sottovoci dentro la voce padre
- nessun riferimento incrociato nel testo può citare un numero di voce come costante
  (attenzione: la legenda `**` del rev.00 dice `CONDIZIONI DI FORNITURA (quotazione punto 7)`
  e in rev.04 la stessa voce è il punto 6 — va reso dinamico, altrimenti il documento
  rimanda al punto sbagliato)

Quest'ultimo è un bug già presente nei documenti attuali.

Ogni modulo entra a un livello: `completo` · `impoverito` · `escluso`.
`impoverito` seleziona un sottoinsieme di voci **e/o** applica specifiche ridotte
(spessore, finitura, prezzo e descrizione alternativi).

| Pacchetto | M1 struttura | M2 involucro | M3 finiture |
|---|---|---|---|
| Grezzo | completo | impoverito (tetto sì, cappotto/infissi no) | escluso |
| **Grezzo avanzato** | completo | completo | impoverito (solo cartongesso Q2) | ← Crivellaro |
| Chiavi in mano | completo | completo | completo (= + `opere-chiavi-in-mano`) |

**`opere-chiavi-in-mano` (voce 7 in Crivellaro) non è una voce a sé: è il delta di Modulo 3
da `impoverito` a `completo`.**
Coerente col fatto che il suo contenuto (massetti, pavimenti, impianti, tinteggiature,
oscuranti) è l'elenco delle 34 `OPERE ESCLUSE DAL "GREZZO AVANZATO"` marcate
`(optional chiavi in mano)` a pag. 11.

**Correzione (§3.9): la sua presenza nel `TOTALE AL NETTO` non è automatica.** In Crivellaro
è sommata; in un'altra offerta reale con lo stesso Modulo 3 impoverito (Fabrello) è invece
riportata solo in sezione `Optional:`, esclusa dal totale. È una scelta commerciale
esplicita per singola offerta, non derivabile dal solo livello del modulo. Il modello
aggiunge un campo `chiaviInManoNelTotale: boolean` (default `false`); la voce è candidabile
quando `finiture !== 'completo'`, ma entra nel totale numerato solo se il flag è `true`.

Questa tabella è configurazione, non codice: si corregge senza toccare l'applicazione.

---

## 6. Listino parametrico

Ricavato da Crivellaro (161 mq lordi = 134 PT + 13 + 14 portico; garage 41 mq).
**Base: un solo preventivo con prezzi reali** — il rev.00 di Baetta ha tutti gli importi a
0,00. Decisione presa: si usa Crivellaro come riferimento e i valori sono **parametri
modificabili in una schermata di configurazione**, non costanti nel codice.

Numerazione delle voci come in Crivellaro (cfr. §5.1: i numeri si rinumerano).

| Voce | Driver | Valore | % del listino |
|---|---|---|---|
| 1 Pareti strutturali MHM (est. 205 / int. 205-160) | mq sup. lorda | **597 €/mq** | 40,5% |
| 1.c Trave alla base in larice | ml perimetro | ~97 €/ml (5 800 su ~60 ml) | 2,4% |
| 2 Copertura a falda | **mq sup. sedime** (impronta a terra, non somma piani) | **475 €/mq** | 26,8% |
| 3 Cappotto fibra di legno 60+40 | mq sup. lorda | **126 €/mq** | 8,6% |
| 4 Cartongesso interno Q2 | mq sup. lorda | **96 €/mq** | 6,5% |
| 4.a Assistenza cartongessisti | % voce 4 | **14,2%** di voce 4 | 0,9% |
| 5 Infissi PVC | mq serramenti + portoncino a corpo | **502 €/mq** + 4 000 € | 8,1% |
| 5.a Monoblocchi Hella | n° serramenti | ~927 €/pz (10 200 / 11) | 4,3% |
| 6 Consulenza progettazione esecutiva | **a corpo fisso** | **4 000 €** | 1,7% |
| 7 Chiavi in mano (delta M3) | mq sup. lorda | **553 €/mq** | — |
| 8 Garage | mq garage | **488 €/mq** | — |
| | **Listino totale** | **1 472 €/mq lordi** | 100% |

Controprove:

- voce 6 = **4 000 € in entrambe le offerte** (Baetta e Crivellaro, superfici e prezzi
  totalmente diversi) → confermato a corpo fisso
- voce 5 meno il portoncino: `(19 300 − 4 000) / 30,50 = 502 €/mq` di serramento, contro i
  **600 €/mq** del listino Primus per il PVC Synego → coerente, il delta è lo sconto incorporato
- `PARZIALE grezzo avanzato / 161 mq = 1 186 €/mq` · `TOTALE / 161 = 1 863 €/mq`

**Limite noto e accettato:** con un solo punto dati non è possibile distinguere cosa scala
linearmente e cosa no (una casa da 80 mq non costa metà di una da 160), né tarare il caso
multipiano con solaio interpiano (assente in Crivellaro, monopiano). Mitigazione: i valori
sono parametri esposti in UI; ogni importo mostra la propria provenienza.

**Aggiornamento (§3.9), dopo tre preventivi reali aggiuntivi:** confermato che il driver
"mq sup. lorda" non generalizza sul caso multipiano per la copertura — un tetto segue
l'impronta a terra, non la somma dei piani (Lucarelli, 2 piani: errore dal +93% al +8%
correggendo il driver). Verificato invece che pareti e cappotto **non** beneficiano dello
stesso cambio (l'errore peggiora, da 10-12% a 38-50%): scalano col numero di piani, quindi
`mq sup. lorda` resta il driver corretto per quelle due voci. Solo `copertura-falda` è
stata corretta; il coefficiente 475 €/mq deriva da 63 600 € / 134 mq (impronta Piano Terra
di Crivellaro), non più da 63 600 / 161.

### 6.1 Prezzi unitari optional (dal corpo tecnico del documento)

Da gestire come listino collegato alle sezioni descrittive:

| Voce | Valore |
|---|---|
| Ore in economia / assistenza impiantisti / lavorazioni extra | **€ 35,00/ora per persona** |
| Telo `Clima control 98` + `Seal Band` (blower door CasaClima) | € 13,50/mq |
| Intonaco anti-microcavillature | € 22,00/mq |
| Adattamento lastra a scatole non per murature leggere | € 10,00 cad. |
| Velette in cartongesso | € 40/ml |
| Strutture per pareti WC | € 60/mq |
| Meccanismo a scrigno | € 500,00 cad. |
| Impregnazione + finitura solaio lamellare in cantiere | € 15,00 a mq/mano |
| Impregnazione + finitura solaio PHE in cantiere | € 20,00 a mq/mano |
| Terza mano finitura solaio travi/tavolato | € 25,00 a mq |
| Terza mano finitura tetto in cantiere | € 35,00 a mq |
| Finitura tetto piano in cantiere | € 20,00 a mq |
| Parapasseri in plastica / metallici | € 7,50/ml · € 15,00/ml |
| Vasca in lamiera per fotovoltaico | € 45,00 a mq |

---

## 7. Architettura

```
FbePreventivatore/
├── Documentazione addestramento/          ← file forniti da FBE, invariati
├── docs/superpowers/specs/                ← questa spec
├── template/
│   └── Offerta MHM master.docx            ← master preparato con i placeholder
└── app/
    ├── domain/        TS puro, nessun framework, interamente testabile
    │   ├── geometria.ts
    │   ├── listino.ts
    │   ├── voci.ts
    │   ├── calcolo.ts
    │   └── boilerplate.ts
    ├── ai/            estrazione campi, abaco serramenti, controlli di coerenza
    ├── documento/     componenti preview + generazione docx
    └── app/           wizard (chat + 5 step) e pannello preview
```

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Prisma su SQLite.
SQLite perché un file `.db` non richiede infrastruttura per un prototipo; il passaggio a
Postgres è una riga in `schema.prisma`.

**Progetto totalmente separato** da `GeneratorePreventivi`. L'unico riuso previsto è
l'impostazione di `QuoteDocument/` + `print.css` per la resa A4 della preview; il dominio
è troppo diverso (voci gerarchiche, boilerplate condizionale, geometria edificio) per
condividere lo schema.

### 7.1 I moduli di dominio

| Modulo | Responsabilità | Verifica |
|---|---|---|
| `geometria.ts` | superfici per piano, serramenti b×h con detrazioni 0,60/0,30, perimetro, falde | riproduce `Conteggi pulito.xlsx`: 30,50 mq lordi / 15,89 netti |
| `listino.ts` | parametri prezzo con driver, versionati per anno | — |
| `voci.ts` | catalogo superset, etichettatura per modulo, regole di inclusione | monopiano → nessuna voce solaio interpiano |
| `calcolo.ts` | valorizzazione, sconti a cascata, arrotondamento, **funzione inversa** | riproduce la catena Crivellaro |
| `boilerplate.ts` | blocchi di testo con condizioni, spessori derivati dalla configurazione | `SCURI` marcato "da definire" se non scelto |

Ogni modulo ha un'interfaccia esplicita e nessuna dipendenza da React, Prisma o rete.

### 7.2 Il motore di calcolo — bidirezionale

**Senso diretto:**

```
Geometria + Configurazione + Listino
  → voci valorizzate (driver: €/mq lordi · €/ml · €/pz · % di altra voce · a corpo)
  → Listino <anno> = Σ voci gruppo GREZZO
  → sconti a cascata → arrotondamento → PARZIALE
  → + voci POST_SCONTO → TOTALE AL NETTO
```

**Senso inverso** (quello effettivamente usato da FBE):

```
totale target (es. 300 000 tondi)
  → risolve l'Arrotondamento necessario e lo scrive nella riga
  → se |arrotondamento| > 2% del listino: avviso, non silenzio
```

Ogni importo porta la propria **provenienza**: `proposto` (dal listino) · `manuale`
(digitato) · `ripartito` (spalmato dal totale). Visibile in UI: distingue una stima da una
decisione, e in demo rende evidente che il sistema non inventa numeri.

---

## 8. Modello dati

```
Cliente         nome, comune, provincia
Preventivo      protocollo (es. 2026059), cliente, oggetto, progettista
  └── Revisione numero (01..NN), data, luogo, stato (bozza|inviata|firmata)
        ├── Configurazione   tipoCopertura, mantoCopertura, finituraEsterna,
        │                    pacchetto, livelloModulo{M1,M2,M3}
        ├── Geometria        superfici[]{piano, valoreLordo:string, mq}
        │                    serramenti[]{n, piano, tipologia, b, h}
        │                    pareti[]{n, interna|esterna, b, h, spessore}
        │                    falde[], perimetro, travi[]
        ├── ListinoSnapshot  copia immutabile dei parametri usati   ← §3.7
        ├── Voci[]           numero, sottovoce?, modulo, gruppo(GREZZO|POST_SCONTO),
        │                    descrizione, importo (number|testo), provenienza, driver
        ├── Sconti[]         ordine, percentuale, causale, importoCalcolato   ← cascata
        ├── Arrotondamento   importo
        ├── Optional[]       lettera, descrizione, importo   (fuori totale)
        ├── Esclusioni[]     lettera, descrizione, esito
        └── Condizioni       pagamento{caparra, sal[]{percentuale, milestone}},
                             consegna, validita, regimeIVA
```

`Revisione` è uno **snapshot immutabile**. Nuova revisione = copia della precedente, poi
modificata. L'ordine degli sconti è significativo (cascata).

---

## 9. Il wizard

### 9.1 Apertura in chat

Input in linguaggio naturale, es.:

> *"casa per Crivellaro Mariano a Trissino, protocollo 2026059, monopiano da 134 mq più
> portico 13 e 14, garage 41, tetto a falde con tegole in cemento, intonaco esterno,
> grezzo avanzato"*

L'LLM estrae i campi in un oggetto strutturato e mostra **cosa ha capito e cosa manca**:

```
✓ Cliente          Crivellaro Mariano — Trissino (VI)
✓ Protocollo       2026059  rev. 01
✓ Piano Terra      134 mq          ✓ Portico  13+14 mq      ✓ Garage  41 mq
✓ Copertura        tetto a falde   ✓ Manto    tegole in cemento
✓ Finitura est.    intonaco        ✓ Pacchetto  grezzo avanzato
? Progettista      — manca
? Serramenti       — 0 inseriti
```

### 9.2 Form strutturato — 5 step

1. **Anagrafica** — cliente, comune, provincia, progettista, protocollo, revisione, data, luogo
2. **Configurazione** — copertura, manto, finitura esterna, pacchetto, livello dei 3 moduli
3. **Geometria** — superfici per piano, serramenti (b×h), pareti, perimetro, falde
4. **Prezzi** — voci proposte dal listino, ognuna sovrascrivibile; sconti; totale target
5. **Condizioni** — SAL, caparra, consegna, validità, optional, esclusioni

I domini sono chiusi (copertura: piano/falde · finitura: intonaco/rivestimento · pacchetto:
3 valori × 3 livelli modulo) → qui servono menu, non LLM.

### 9.3 Dove interviene l'AI — quattro punti

1. **Estrazione dalla frase iniziale** — riempie 10-15 campi; rischio nullo perché tutto è
   visibile e correggibile
2. **Generazione dell'abaco serramenti** — dai b×h alla frase nel formato dell'offerta
   (`Finestre con apertura a battente: n. 4 dim. 90x120; n. 1 dim. 200x180;`).
   Automatizzabile al 100%, verificato in §3.6
3. **Adattamento delle descrizioni voce alle specifiche scelte** — gli spessori
   (`esterne sp. mm 205 ed interne sp. mm 205-160`, `sp. mm 60+40`, `160 mm (80+60+20)`)
   derivano dalla configurazione invece di essere ricopiati in 4-5 punti
4. **Controlli di coerenza pre-export** — gli errori elencati in §3.8

**L'AI non decide i prezzi.** Gli importi escono dal listino parametrico o sono digitati.

---

## 10. Preview ed export

### 10.1 Preview live — solo le pagine variabili

Pannello A4 affiancato al wizard, ricalcolato a ogni modifica: **pagg. 4, 5, 6 e l'abaco
serramenti (19-20)**. Componenti React con `print.css`.

### 10.2 Export — iniezione nel master `.docx`

Le 19 pagine di boilerplate contengono **96 immagini per 31 MB**, caselle di testo, EMF
vettoriali e schede tecniche con tabelle di trasmittanza. Ricostruirle in HTML costerebbe
settimane per un risultato **non identico** a quello che FBE invia oggi.

```
Offerta MHM master.docx ──(docxtemplater: solo i placeholder)──► offerta compilata.docx → PDF
   19 pagine boilerplate, 96 immagini, 31 MB      intatte, byte per byte
```

Il documento esportato resta un Word ritoccabile prima dell'invio.

**Preparazione una volta sola del master** (~mezza giornata):

- sostituire i segnaposto attuali con placeholder veri (incluso il residuo `PROT. 000-22 REV.00`)
- **rifare la tabella prezzi di pag. 5 come tabella Word nativa**: oggi in rev.04 è un
  oggetto Excel incorporato e in rev.00 un'immagine PNG (`image15.png`, 600×937) — in
  entrambi i casi non iniettabile. È la ragione per cui quella pagina si compila a mano.

### 10.3 Rischio da chiudere al giorno 1

Il master ha 776 elementi `<w:tbl>`, 21 caselle di testo e markup `mc:AlternateContent` che
duplica il testo nei fallback. Non è un Word semplice: docxtemplater può inciampare sui
placeholder dentro le caselle di testo.

**Primo task del progetto: spike da un'ora** — un placeholder in copertina e uno nella
tabella prezzi, iniettati sul master reale. Se funziona la strada è confermata; se non
funziona si ripiega su HTML→PDF sapendolo subito invece che alla terza settimana.

---

## 11. Verifica

**Golden case Crivellaro.** Test scritti prima del codice:

| Verifica | Valore atteso |
|---|---|
| geometria serramenti | 30,50 mq lordi · 15,89 mq netti |
| `Listino 2026` | 237 000,00 |
| sconto cliente 10% | −23 700,00 → 213 300,00 |
| sconto conferma 10% (cascata) | −21 330,00 → 191 970,00 |
| arrotondamento | −1 070,00 |
| `PARZIALE AL GREZZO AVANZATO` | 190 900,00 |
| `TOTALE AL NETTO` | 300 000,00 |
| voci incluse (monopiano) | nessuna voce solaio interpiano |
| rinumerazione (§5.1) | monopiano: `copertura-falda` → n. **2** · multipiano: → n. **3** |
| funzione inversa | dato target 300 000 → arrotondamento −1 070,00 |

Se il motore non riproduce questi numeri, non è pronto.

Oltre a questo: snapshot test sul `.docx` generato (presenza dei valori attesi, assenza di
placeholder residui) e unit test su ogni modulo di `domain/`.

---

## 12. Fuori scope in questa fase

- **parsing del computo Primus** — il modello dati è progettato per accoglierlo in fase 2
  senza riscritture, ma il grafo `Vedi voce n° 21 [m2 170.18] × 0,50` con catene lunghe
  (voce 110 → 111 → 114 → 115 → 116) è la parte tecnicamente più incerta
- **lettura del DWG** (`Tav_06 bozza Stato_Progetto_27-06-2026.dwg`)
- **calcolo dell'IVA** — il documento non la calcola mai, per scelta
- taratura multi-caso del listino (richiede altri preventivi con prezzi reali)
- autenticazione, multiutenza, deploy in produzione

---

## 13. Glossario

| Termine | Significato |
|---|---|
| **MHM** | `MassivHolzMauer®` — parete in legno massiccio senza colle, chiodata in alluminio (ETA N.13/0799) |
| **PHE** | sistema di solaio prodotto da FBE |
| **mod.05-COM** | codice del template Word dell'offerta commerciale |
| **Primus** | software di computo metrico di ACCA software |
| **SAL** | Stato Avanzamento Lavori — milestone di pagamento |
| **Grezzo avanzato** | pacchetto di consegna: struttura + involucro + cartongesso Q2, senza finiture |
| **Impoverito** | livello ridotto di un modulo: sottoinsieme di voci e/o specifiche ridotte |
| **Listino 2026** | riga-somma delle voci del gruppo GREZZO, prima degli sconti |
