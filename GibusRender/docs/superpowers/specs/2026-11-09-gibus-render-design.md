# GibusRender: design

Data: 2026-11-09
Stato: bozza da approvare

## Perché

Crocco SRL vende pergole e tende Gibus a clienti di fascia alta. Dopo il sopralluogo il cliente riceve un preventivo con le viste tecniche generate dal configuratore Gibus (vista 3D, frontale, pianta). Quei disegni sono precisi ma non fanno vedere al cliente il risultato a casa sua. Il configuratore Gibus offre anche un'ambientazione, ma il risultato è artefatto e con un cliente che spende molto un'immagine finta fa più danno che non mostrare niente.

GibusRender genera con l'IA un'immagine fotorealistica della pergola o tenda Gibus del progetto, inserita nella foto scattata al sopralluogo (cortile, giardino, terrazza, pompeiana esistente…). L'immagine viene allegata al preventivo.

## Chi la usa e quando

Chi prepara il preventivo (es. Patrizia Crocco), in ufficio, dopo il sopralluogo e senza fretta. Il cliente non usa l'app: riceve solo l'immagine scelta. Generare alcune varianti e sceglierne una va benissimo.

## Obiettivi

1. Immagine fotorealistica, credibile come una foto vera del luogo a lavori finiti: luce, ombre e prospettiva coerenti con lo scatto.
2. Il prodotto è quello del progetto: modello, tipologia (addossata o autoportante, telo o lamelle), colore struttura, tessuto.
3. Dimensioni coerenti con il progetto (larghezza, profondità, altezza).
4. La casa e il contesto del cliente restano identici alla foto.
5. Fornitore e modello di IA si scelgono da impostazione e si cambiano in qualsiasi momento, senza toccare il codice.

## Anti-obiettivi (cioè fallimento anche se "funziona")

Indicati dall'utente come inaccettabili:

- **modifiche estetiche al prodotto**: profili, forme, montanti, lamelle o dettagli diversi dal modello Gibus del catalogo;
- **dimensioni non coerenti con il progetto**: pergola visibilmente più grande, più piccola o con proporzioni diverse;
- **casa del cliente modificata**: finestre spostate, materiali cambiati, oggetti aggiunti o tolti fuori dall'area della pergola.

## Non-obiettivi

- Non è un configuratore né un generatore di preventivi: non calcola prezzi e non produce il PDF dell'offerta.
- Non legge il PDF dell'offerta a ogni utilizzo: le informazioni di prodotto stanno in un catalogo interno.
- Nessun accesso per il cliente finale.
- Nessuna integrazione con GeneratorePreventivi, FbePreventivatore o altri progetti esistenti (vedi Vincoli).

## Vincoli

- **Progetto indipendente**: cartella `GibusRender/` alla radice del repository, con dipendenze, configurazione e dati propri. Nessun codice condiviso con gli altri progetti del repository.
- **IA intercambiabile**: l'utente ha account OpenAI, OpenRouter e altri. Il fornitore va scelto da impostazione e deve poter cambiare a seconda del bisogno. Le chiavi API stanno nella configurazione (variabili d'ambiente), mai nel codice né nel repository.
- Interfaccia in italiano.

## Come funziona

### 1. Catalogo prodotti (dentro l'app)

Un catalogo gestito dall'app, modificabile dall'interfaccia (aggiungi, modifica, elimina), senza toccare il codice.

**Prodotto**
- nome commerciale (es. "ZENIT – Addossata frontale")
- tipologia: addossata / autoportante; copertura a telo / lamelle orientabili / lamelle a impacchettamento
- descrizione tecnica per l'IA: testo che descrive con precisione l'aspetto del prodotto (sezione dei profili, numero e posizione dei montanti, trave frontale, orientamento delle lamelle, cassonetto, ecc.)
- misure tipo: larghezza, profondità, altezza sotto trave, altezza totale (mm)
- immagini di riferimento: una o più (vista 3D, frontale, pianta, eventuali foto reali)
- finiture compatibili (colori, tessuti) e finiture predefinite

**Finiture**
- colori struttura: nome e codice (es. "Antracite RAL 7016 sablé"), con un campione colore per l'anteprima
- tessuti: nome e codice (es. "Opatex Pro/Opatex Decò OP 272")

**Catalogo iniziale**, ricavato dai PDF di esempio in `Crocco/esempi/` (da copiare nel progetto come materiale sorgente):

| # | Origine | Prodotto | Misure (L × P, altezze) | Finiture note |
|---|---------|----------|-------------------------|---------------|
| 1 | `bonetto.pdf` | ZENIT addossata frontale, copertura a telo | 4200 × 3800, h 2400 / 2746 | struttura antracite RAL 7016 sablé; profili telo antracite RAL 7016 LL sablé; tessuto Opatex OP 272 |
| 2 | `mariasole.pdf` (progetto "Sabrina") | "Lamella Compact" (nome inventato): pergola autoportante a lamelle orientabili, 4 montanti | 3000 × 3080, h 2400 / 2550 | antracite |
| 3 | `sabrina.pdf` (progetto "Tiziana Padovan") | "Bioclima Orient" (nome inventato): pergola bioclimatica autoportante a lamelle orientabili | 4000 × 5000, h 2400 / 2650 | antracite |
| 4 | `sabrina.pdf` | "Bioclima Pack" (nome inventato): pergola bioclimatica autoportante a lamelle a impacchettamento | 4000 × 4900, h 2400 / 2650 | antracite |

Le immagini di riferimento di ogni prodotto si ricavano dalle pagine "Vista 3D", "Vista frontale" e "Vista in pianta" dei PDF, ritagliate senza intestazione e logo. Nel caso di `sabrina.pdf`, che mostra due prodotti nella stessa pagina, ogni metà va attribuita al prodotto giusto.

I PDF 2 e 3 non riportano il nome commerciale del modello. Su indicazione dell'utente, per ora i nomi sono inventati e verranno sostituiti dall'interfaccia con quelli reali. Le descrizioni tecniche per l'IA le scrive chi costruisce, partendo dai disegni; l'utente può correggerle dal catalogo. Più avanti si potranno aggiungere foto reali dei prodotti come riferimenti: il catalogo deve permetterlo.

### 2. Nuovo render

Un percorso guidato in una sola pagina:

1. **Foto**: carica la foto del sopralluogo (JPG/PNG/HEIC da smartphone; l'app la normalizza e ne rispetta l'orientamento).
2. **Prodotto**: sceglilo dal catalogo. Misure e finiture predefinite si compilano da sole.
3. **Misure**: modificabili per questo render (larghezza, profondità, altezza). Il catalogo non cambia (scelta del redattore: le misure tipo del catalogo fanno da punto di partenza, quelle del cliente si inseriscono per render).
4. **Finiture**: colore struttura e tessuto, scelti tra quelli del catalogo.
5. **Posizionamento**, in uno o in entrambi i modi:
   - **sagoma disegnata** sulla foto: un poligono che delimita l'ingombro visibile della pergola (montanti e copertura), con punti trascinabili e modificabili;
   - **indicazione a parole**, es. "addossata alla parete a destra, sopra il patio, lamelle aperte".
6. **Riferimento di scala (facoltativo)**: una linea tracciata su un elemento di cui si conosce la misura reale (es. una porta da 2100 mm), con la lunghezza in mm. Serve all'IA per rispettare le dimensioni.
7. **Genera**: l'app produce N varianti (predefinito 3, modificabile).
8. **Scegli e scarica**: confronto delle varianti con la foto originale (affiancate o con cursore prima/dopo), scaricamento in alta risoluzione della variante scelta.

### 3. Come si costruisce la richiesta all'IA

Per ogni render l'app invia al modello di immagini:

- la foto originale;
- la maschera ricavata dalla sagoma, se presente, leggermente allargata per includere ombre e punti di contatto con il terreno o la parete;
- le immagini di riferimento del prodotto;
- un testo costruito dall'app con descrizione tecnica del prodotto, misure, finiture, indicazione di posizione, riferimento di scala e istruzioni esplicite: "non modificare nulla fuori dall'area indicata; riproduci il prodotto esattamente come nei riferimenti; fotorealismo coerente con luce e prospettiva della foto".

Il testo è costruito dall'app ma visibile e modificabile prima di generare, per chi vuole ritoccarlo.

**Strategia per la fedeltà del prodotto (decisa dall'utente)**: si punta su varianti generate dall'IA, tra cui l'utente sceglie la migliore e scarta le altre. Non si costruisce un modello 3D del prodotto. Prima di fissare i modelli predefiniti si fa un confronto tra fornitori e modelli sulle foto di prova (vedi "Foto di prova").

### 4. Protezione della casa del cliente

Quando c'è una sagoma, l'immagine finale viene **ricomposta dall'app**: fuori dall'area della maschera (allargata) restano i pixel originali della foto, con una sfumatura sul bordo per evitare stacchi visibili. Dentro restano quelli generati. Così l'IA non può alterare la casa, qualunque cosa faccia il modello. Se il modello restituisce un'immagine di dimensioni o proporzioni diverse, la si riporta alla risoluzione originale prima della ricomposizione.

Con il solo posizionamento a parole questa garanzia non c'è: l'app lo segnala in modo visibile su quel render ("casa non protetta: verificare che nulla sia cambiato").

### 5. Fornitori di IA intercambiabili

- Un'interfaccia comune "generatore di immagini" (input: foto, maschera opzionale, immagini di riferimento, testo, numero di varianti; output: immagini) con un adattatore per fornitore.
- Adattatori iniziali: **OpenAI** (modelli immagine con modifica e maschera) e **OpenRouter** (modelli immagine disponibili lì, es. della famiglia Gemini). Aggiungerne altri non deve toccare il resto dell'app.
- Pagina **Impostazioni**: fornitore e modello attivi, con modello scelto da un elenco o scritto a mano. Si può cambiare il modello anche sul singolo render, per confrontare due modelli sulla stessa foto.
- Le chiavi API stanno nelle variabili d'ambiente (`.env.local`, escluso da git). L'app mostra solo quali fornitori risultano configurati.
- Se un modello non supporta la maschera o le immagini di riferimento multiple, l'adattatore lo dichiara e l'app lo mostra. La ricomposizione del paragrafo 4 avviene comunque.

### 6. Archivio

Ogni render salvato con foto originale, sagoma, parametri (prodotto, misure, finiture, testi), fornitore e modello usati, varianti generate e variante scelta. Dall'archivio un render si riapre, si rigenera o si duplica per provare altri parametri. Campo libero "cliente / riferimento progetto" per ritrovarlo.

## Dove gira (deciso dall'utente: online)

L'app è online, raggiungibile dal browser.

Scelte del redattore per realizzarla:
- hosting su Vercel, con un progetto Vercel proprio, distinto da quelli degli altri progetti del repository;
- database Postgres gestito (es. Neon) per catalogo, render e impostazioni;
- archivio file a oggetti (es. Vercel Blob) per foto, maschere e immagini generate;
- accesso protetto da password: utenti fissati nella configurazione e nessuna registrazione pubblica;
- la generazione di un render può durare decine di secondi per variante: ogni variante parte come richiesta separata, l'interfaccia mostra l'avanzamento e i risultati man mano che arrivano, entro i limiti di durata delle funzioni dell'hosting;
- le foto HEIC si convertono nel browser prima del caricamento, per non dipendere da librerie native sul server.

## Foto di prova

Le foto reali di sopralluogo le fornirà l'utente più avanti. Fino ad allora lo sviluppo procede con foto di esterni di prova. Il confronto tra modelli e i criteri di accettazione 2 e 3 si verificano sulle foto dell'utente quando arrivano.

## Privacy (aperto)

Le foto delle case dei clienti vengono inviate ai fornitori di IA scelti. Se serva un consenso del cliente o vada escluso qualche fornitore è ancora da decidere con l'utente. L'app non deve impedire questa decisione: ogni fornitore si abilita o disabilita da Impostazioni.

## Scelte del redattore (da verificare)

- **Stack**: Next.js + TypeScript, come gli altri progetti del repository, ma in un progetto separato e indipendente.
- **Costi**: prima di "Genera" l'app mostra una stima del costo in base a fornitore, modello, qualità e numero di varianti. Nessun tetto di spesa imposto dall'app.
- **Varianti predefinite**: 3 per render.
- **Formato di uscita**: JPG di alta qualità alla risoluzione della foto originale. Opzione per aggiungere in basso la dicitura "Immagine a titolo esemplificativo", come nelle offerte Gibus, disattivata per impostazione predefinita.
- Le due foto Gibus di esempio (`GIBUS_AZIMUT_3.jpg`, `GIBUS_JOY_12.jpg`) mostrano il livello di qualità a cui puntare. Non sono riferimenti di prodotto per i modelli del catalogo iniziale. Se usarle come riferimento di stile (ritagliando il logo) lo decide chi costruisce, in base ai risultati.

## Lasciato a chi costruisce

- Scelta dei modelli specifici iniziali per ogni fornitore, dopo una prova di confronto sulle foto di esempio.
- Libreria per il disegno della sagoma e per la ricomposizione delle immagini.
- Formulazione esatta del testo inviato all'IA, da affinare sui risultati.
- Struttura dati interna, organizzazione del codice, gestione degli errori dei fornitori (timeout, limiti, contenuti rifiutati).

## Criteri di accettazione

Usando le immagini di riferimento del catalogo iniziale e una foto di esterni reale:

1. Con la sagoma, i pixel fuori dalla maschera allargata sono identici all'originale (verificabile automaticamente).
2. Il prodotto generato è riconoscibile come il modello del catalogo: stessa tipologia, stesso numero di montanti, copertura dello stesso tipo, colore corretto.
3. Le proporzioni larghezza/altezza/profondità del prodotto nell'immagine sono plausibilmente coerenti con le misure inserite.
4. Cambiare fornitore o modello da Impostazioni funziona senza modifiche al codice.
5. Il catalogo si modifica dall'interfaccia e le modifiche si riflettono nei nuovi render.
