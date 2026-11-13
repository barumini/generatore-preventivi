# GibusRender: volume 3D di posizionamento — design

Data: 2026-11-13
Stato: bozza da approvare

## Perché

Dalle prove fatte con l'app, il prodotto generato risulta **disallineato** rispetto a finestre e porte della casa e **dimensionato a caso**. La causa è nel modo in cui oggi si indica la posizione: una sagoma piatta disegnata a mano, una linea di scala e un testo libero. Sono tutte indicazioni vaghe: nessuna dice al modello dove stanno i montanti, a che altezza è l'attacco a muro, come corre la prospettiva della facciata. Il modello quindi tira a indovinare.

Serve uno strumento con cui chi prepara il render **disegna sulla foto un volume 3D** (un parallelepipedo in prospettiva, con le misure reali del prodotto) e indica esplicitamente attacco a muro, montanti e altezze. Il volume diventa il riferimento unico per la posizione: lo riceve il modello, da lui si ricava l'area da modificare, e con lui si controlla il risultato.

## Chi lo usa

Come oggi: chi prepara il preventivo, in ufficio, da computer con mouse, senza fretta. Qualche clic in più all'inizio è accettabile se elimina i tentativi a vuoto.

## Obiettivi

1. Disegnare sulla foto un volume in prospettiva corretta, allineato per costruzione alla facciata (porte, finestre, base del muro).
2. Le dimensioni del volume sono legate ai millimetri reali del progetto: cambiando una misura il disegno si aggiorna, e viceversa.
3. Indicare in modo esplicito: linea di attacco a muro e sua altezza, numero e posizione dei montanti, altezza al muro e altezza sul fronte.
4. La prospettiva è regolabile a mano quando il calcolo automatico non convince.
5. Il modello di immagini riceve queste informazioni in forma non ambigua (immagine-guida + testo con posizioni e misure).
6. La sagoma dell'area da modificare si ricava dal volume: non va più disegnata a mano.
7. Dopo la generazione l'app segnala le varianti in cui il prodotto è finito fuori dal volume, e permette di sovrapporre il volume al risultato per controllarlo a occhio.

## Anti-obiettivi

- **Linee della guida che restano nell'immagine finale** (tratti rossi/blu visibili nel render consegnato al cliente).
- Un volume che si può disegnare solo "a occhio", senza legame con le misure: sarebbe la sagoma di oggi con un altro nome.
- Peggiorare la protezione della casa: fuori dall'area ricomposta la foto deve restare identica, come oggi.
- Rompere i render esistenti o il flusso attuale (sagoma a mano, descrizione a parole), che devono continuare a funzionare.

## Non-obiettivi

- Niente modello 3D vero del prodotto e niente motore 3D (three.js o simili): il volume è un ingombro schematico disegnato in SVG.
- Niente riconoscimento automatico delle linee della facciata: le indica l'utente.
- Niente correzione della distorsione dell'obiettivo, niente lettura dei dati EXIF.
- Il volume è sempre parallelo alla facciata di riferimento: niente rotazione libera in pianta.
- Terreno considerato piano e alla quota della base del riquadro di riferimento (corretta dal campo "quota da terra").
- Nessuna modifica al catalogo prodotti.

## Vincoli

- Stack esistente: Next.js 16 (leggere `node_modules/next/dist/docs/` prima di scrivere codice, come da `AGENTS.md`), React 19, Prisma/PostgreSQL, sharp, vitest. Nessuna nuova dipendenza salvo necessità motivata.
- Tutto dentro `GibusRender/`.
- Interfaccia e messaggi in italiano; prompt per il modello in inglese (come oggi).
- La geometria deve essere un modulo puro (niente Prisma, niente sharp), usabile sia dal browser sia dal server, con test unitari.
- Le coordinate sulla foto restano normalizzate 0..1, come per `polygon` e `scaleLine`.

## Come funziona per l'utente

Nella sezione **5 · Posizione** del modulo "Nuovo render" compare una scelta fra due modi: **Volume 3D** (nuovo, predefinito) e **Sagoma o descrizione** (quello di oggi, invariato: sagoma a mano e/o descrizione a parole, con la scala facoltativa). *Aggiornato dopo la revisione finale: una terza modalità "solo descrizione" avrebbe tolto la linea di scala a chi oggi descrive a parole.* Il testo libero di posizione resta sempre disponibile come nota aggiuntiva.

Con "Volume 3D" i passi sono:

### Passo A — Riquadro di facciata

L'utente clicca **quattro angoli di un rettangolo reale che giace sulla facciata**, di cui conosce le misure. Tipicamente: i due punti alla base del muro e i due punti sul filo superiore delle porte, in verticale sopra i primi; oppure gli angoli di una portafinestra. Più il riquadro è grande, più l'allineamento è preciso: l'interfaccia lo dice.

Accanto inserisce:
- **larghezza** e **altezza** reali del riquadro, in mm;
- **quota da terra** del lato basso (predefinito 0: il lato basso è a terra).

I quattro angoli sono maniglie trascinabili. Durante il trascinamento di qualsiasi maniglia compare una **lente d'ingrandimento** per piazzare il punto con precisione.

Da questo riquadro l'app ricava la posizione della macchina fotografica rispetto alla facciata (vedi "Geometria"). Sostituisce la "Scala" di oggi (sezione 6), che in modalità Volume 3D viene nascosta.

### Passo B — Volume

Appena il riquadro è valido compare il volume, con le misure della sezione **3 · Misure**, appoggiato al muro e centrato sul riquadro. L'utente lo sistema con maniglie:

- **scorrimento lungo il muro** (trascinando il volume o la maniglia centrale);
- **estremo sinistro / destro** → cambia la larghezza;
- **bordo anteriore** → cambia la sporgenza (profondità);
- **altezza al muro** e **altezza sul fronte**, separate: se sono diverse la copertura è in pendenza.

Le maniglie e i campi numerici sono la stessa cosa: trascinando cambia il numero, scrivendo il numero si sposta il disegno. Larghezza e profondità sono quelle della sezione Misure (`widthMm`, `depthMm`).

**Altezze (scelta del progettista).** In modalità Volume 3D le altezze del volume comandano, per non dare al modello due serie di misure in contraddizione:
- **altezza al muro** è legata nei due sensi ad "Altezza totale" della sezione Misure (`totalHeightMm`): sono lo stesso valore;
- **altezza sul fronte** è un campo nuovo, salvato nel volume; all'apertura vale l'altezza totale;
- "Altezza utile" (`clearHeightMm`) resta com'è nella sezione Misure, non ha una maniglia e non si disegna; se supera l'altezza sul fronte l'interfaccia avvisa;
- montanti e spigoli del volume arrivano fino alla copertura (altezza sul fronte davanti, altezza al muro dietro), non all'altezza utile.

Per i prodotti **autoportanti** il volume non è attaccato al muro: c'è in più il campo/maniglia **distanza dal muro** e non c'è la linea di attacco.

Colori sul disegno, sempre gli stessi: **rosso** = linea di attacco a muro, **blu** = montanti, **bianco tratteggiato** = spigoli del volume, copertura velata.

### Passo C — Montanti

L'app propone i montanti agli angoli anteriori (per gli autoportanti anche ai posteriori). L'utente può:
- cambiarne il **numero** sul fronte (da 0 a 6) e, per gli autoportanti, sul retro;
- **trascinarli lungo il bordo** (per esempio per non averne uno davanti a una porta); accanto a ciascuno compare la distanza in mm dall'estremo sinistro.

### Passo D — Prospettiva e ritocco

- Cursore **Prospettiva** (da "grandangolo" a "tele"): cambia la focale assunta, cioè quanto il volume "fugge" in profondità. Parte dal valore calcolato; un pulsante lo riporta ad "automatica".
- **Ritocco fine**: attivandolo, ciascuno degli otto angoli del volume si può spostare a mano di poco per correggere piccoli scarti (terreno non piano, foto storta). Lo scostamento si somma alla posizione calcolata; "Azzera ritocchi" lo toglie. Montanti e attacco seguono gli spigoli ritoccati.

### Dopo la generazione

- Nella pagina del render, un interruttore **"Mostra volume"** sovrappone il volume a ogni variante e al confronto prima/dopo.
- Le varianti in cui il prodotto risulta fuori dal volume ricevono il badge **"Fuori posto: confronta con il volume"**.
- "Duplica e modifica" riporta anche il volume.

## Geometria

Modulo puro `src/lib/render/volume.ts` (nome indicativo), con i tipi e le funzioni; nessuna dipendenza.

**Modello di camera.** Foro stenopeico, pixel quadrati, punto principale al centro della foto, una sola incognita interna: la focale `f` (in pixel).

**Sistema di riferimento del mondo (mm).** Origine nell'angolo in basso a sinistra del riquadro di facciata, portata a terra con la quota indicata. X lungo il muro verso destra, Y verso l'alto, Z perpendicolare al muro verso l'esterno (verso chi fotografa).

**Dal riquadro alla posa.** I quattro angoli cliccati e le misure reali danno un'omografia piano-facciata → foto. Dall'omografia:
- se il riquadro è visto abbastanza di scorcio, la focale si ricava dalle condizioni di ortogonalità delle due direzioni del riquadro (i due punti di fuga);
- se è quasi frontale (punti di fuga lontani, stima instabile o fuori da un intervallo plausibile), si usa la focale predefinita: equivalente 26 mm su pieno formato, cioè `f ≈ 0,60 × diagonale della foto in pixel`;
- nota la focale (automatica o del cursore), si scompone l'omografia in rotazione e traslazione, riortonormalizzando la rotazione.

Il cursore Prospettiva agisce sulla focale; in automatico vale la stima sopra. Si salva come rapporto `f / diagonale`, così non dipende dalla risoluzione.

**Dal volume alla foto.** Gli otto vertici in mm si proiettano con la posa. Vertici del volume addossato, con `x0` = scostamento lungo il muro, `W`, `D`, `Hm` (altezza al muro), `Hf` (altezza sul fronte), `d` = distanza dal muro (0 se addossato):
- a terra: `(x0, 0, d)`, `(x0+W, 0, d)`, `(x0+W, 0, d+D)`, `(x0, 0, d+D)`;
- in alto: stessi X e Z, con Y = `Hm` sul lato muro e `Hf` sul fronte.

Montanti: segmenti verticali da terra alla copertura, sul bordo anteriore (e posteriore per gli autoportanti), alla frazione 0..1 della larghezza indicata.

**Trascinamento delle maniglie.** Ogni maniglia è vincolata a una retta del mondo (asse X sul muro, asse Z a terra, verticale): il punto del mouse si proietta sulla retta in foto e si risale al valore in mm. I valori si arrotondano ai 10 mm.

**Validità.** Il riquadro è rifiutato, con messaggio in italiano, se: i punti non formano un quadrilatero convesso, è troppo piccolo (lato minore sotto il 5% del lato corto della foto), o la posa risultante mette la facciata dietro la camera. Il volume è rifiutato se qualche vertice cade dietro la camera. Vertici fuori dall'inquadratura sono ammessi (il volume può uscire dalla foto) ma l'interfaccia avvisa che il prodotto risulterà tagliato.

## Dati

Nuova colonna `volume Json?` su `Render` (migrazione Prisma), `null` per i render senza volume. Forma indicativa:

```ts
type Volume = {
  ref: { corners: [Point, Point, Point, Point]; widthMm: number; heightMm: number; baseMm: number };
  /** null = focale automatica; altrimenti rapporto f / diagonale scelto col cursore. */
  focalRatio: number | null;
  box: { offsetXMm: number; distanceMm: number; wallHeightMm: number; frontHeightMm: number };
  /** Frazioni 0..1 lungo la larghezza. */
  frontPosts: number[];
  rearPosts: number[];
  /** Ritocchi fini: scostamento in coordinate 0..1 per ciascuno degli 8 vertici, o null. */
  nudges: Point[] | null;
};
```

Larghezza e profondità restano nelle colonne esistenti. Validazione con zod lato server, come per `polygon` e `scaleLine`; un volume non valido dà errore 400 con messaggio italiano.

Quando c'è il volume, il server calcola anche la **sagoma derivata** (involucro convesso degli otto vertici proiettati, ritocchi inclusi, più le linee dei montanti) e la salva nella colonna `polygon` esistente: così maschera, ricomposizione adattiva, controllo di scena alterata e protezione della casa funzionano senza modifiche. Volume e sagoma a mano non si inviano insieme: se arrivano entrambi vince il volume.

Nuova colonna su `Variant` per l'esito del controllo di posizione (vedi sotto), `null` senza volume.

## Come lo usa l'IA

Scelte del progettista, non dell'utente; da verificare con generazioni reali.

1. **Immagine-guida.** Il server disegna il volume sulla foto (stessi colori dell'interfaccia, tratti spessi, senza maniglie né etichette) e la passa al fornitore come immagine separata, subito dopo la foto e prima delle immagini di riferimento del prodotto. La foto principale resta pulita: così il modello non ha tratti da "cancellare" e l'anti-obiettivo delle linee residue è meno probabile. `GenerateInput` riceve un campo `guide?: Buffer`. Per i fornitori che oggi ricevono la maschera solo come immagine indicativa, **la guida sostituisce la maschera in bianco e nero**; per quelli che applicano davvero la maschera (`supportsMask`), la maschera resta e la guida si aggiunge. Va rispettato il tetto di immagini di ciascun modello: se serve si toglie l'ultima immagine di riferimento, non la guida. **Eccezione (scelta del progettista):** i modelli che ridisegnano ogni immagine ricevuta e a cui oggi non si manda la maschera (FLUX Kontext, regola `takesMaskImage` in `providers/fal.ts`) non ricevono nemmeno la guida; per loro il prompt usa una variante solo testuale della sezione di posizione (percentuali e misure, senza la spiegazione dei colori). La sezione va quindi costruita in due parti separabili.

2. **Prompt.** Una nuova sezione sostituisce `PLACEMENT_HINT` e la sezione "Reference for scale" quando c'è il volume. Contiene:
   - la spiegazione della guida: linea rossa = trave di attacco a muro, linee blu = montanti (numero e posizione esatti), tratteggio bianco = ingombro massimo di struttura e copertura; "the guide lines are annotations: never draw them in the result";
   - le posizioni in percentuale di larghezza/altezza della foto: estremi dell'attacco a muro, piede e testa di ogni montante;
   - le misure: larghezza, sporgenza, altezza al muro, altezza sul fronte, numero di montanti;
   - per gli autoportanti, la distanza dal muro e l'assenza di attacco.
   Con il volume cambia anche la sezione "Real dimensions": riporta altezza al muro e altezza sul fronte al posto della sola altezza totale (l'altezza utile resta), e le proporzioni usano queste misure.
   L'anteprima del prompt nel modulo si aggiorna come oggi.

3. **Controllo di posizione.** Dopo la generazione si confronta la zona che il modello ha cambiato (la differenza con la foto, già calcolata per la crescita adattiva) con la sagoma del volume. Si misura quanto il riquadro d'ingombro della zona cambiata si discosta da quello del volume, in rapporto alle dimensioni del volume, e si salva il valore sulla variante. Oltre soglia compare il badge "Fuori posto". Le soglie iniziali le sceglie chi implementa e vanno tarate su generazioni reali, come è stato fatto per `driftScore`; vanno documentate nel README con la data della taratura.

La crescita adattiva dell'area di ricomposizione (`grow.ts`) resta com'è.

## Cosa resta a chi implementa

- Nomi di file, componenti e funzioni; suddivisione del modulo (oggi `NewRenderForm.tsx` ha già 778 righe: l'editor del volume va in componenti propri).
- Dettagli dell'algoritmo (stima della focale, soglie di "quasi frontale", intervallo del cursore).
- Aspetto di maniglie, lente e pannello dei campi, coerente con `PolygonEditor` e `ScaleLineEditor` (di cui si riusano gli helper di trascinamento).
- Forma esatta della metrica "fuori posto" e soglie iniziali.
- Testo esatto del prompt.

## Verifica

- **Geometria (test unitari):** con una camera sintetica nota si proietta un rettangolo, si ricava la posa dai quattro punti e si verifica che la riproiezione di punti noti cada entro 1 px; casi frontale, di scorcio, con rollio; riquadri non validi; andata e ritorno maniglia → mm → maniglia.
- **Server:** validazione del volume, sagoma derivata, prompt con volume, guida passata ai fornitori nel giusto ordine e rispettando i tetti, render senza volume invariati.
- **Interfaccia (a mano, nel browser):** sulla foto di prova `.data/test-photos/casa-reale-originale.jpg`, riquadro sulle due portefinestre, volume allineato al filo delle porte, montanti spostati, cursore prospettiva, ritocco fine, duplica.
- **Generazione reale:** almeno un render con il modello predefinito con e senza volume sulla stessa foto, per confrontare allineamento e dimensione e controllare che non restino linee della guida. Costa crediti del fornitore: si fa con il consenso dell'utente.

## Rischi aperti

- **Il modello può ignorare o ridisegnare la guida.** Se le linee restano nell'immagine o il prodotto non segue il volume, l'alternativa da provare è disegnare la guida direttamente sulla foto principale, o cambiare stile della guida (volume pieno semitrasparente invece del filo). Si decide dopo le prime generazioni reali.
- **Foto quasi frontali:** la focale non si ricava dal riquadro e si usa quella predefinita; il cursore Prospettiva serve proprio a questo caso.
- **Riquadro piccolo** (una sola porta): piccoli errori di clic diventano grandi scarti lontano dal riquadro. L'interfaccia consiglia un riquadro largo; la lente aiuta.
