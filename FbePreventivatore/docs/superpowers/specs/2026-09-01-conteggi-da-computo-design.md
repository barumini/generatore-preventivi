# Conteggi da computo metrico

## Problema

Oggi il preventivatore ricava gli importi delle voci dal listino parametrico
(`src/domain/listino.ts`) a partire dalla geometria digitata nel wizard. Esiste però un
secondo percorso, oggi interamente manuale: quando l'ufficio tecnico ha già prodotto il
**computo metrico Primus** del progetto, gli importi dell'offerta si ricavano da quello,
applicando una decina di regole di conversione fissate da FBE.

Il foglio `Documentazione addestramento/x IA/Conteggi Master.xlsx` è la struttura di
arrivo: elenca le voci che compaiono sempre nell'offerta, con gli importi fissi già
valorizzati (`Consulenza progettazione esecutiva` = 4.000) e a `0` quelle da conteggiare.
Questo design copre il passaggio dal computo a quei valori.

Il percorso è **alternativo** al listino parametrico, non sostitutivo: la pagina è
autonoma e non scrive sui preventivi esistenti.

## Cosa dice il computo

Un computo Primus di FBE si chiude con un **Riepilogo Strutturale CATEGORIE** che è la
fonte di metà delle regole:

| Codice | Categoria | Dacroce rev.03 | Crivellaro rev.04 |
|---|---|---:|---:|
| `M:001.001` | PARETI IN LEGNO | 105.987,63 | 79.500,82 |
| `M:001.002` | SOLAIO | 15.240,96 | 0,00 |
| `M:001.003` | COPERTURA | 68.428,78 | 76.701,12 |
| `M:001.004` | CAPPOTTO | 25.684,61 | 25.264,43 |
| `M:001.005` | CARTONGESSO | 23.612,10 | 19.337,12 |
| `M:001.007` | INFISSI | 57.337,00 | 32.105,00 |
| `M:001.020` | COSTI SICUREZZA | 23.352,50 | 23.352,50 |
| `M:001.021` | TRASPORTI | 4.000,00 | 4.000,00 |
| | **TOTALE** | **323.643,58** | **260.260,99** |

L'altra metà viene dalle singole voci a misura: 166 in entrambi i computi analizzati.
Ogni voce ha numero d'ordine, codice **tariffa**, descrizione, unità di misura, quantità,
prezzo unitario e totale.

### Le voci si indirizzano per tariffa, non per numero

Le istruzioni FBE citano le voci per numero d'ordine («codice 128», «codici 142-146»).
Il numero è però **posizionale**: dipende da quante voci precedono nel computo. La
tariffa (`107.04.01`, `109.04.02`, …) è invece l'identità stabile della lavorazione nel
prezzario.

Sui due computi disponibili le due cose coincidono — 166 voci su 166 hanno la stessa
tariffa allo stesso numero, perché FBE usa un template Primus rigido — ma la coincidenza
non è garantita da nulla. Le regole si ancorano quindi alla **tariffa**, e il numero
d'ordine atteso resta come controllo incrociato: se divergono, la UI segnala l'anomalia
invece di produrre in silenzio un numero sbagliato.

Stesso principio del vincolo #4 di `CLAUDE.md`, applicato in ingresso anziché in uscita.

### "Il totale a pagina 2" non è una regola

L'istruzione originale per la trave alla base diceva di prendere «il valore totale a
pagina 2 (nel caso esempio: 4´697,52)» e sommarci `104.01.022` e `104.01.023`.

Quel 4´697,52 è il subtotale `A RIPORTARE` di pagina 2 del **computo Crivellaro**, dove
la pagina contiene esattamente le voci 1-9. Nel computo Dacroce lo stesso blocco di
tariffe chiude a 8.208,13, sempre a fine pagina 2. La coincidenza dipende
dall'impaginazione di Primus, che nessuno controlla.

Il blocco è semanticamente ben definito — l'assieme della trave di base — e corrisponde
alle tariffe:

- `106.01.01`…`106.01.04` — guaina tagliamuro (pareti 25.0 / 20.5 / 16.0 / 11.0)
- `104.01.017`…`104.01.020` — cordolo in trave lamellare (larice, abete per la 11.0)
- `104.01.021` — ferramenta per fissaggio cordoli
- `104.01.022` — ferramenta cordolo, tasselli
- `104.01.023` — spessori di plastica

Esclude `104.01.024` (posa cordolo pareti), che nei due computi cade oltre il subtotale
citato. La regola diventa così indipendente dall'impaginazione.

## 1. Estrazione (dominio puro)

Nuovo modulo `src/domain/computo/estrai-voci.ts`. **Non conosce i PDF**: riceve righe di
testo già posizionate e restituisce dati.

```ts
interface RigaTesto { pagina: number; x: number; y: number; testo: string }

interface VoceComputo {
  numero: number
  tariffa: string
  categoria: string | null      // "PARETI IN LEGNO", "COPERTURA", …
  descrizione: string
  unita: string | null          // "m", "m2", "cadauno", "a corpo"
  quantita: number | null
  prezzoUnitario: number | null
  totale: number | null
}

interface Computo {
  voci: VoceComputo[]
  riepilogo: Record<string, { nome: string; importo: number }>  // "M:001.001" → …
  totale: number
}
```

### Una tariffa può comparire più volte

Non è un caso limite teorico ed è più diffuso di quanto sembri. In **entrambi** i computi
ci sono 166 voci ma solo 159 tariffe distinte: **7 tariffe compaiono due volte**, e sono
esattamente le stesse sette nei due progetti.

| Tariffa | Le due voci | Dacroce | Crivellaro |
|---|---|---|---|
| `103.02.09` | sovrapprezzo solaio PHE 20cm / PHE 12cm | 0 · 0 | 0 · 0 |
| `104.01.015` | teli e nastrature: velette / pareti | 0 · 174,96 | 0 · 170,18 |
| `104.01.016` | ferramenta sismica: velette / pareti | 0 · 246,71 | 0 · 209,23 |
| `104.02.000` | copertura: sporto-tettoie-portico / **a falda** | 0 · 184,18 | 42,84 · 186,35 |
| `104.02.006` | listelli ventilazione: falda / tetto piano | 184,18 · 0 | 229,19 · 0 |
| `104.02.018` | pannello OSB: due varianti | 0 · 0 | 0 · 0 |
| `104.02.021` | travi lamellare: **pareti / copertura** | 4,01 · 1,37 | 1,16 · 1,31 |

La ragione è che tariffa e voce sono cose diverse. La **tariffa** è l'articolo di
prezzario: dice *che lavorazione è* e a quale prezzo unitario. La **voce** è una riga di
misurazione: dice *dove* e *quanto*. Il computista apre più righe sulla stessa tariffa
quando vuole tenere separate quantità che hanno destinazioni fisiche diverse — la falda
dallo sporto, le pareti dalle velette, le travi delle pareti da quelle della copertura.

Due conseguenze da tenere presenti:

- `104.02.021` mostra che una tariffa non è unica **nemmeno dentro una categoria**: le due
  righe stanno in `PARETI IN LEGNO` e in `COPERTURA`, ed entrambe hanno un valore. Non si
  può disambiguare per categoria.
- In Dacroce `104.02.000` compare due volte come in Crivellaro, ma la riga dello sporto ha
  quantità 0: sommare o scegliere dà lo stesso risultato. Per questo un test scritto solo
  su Dacroce non accorgerebbe la differenza, e Crivellaro è indispensabile.

Un indice `tariffa → VoceComputo` che tiene una voce sola perde silenziosamente le altre.
L'accesso restituisce quindi sempre una **lista**, e ogni regola dichiara come sceglie:

```ts
vociPerTariffa(computo, tariffa: string): VoceComputo[]
sommaTotali(computo, ...tariffe: string[]): number      // somma tutte le occorrenze
sommaQuantita(computo, ...tariffe: string[]): number    // somma tutte le occorrenze
voceUnica(computo, tariffa: string, filtroDescrizione?: RegExp): VoceComputo
```

`voceUnica` serve dove la regola FBE punta a **una** lavorazione precisa e non
all'aggregato: solleva se le corrispondenze sono zero o più di una, così un computo fuori
standard si ferma invece di scegliere a caso.

Delle sette tariffe ripetute, **una sola** è toccata dalle regole del master:
`104.02.000`, nella copertura a falda. Il discriminante è la descrizione (`/FALDA/`): la
regola originale cita il «codice 59», che in entrambi i computi è la riga a falda, mentre
lo sporto resta fuori. Tutte le altre tariffe usate dalle regole — `106.01.*`,
`104.01.017-023`, `104.02.011`, `204.03.08`, `107.04.01`, `109.04.*` — compaiono una volta
sola in entrambi i computi, e per quelle `sommaTotali` e `sommaQuantita` restano corrette
qualunque cosa accada.

Che la regola prenda la sola falda è coerente col computo, non una perdita: gli strati
della copertura si dividono proprio su quelle due quantità. In Crivellaro il pacchetto
coibente — freno a vapore, isolamento in fibra di legno, relativa posa — è misurato su
186,35 mq, la falda; struttura, manto e lattoneria — travi, tavolato, membrana, listelli,
tegole — su 229,19 mq, falda più sporto. Lo sporto non si coibenta perché sta fuori
dall'involucro riscaldato. I 220 €/mq della regola valorizzano il pacchetto coibentato,
quindi la superficie giusta è quella della falda.

Il riconoscimento sfrutta la griglia fissa di Primus, verificata su entrambi i PDF:

- una voce si apre con `N / N` in colonna sinistra (x < 25);
- la riga successiva porta la tariffa (`\d{3}\.\d{2}\.\d{2,3}`), sempre a x < 25;
- la riga `SOMMANO <unità>` chiude la voce e porta i tre numeri, distinti per ascissa:
  quantità in 430-485, prezzo unitario in 486-520, totale oltre 535;
- le righe del riepilogo hanno forma `M:001.NNN <nome> euro <importo>`;
- le intestazioni di categoria hanno forma `<nome> (Cat N)` centrate fra x 100 e 220.

I numeri usano l'apostrofo tipografico per le migliaia (`260´260,99`, cfr. `CLAUDE.md`) e
la virgola decimale.

**Verifica di integrità**: la somma dei totali di tutte le voci deve pareggiare il
`TOTALE` del riepilogo. Su entrambi i computi torna al centesimo (323.643,58 e
260.260,99). Se non pareggia, l'estrazione è andata storta e va detto, non aggirato.

L'adattatore che produce le `RigaTesto` da un `File` vive fuori dal dominio, in
`src/app/preventivi/conteggi/leggi-pdf.ts`, e usa `pdfjs-dist` (nuova dipendenza):
`getTextContent()` restituisce per ogni frammento la stringa e la matrice di trasformazione,
da cui `x = transform[4]`, `y = transform[5]`. Gira nel browser, quindi il PDF non viene
caricato da nessuna parte.

## 2. Le regole (dominio puro)

`src/domain/computo/regole-conteggio.ts`. Una funzione per voce del master, ciascuna
restituisce il risultato **con i suoi passaggi**, perché l'interfaccia deve mostrarli.

```ts
interface Passaggio {
  etichetta: string
  origine: { tariffa?: string; numeroVoceAtteso?: number; categoria?: string }
  valore: number
  unita: 'mq' | 'nr' | 'eur'
}

type ImportoConteggiato = number | 'compresa'

interface VoceConteggiata {
  idMaster: string                 // id stabile: 'pareti-mhm', 'trave-base', …
  descrizione: string
  passaggi: Passaggio[]
  formula: string                  // "(184,18 × 220 + 68.428,78) / 2"
  importo: ImportoConteggiato
  provenienza: 'calcolato' | 'manuale' | 'fisso'
}
```

`provenienza` rispetta il vincolo #7 di `CLAUDE.md`: ogni importo dichiara da dove viene.
Correggere un valore a mano lo marca `manuale` e la UI lo evidenzia.

### Tabella delle regole

| `idMaster` | Voce master | Regola |
|---|---|---|
| `pareti-mhm` | Pareti strutturali M.H.M. | `M:001.001`, **più il delta di pareggio** (§3) |
| `trave-base` | Trave alla base in larice | Σ totali tariffe `106.01.01-04` + `104.01.017-023` |
| `solaio-interpiano` | Solaio interpiano | `M:001.002` |
| `copertura-falda` | Copertura a falda | ((mq `104.02.011` + mq `104.02.000` riga `/FALDA/`) × 220 + `M:001.003`) / 2 |
| `copertura-piana` | Tetto piano | sempre `compresa` — l'importo sta su `copertura-falda` |
| `veletta-perimetrale` | Veletta perimetrale | nessuna regola FBE: `compresa` |
| `cappotto` | Cappotto esterno | (mq `204.03.08` × 90 + `M:001.004`) / 2 |
| `cartongesso` | Cartongesso interno | (mq `107.04.01` × 22 + mq `107.04.01` × 5 + `M:001.005`) / 2 |
| `assistenza-cartongessisti` | Assistenza ai cartongessisti | mq `107.04.01` × 5 |
| `infissi` | Infissi esterni in PVC | Σmq (`109.04.02`,`.03`,`.04`,`.05`,`.06`) × 500 + Σnr (`109.04.07`…`.11`) × 100 + nr `109.04.07` × 4000 |
| `monoblocchi` | Monoblocchi Hella | Σ totali `109.04.12` + `109.04.13` + `109.04.14` |
| `consulenza-esecutiva` | Consulenza progettazione esecutiva | 4.000,00 fisso |
| `tracciamento-impianti` | Tracciamento impianto idrosanitario | `compresa`, non modificabile |
| `pareti-telaio` | Pareti non strutturali a telaio | `compresa`, non modificabile |

Note sulle regole, dove il testo FBE era ambiguo e la lettura è stata fissata:

- **Cartongesso.** Il `× 5` è la stessa quantità della voce `assistenza-cartongessisti`,
  che viene comunque fatturata a parte. Decisione confermata: entra lo stesso nella media,
  quindi l'assistenza pesa per metà anche dentro la voce cartongesso. Su Dacroce
  (11.684,20 + 2.655,50 + 23.612,10) / 2 = 18.975,90.
- **Cappotto.** L'istruzione parla di «mq riportati al codice `001.004`», ma `M:001.004` è
  un importo in euro, non una superficie. La media è fra due valori in euro. La superficie
  è quella del «codice 116», cioè la posa `204.03.08` (195,16 mq su Dacroce): non i
  pannelli `204.03.01`, che coprono una superficie minore.
- **Infissi, secondo gruppo.** Le tariffe `109.04.07`…`.11` sono voci di montaggio in
  `cadauno`, non in mq: si sommano i pezzi (14 su Dacroce) e si moltiplicano per 100.
- **Infissi, primo gruppo.** `109.04.02` (portabalcone) è dichiarata `cadauno` nel computo
  ma la quantità è una superficie (2,10 = 1,00 × 2,100). Si somma come mq, coerentemente
  con le altre quattro tariffe del gruppo.
- **Portoncini.** Il conteggio è la quantità di `109.04.07`, non il suo importo.
- **Monoblocchi.** Si sommano i **totali in euro** delle tre tariffe, non le quantità.
- **Copertura, quale riga.** La superficie a falda è quella della riga `104.02.000` la cui
  descrizione contiene `FALDA` — il «codice 59» dell'istruzione. In Crivellaro la stessa
  tariffa porta anche sporto, tettoie e portico (42,84 mq), che restano fuori.

### Arrotondamento

Ogni voce si arrotonda al centesimo con `ROUND_HALF_UP` **prima** di entrare nella somma,
riusando `arrotondaCentesimi` di `src/domain/calcolo.ts`.

Non è un dettaglio: su entrambi i computi il cappotto cade esattamente su mezzo centesimo
(21.624,505 su Dacroce, 21.253,315 su Crivellaro). Sommare i valori grezzi e arrotondare
alla fine sposta il delta di pareggio di un centesimo, e i golden case non tornerebbero
più. La convenzione va fissata nei test, non lasciata all'aritmetica in virgola mobile.

### Righe a zero

Una voce il cui calcolo dà `0` non mostra `0,00`: mostra `compresa`, come già fanno
tracciamento impianti e pareti a telaio. Su Crivellaro il solaio (`M:001.002` = 0,00) esce
quindi come `compresa`.

`compresa` non è un numero e non entra nelle somme — vincolo #5 di `CLAUDE.md`.

L'offerta Crivellaro rev.04 in effetti omette del tutto la riga del solaio e rinumera le
successive, che è quanto il vincolo #4 permetterebbe. Resta però una scelta commerciale, e
la scelta fatta è mostrare `compresa`: la riga tiene il cliente informato che il solaio è
contemplato. Il motore di numerazione al render regge comunque entrambi i comportamenti,
perché numera sulle voci incluse.

**Caso non coperto.** La regola FBE manda l'importo della copertura sempre sulla riga a
falda, anche quando esiste copertura piana. Un edificio con **solo** copertura piana
lascerebbe quindi l'importo su una riga a `compresa`, perdendolo. Nessuno dei due computi
disponibili è in questo caso (piana = 0 mq in entrambi). L'implementazione emette un
avviso bloccante se incontra `mq piana > 0 e mq falda = 0`, invece di produrre un totale
sbagliato in silenzio.

## 3. Riconciliazione (dominio puro)

`src/domain/computo/conteggio.ts`.

```
somma        = Σ importi numerici delle voci conteggiate
target       = TOTALE computo − COSTI_SICUREZZA_FORFETTARI
delta        = target − somma
pareti-mhm  += delta
```

`COSTI_SICUREZZA_FORFETTARI = 23_300` è una costante nominata, in un solo punto del
codice.

Entrambi i computi analizzati riportano però `M:001.020 = 23.352,50`. Lo scarto di 52,50
è voluto — la costante è tarata per far atterrare il Listino vicino a una cifra tonda — ma
resta un valore da tenere d'occhio: il conteggio emette un **avviso non bloccante** quando
`M:001.020` differisce dalla costante, riportando entrambi i numeri.

Il delta è atteso positivo (le regole sottostimano sistematicamente: 21.555,65 su Dacroce,
21.145,02 su Crivellaro — notevolmente stabile fra i due casi). Un delta negativo è
legittimo ma anomalo, e viene segnalato.

## 4. Interfaccia

Nuova pagina `src/app/preventivi/conteggi/page.tsx`, autonoma: non legge né scrive
preventivi. Riusa i componenti di `src/app/preventivi/ui/`.

Tre zone in sequenza verticale:

**Caricamento.** Un'area di drop per il PDF. Subito dopo l'estrazione, una riga di
riscontro: numero di voci lette, totale ricomposto, esito della verifica di integrità, e
la tabella del Riepilogo Strutturale così com'è nel computo.

**Passaggi.** Una scheda per voce conteggiata, nell'ordine del master. Ogni scheda mostra
le sorgenti lette — codice tariffa, descrizione della voce nel computo, valore grezzo con
la sua unità — poi la formula in chiaro, poi il risultato. È la richiesta esplicita:
i passaggi devono essere visibili, non solo il numero finale.

Ogni importo è correggibile a mano. Un valore corretto passa a `manuale`, resta
evidenziato, e la riconciliazione si ricalcola.

**Riconciliazione.** Somma delle voci, target, delta, e la tabella master finale
nell'ordine di `Conteggi Master.xlsx` con le pareti già a pareggio.

Sotto, il blocco commerciale (Listino → sconti → PARZIALE) calcolato riusando
`applicaScontiACascata` da `src/domain/calcolo.ts`, con i default del master (2% cliente,
3% conferma). Nessuna logica di sconto viene riscritta: vale il vincolo #1 di `CLAUDE.md`,
gli sconti sono a cascata.

Formato importi italiano come da convenzione: `96 100,00 €`.

## 5. Test

`src/domain/computo/*.test.ts`, sui **due computi reali**, che diventano golden case
accanto a quello già in `CLAUDE.md`.

Le fixture sono le `RigaTesto` estratte dai due PDF e salvate in JSON
(`src/domain/computo/fixtures/`), così i test del dominio restano puri e veloci e non
dipendono da `pdfjs-dist` né da file binari non committati.

**Estrazione** — per entrambi: 166 voci, tariffe attese ai numeri attesi, riepilogo
completo, somma voci = totale computo.

**Regole** — valori attesi, arrotondati al centesimo `ROUND_HALF_UP`:

| Voce | Dacroce rev.03 | Crivellaro rev.04 |
|---|---:|---:|
| Trave alla base | 10.104,24 | 5.843,70 |
| Solaio | 15.240,96 | `compresa` |
| Copertura falda | 54.474,19 | 58.849,06 |
| Cappotto | 21.624,51 | 21.253,32 |
| Cartongesso | 18.975,90 | 15.506,77 |
| Assistenza cartongessisti | 2.655,50 | 2.162,30 |
| Infissi | 31.230,00 | 19.250,00 |
| Monoblocchi | 14.495,00 | 9.450,00 |
| Consulenza esecutiva | 4.000,00 | 4.000,00 |

Quantità intermedie da verificare esplicitamente, perché è lì che si annidano gli errori
di indicizzazione:

| Quantità | Dacroce | Crivellaro |
|---|---:|---:|
| mq copertura a falda (riga `/FALDA/`) | 184,18 | 186,35 |
| mq copertura piana | 0,00 | 0,00 |
| mq cappotto (`204.03.08`) | 195,16 | 191,58 |
| mq cartongesso (`107.04.01`) | 531,10 | 432,46 |
| mq infissi gruppo 1 | 43,66 | 28,30 |
| pezzi infissi gruppo 2 | 14 | 11 |
| pezzi portoncini (`109.04.07`) | 2 | 1 |

Il caso Crivellaro copre esplicitamente la tariffa ripetuta: `104.02.000` compare due
volte e la regola deve prendere 186,35 (falda), non 229,19 (falda + sporto).

**Riconciliazione**:

| | Dacroce | Crivellaro |
|---|---:|---:|
| Somma voci | 278.787,93 | 215.815,97 |
| Target (TOT − 23.300) | 300.343,58 | 236.960,99 |
| Delta su pareti | 21.555,65 | 21.145,02 |
| Pareti a pareggio | 127.543,28 | 100.645,84 |

**Casi limite**: tariffa presente più volte nello stesso computo (copertura Crivellaro —
`voceUnica` deve scegliere la falda, e sollevare se le corrispondenze sono zero o più di
una), computo senza copertura piana (entrambi), categoria a zero che diventa `compresa`
(solaio Crivellaro), voce il cui importo cade su mezzo centesimo (cappotto, entrambi),
tariffa attesa mancante, numero d'ordine che non corrisponde alla tariffa, somma voci
diversa dal totale del riepilogo.

## 6. Le offerte emesse non sono un riscontro

Le regole erano state confrontate con le offerte `mod.05-COM` realmente emesse (Dacroce
rev.02, Crivellaro rev.04) e su tre voci i numeri non tornavano: copertura, cappotto e
monoblocchi. Da quel confronto erano state derivate tre correzioni.

**FBE ha poi comunicato che quelle discrepanze sono errori di calcolo manuale commessi
nella redazione delle offerte.** Le tre correzioni sono state quindi annullate e le regole
originali ripristinate — è quanto documenta la tabella al §2.

Cosa cambia in pratica:

| Voce | Correzione annullata | Regola ripristinata |
|---|---|---|
| Copertura a falda | somma di tutte le occorrenze `104.02.000` (229,19 mq su Crivellaro) | la sola riga `/FALDA/`, il «codice 59» (186,35 mq) |
| Cappotto | pannelli `204.03.01` | posa `204.03.08`, il «codice 116» |
| Monoblocchi | voce `provenienza: 'manuale'` | voce `calcolato`, come tutte le altre |

**Conseguenza sui test.** Gli importi delle offerte non possono più figurare come valori
attesi: contengono errori. I golden case restano i **due computi**, con i valori che le
regole producono — verificabili in modo deterministico e riportati al §5. Il caso
Crivellaro conserva il valore che aveva già: è l'unico dei due in cui offerta e computo
condividono la revisione, e resta il riferimento per la struttura del documento.

Resta valido, e indipendente dalle offerte, tutto ciò che discende dalla lettura del
computo: l'indirizzamento per tariffa anziché per numero di voce (§"Le voci si
indirizzano per tariffa"), il fatto che una tariffa possa ripetersi (§"Una tariffa può
comparire più volte"), la riformulazione della trave alla base come blocco di tariffe
anziché come subtotale di pagina (§"Il totale a pagina 2"), e la convenzione di
arrotondamento (§2). Nessuno di questi punti dipendeva dagli importi in offerta: il primo
e il secondo vengono dalla struttura dei computi, il terzo dal fatto che i due computi
impaginano lo stesso blocco in modo diverso, il quarto dall'aritmetica.

### Il moltiplicatore dell'alzante scorrevole

Un dettaglio emerso durante quel confronto va comunque registrato, perché riguarda la
lettura del computo e non gli importi d'offerta: la voce `109.04.13` non conta i pezzi
uno a uno ma applica un fattore alla quantità dell'alzante scorrevole — 1,70 su Dacroce,
1,25 su Crivellaro — per pesare i serramenti larghi con più di un monoblocco. È il motivo
per cui la sua quantità non è intera (12,10 su Dacroce). La regola somma i **totali in
euro**, quindi il fattore è già dentro il prezzo e non va ricalcolato: va solo saputo, per
non allarmarsi davanti a una quantità frazionaria in una voce dichiarata `cadauno`.

### Solaio

L'unica voce di cui non esiste alcun secondo riscontro: Dacroce ha solaio, Crivellaro no.
La regola (`M:001.002`) è banale e viene direttamente dal riepilogo, ma se emergerà un
terzo computo con solaio vale la pena ricontrollarla.

## Fuori perimetro

- Scrittura su preventivi o revisioni. La pagina è autonoma; il collegamento al wizard è
  un passo successivo, che dovrà affrontare la mappatura sul catalogo esistente e il
  congelamento del listino (vincolo #6).
- Computi non prodotti da Primus, o con struttura diversa dal template FBE.
- Costi sicurezza, optional ed esclusioni del master: valori fissi o testuali, non
  conteggiati da qui.
- La leva `Arrotondamento` e la risoluzione inversa del totale, già in
  `src/domain/calcolo.ts`.
