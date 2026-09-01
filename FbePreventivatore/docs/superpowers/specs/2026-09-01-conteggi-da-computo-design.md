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

Non è un caso limite teorico: nel computo Crivellaro la tariffa `104.02.000` compare due
volte, come `COPERTURA A FALDA` (186,35) e come `COPERTURA SPORTO - TETTOIE - PORTICO P1`
(42,84). La somma, 229,19, è la superficie che tutte le voci a valle della copertura
usano come quantità.

Le funzioni di accesso restituiscono quindi **somme su tutte le occorrenze** di una
tariffa, mai una singola voce:

```ts
sommaQuantita(computo, ...tariffe: string[]): number
sommaTotali(computo, ...tariffe: string[]): number
```

Un indice `tariffa → VoceComputo` che tiene una voce sola perde silenziosamente le altre.
Nel computo Dacroce, dove `104.02.000` compare una volta, l'errore sarebbe invisibile: il
riscontro sulle offerte reali (§6) lo ha rivelato solo grazie al caso Crivellaro.

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
| `copertura-falda` | Copertura a falda | ((Σmq `104.02.011` + Σmq `104.02.000`) × 220 + `M:001.003`) / 2 |
| `copertura-piana` | Tetto piano | sempre `compresa` — l'importo sta su `copertura-falda` |
| `veletta-perimetrale` | Veletta perimetrale | nessuna regola FBE: `compresa` |
| `cappotto` | Cappotto esterno | (mq `204.03.01` × 90 + `M:001.004`) / 2 |
| `cartongesso` | Cartongesso interno | (mq `107.04.01` × 22 + mq `107.04.01` × 5 + `M:001.005`) / 2 |
| `assistenza-cartongessisti` | Assistenza ai cartongessisti | mq `107.04.01` × 5 |
| `infissi` | Infissi esterni in PVC | Σmq (`109.04.02`,`.03`,`.04`,`.05`,`.06`) × 500 + Σnr (`109.04.07`…`.11`) × 100 + nr `109.04.07` × 4000 |
| `monoblocchi` | Monoblocchi Hella | Σ totali `109.04.12` + `109.04.13` + `109.04.14` — proposta di partenza, nasce `manuale` (v. nota sotto) |
| `consulenza-esecutiva` | Consulenza progettazione esecutiva | 4.000,00 fisso |
| `tracciamento-impianti` | Tracciamento impianto idrosanitario | `compresa`, non modificabile |
| `pareti-telaio` | Pareti non strutturali a telaio | `compresa`, non modificabile |

Note sulle regole, dove il testo FBE era ambiguo e la lettura è stata fissata:

- **Cartongesso.** Il `× 5` è la stessa quantità della voce `assistenza-cartongessisti`,
  che viene comunque fatturata a parte. Decisione confermata: entra lo stesso nella media,
  quindi l'assistenza pesa per metà anche dentro la voce cartongesso. Su Dacroce
  (11.684,20 + 2.655,50 + 23.612,10) / 2 = 18.975,90.
- **Cappotto.** L'istruzione parla di «mq riportati al codice `001.004`», ma `M:001.004` è
  un importo in euro, non una superficie. La media è fra due valori in euro.
- **Cappotto, quale superficie.** L'istruzione indicava la posa (`204.03.08`), che copre
  una superficie più ampia perché include lo zoccolo perimetrale. L'ancora corretta è
  `204.03.01`, i pannelli GUTEX in fibra di legno, che è ciò che la voce dell'offerta
  descrive («sp. mm 60+40»). Sul riscontro Crivellaro la differenza è fra un risultato
  esatto e uno sbagliato di 1.000 € (§6).
- **Infissi, secondo gruppo.** Le tariffe `109.04.07`…`.11` sono voci di montaggio in
  `cadauno`, non in mq: si sommano i pezzi (14 su Dacroce) e si moltiplicano per 100.
- **Infissi, primo gruppo.** `109.04.02` (portabalcone) è dichiarata `cadauno` nel computo
  ma la quantità è una superficie (2,10 = 1,00 × 2,100). Si somma come mq, coerentemente
  con le altre quattro tariffe del gruppo.
- **Portoncini.** Il conteggio è la quantità di `109.04.07`, non il suo importo.
- **Monoblocchi.** Si sommano i **totali in euro** delle tre tariffe, non le quantità.
  È l'unica regola che il riscontro sulle offerte reali non conferma: il totale-tariffa
  include un moltiplicatore tecnico Primus per i serramenti scorrevoli larghi che non ha
  riscontro in offerta, e la causa profonda non è deducibile dal computo (§6, "Scarti
  aperti"). La voce nasce `provenienza: 'manuale'`.
- **Copertura, quali quantità.** Vanno sommate **tutte** le occorrenze di `104.02.000`,
  non solo la voce `COPERTURA A FALDA`: in Crivellaro la stessa tariffa porta anche
  sporto, tettoie e portico.

### Righe a zero

Una voce il cui calcolo dà `0` viene **rimossa** dal preventivo, e le voci successive si
rinumerano. È il comportamento documentato dall'offerta Crivellaro rev.04, dove il solaio
(`M:001.002` = 0,00) non compare affatto e la numerazione prosegue `1.c` → `2` (copertura)
→ `3` (cappotto) → `4` (cartongesso), senza buchi.

Coerente col vincolo #4 di `CLAUDE.md`: i numeri di voce sono calcolati al render sulle
voci incluse.

Restano invece sempre presenti con la dicitura `compresa` le voci che sono comprese per
scelta commerciale e non per assenza: tracciamento impianti, pareti a telaio, e la
copertura piana quando l'importo è stato spostato sulla riga a falda. `compresa` non è un
numero e non entra nelle somme — vincolo #5.

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

Il delta è atteso positivo (le regole sottostimano sistematicamente: 22.464,65 su Dacroce,
17.395,62 su Crivellaro). Un delta negativo è legittimo ma anomalo, e viene segnalato.

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

**Regole** — valori attesi:

| Voce | Dacroce | Crivellaro |
|---|---:|---:|
| Trave alla base | 10.104,24 | 5.843,70 |
| Solaio | 15.240,96 | *rimossa* |
| Copertura falda | 54.474,19 | 63.561,46 |
| Cappotto | 20.715,51 | 20.290,32 |
| Cartongesso | 18.975,90 | 15.506,77 |
| Assistenza cartongessisti | 2.655,50 | 2.162,30 |
| Infissi | 31.230,00 | 19.250,00 |
| Monoblocchi | 14.495,00 | 9.450,00 |
| Consulenza esecutiva | 4.000,00 | 4.000,00 |

Quantità intermedie da verificare esplicitamente, perché è lì che si annidano gli errori
di indicizzazione: copertura 184,18 / 229,19 mq; cappotto 174,96 / 170,18 mq; cartongesso
531,10 / 432,46 mq.

**Riconciliazione**:

| | Dacroce | Crivellaro |
|---|---:|---:|
| Somma voci | 277.878,93 | 219.565,37 |
| Target (TOT − 23.300) | 300.343,58 | 236.960,99 |
| Delta su pareti | 22.464,65 | 17.395,62 |
| Pareti a pareggio | 128.452,28 | 96.896,44 |

**Casi limite**: tariffa presente più volte nello stesso computo (copertura Crivellaro),
computo senza copertura piana (entrambi), categoria a zero con rinumerazione (solaio
Crivellaro), tariffa attesa mancante, numero d'ordine che non corrisponde alla tariffa,
somma voci diversa dal totale.

## 6. Riscontro sulle offerte reali

Le regole sono state verificate contro le offerte `mod.05-COM` effettivamente emesse. Gli
importi in offerta sono arrotondati al centinaio, quindi il confronto è fra il calcolo
arrotondato al centinaio e la riga di offerta.

**Crivellaro** è il riscontro probante: offerta rev.04 contro computo rev.04, stessa
revisione.

| Voce | Calcolato | → 100 | Offerta | Δ |
|---|---:|---:|---:|---:|
| Trave alla base | 5.843,70 | 5.800 | 5.800 | **0** |
| Copertura | 63.561,46 | 63.600 | 63.600 | **0** |
| Cappotto | 20.290,32 | 20.300 | 20.300 | **0** |
| Cartongesso | 15.506,77 | 15.500 | 15.500 | **0** |
| Assistenza cartongessisti | 2.162,30 | 2.200 | 2.200 | **0** |
| Consulenza esecutiva | 4.000,00 | 4.000 | 4.000 | **0** |
| Infissi | 19.250,00 | 19.200 | 19.300 | −100 |
| Monoblocchi | 9.450,00 | 9.400 | 10.200 | −800 |
| **Listino** | **236.960,99** | | **237.000** | **−39,01** |

Gli infissi cadono esattamente a metà fra due centinaia: è il verso dell'arrotondamento,
non un errore di regola.

I monoblocchi sono l'unico scarto reale, e si propaga: sostituendo i 10.200 dell'offerta,
le pareti a pareggio uscirebbero a 96.146,44 → 96.100, che è esattamente la riga di
offerta. Con quella sola sostituzione **tutte** le voci Crivellaro tornano.

**Dacroce** è un riscontro parziale: l'offerta disponibile è rev.02, il computo è rev.03.
Copertura esatta, quattro voci a un solo scatto di arrotondamento, Listino a −456,42
(0,15%). Le tre voci che divergono davvero — trave −4.400, solaio −1.700, monoblocchi
+1.300 — non sono confrontabili fra revisioni diverse. In particolare l'offerta rev.02
includeva nella trave anche la posa cordolo `104.01.024` (10.104,24 + 4.401,36 =
14.505,60 → 14.500), mentre Crivellaro conferma la regola senza posa.

### Scarti aperti

- **Monoblocchi — causa individuata, regola non recuperabile dal computo.** I totali
  delle tariffe `109.04.12/13/14` sbagliano in direzioni opposte nei due casi (+9,8% su
  Dacroce, −7,4% su Crivellaro). La causa: la voce `109.04.13` applica un **moltiplicatore
  tecnico interno** alla quantità dell'alzante scorrevole (`109.04.11`) — 1,70 su Dacroce,
  1,25 su Crivellaro — che pesa i serramenti scorrevoli larghi con più di un monoblocco.
  Primus lo applica in automatico; l'offerta commerciale non lo riflette in alcuna riga
  leggibile dal riepilogo.

  L'abaco dei monoblocchi (elenco per dimensione, presente in entrambe le offerte) fissa
  il roster reale. Attenzione al confronto fra revisioni: l'abaco Dacroce appartiene alla
  rev.02 dell'offerta, che ha 13 serramenti (2 portoncini, 1 portabalcone, 4
  portefinestre, 4 finestre, 2 alzanti), non i 14 del computo rev.03. Letto contro il suo
  roster, l'abaco è coerente fra i due progetti: **i portoncini blindati ricevono sempre
  un monoblocco** (Dacroce: 12 pezzi = 13 serramenti − 1 finestrella 100×110; Crivellaro:
  11 = 10 serramenti PVC + 1 portoncino). Una prima lettura che li dava «a scelta di
  cantiere» nasceva dal confronto improprio tra abaco rev.02 e conteggi rev.03.

  Sui prezzi, la sistematica dei modelli alternativi mostra la sottodeterminazione:

  | Modello (su roster omogenei) | Dacroce r.02 (off. 13.200) | Crivellaro r.04 (off. 10.200) |
  |---|---:|---:|
  | Σ totali tariffe computo | +9,8% | −7,4% |
  | 900 finestra / 950 porta-tipo, a pezzo | −8,0% | **esatto** |
  | 1.100 flat a pezzo d'abaco | **esatto** | +18,6% |
  | perimetro telaio × ~144 €/m | −0,6% | +0,7% |
  | perimetro × 125 + 150/pezzo | **esatto** | +3,7% |
  | area telaio × 300 €/mq | +6,6% | −10,1% |

  Tre modelli diversi colpiscono esattamente un progetto e sbagliano l'altro: con due
  sole offerte e questa libertà di scelta, un fit esatto singolo non prova nulla. L'unico
  con residui piccoli e coerenti su entrambi è il **perimetro del telaio** (€/m impliciti
  144,74 e 142,86, scarto 1,3%) — fisicamente sensato, ma senza una costante condivisa
  pulita, e le dimensioni dei monoblocchi stanno nell'abaco dell'offerta (cioè nel
  preventivo del fornitore Hella), non nel riepilogo del computo. Nessuna dimensione è
  condivisa fra i due progetti, quindi nemmeno un listino per-dimensione è verificabile
  in croce. La spiegazione più plausibile: la riga d'offerta trascrive la **quotazione
  Hella di progetto** (pezzi su misura), non una formula sul computo.

  **Conclusione per l'implementazione:** questa è l'unica voce del master su dieci dove i
  dati del computo non determinano il numero commerciale. La regola resta quella
  dichiarata (Σ totali `109.04.12/13/14`) come proposta di partenza, ma la voce nasce con
  `provenienza: 'manuale'` invece che `'calcolato'` — l'unica eccezione alla tabella delle
  regole — e l'interfaccia lo segnala esplicitamente come valore da rivedere, non da
  fidarsi.
- **Solaio Dacroce.** L'offerta riporta 16.900 contro i 15.240,96 di `M:001.002`
  (+1.659,04). Non verificabile: Crivellaro non ha solaio. Se emergerà un terzo computo
  con solaio, va ricontrollato prima di considerare la regola stabile.

## Fuori perimetro

- Scrittura su preventivi o revisioni. La pagina è autonoma; il collegamento al wizard è
  un passo successivo, che dovrà affrontare la mappatura sul catalogo esistente e il
  congelamento del listino (vincolo #6).
- Computi non prodotti da Primus, o con struttura diversa dal template FBE.
- Costi sicurezza, optional ed esclusioni del master: valori fissi o testuali, non
  conteggiati da qui.
- La leva `Arrotondamento` e la risoluzione inversa del totale, già in
  `src/domain/calcolo.ts`.
