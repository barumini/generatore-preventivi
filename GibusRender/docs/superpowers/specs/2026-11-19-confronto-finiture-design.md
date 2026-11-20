# GibusRender: variante consigliata e confronto delle finiture — design

Data: 2026-11-19
Stato: bozza da approvare

Due migliorie indipendenti, da costruire in quest'ordine: la prima è piccola e la seconda la riusa.

## Perché

Chi prepara il preventivo (Patrizia Crocco, in ufficio, da computer) genera più varianti per ogni render e sceglie quella da allegare all'offerta. Oggi:

1. **Scegliere la variante richiede di confrontarle tutte a occhio**, anche se l'app ha già misurato per ognuna se la scena è alterata (`driftScore`), se il prodotto è fuori dal volume (`placementOffset`) e se la pergola sembra tagliata (`truncated`).
2. **Provare più finiture sulla stessa foto è scomodo**: ogni render ha un solo colore e un solo tessuto, quindi per vedere 3–4 finiture bisogna fare "Duplica e modifica" 3–4 volte e passare da una pagina all'altra.

Il confronto delle finiture serve **a Patrizia per scegliere in ufficio** (decisione dell'utente): al cliente arriva comunque una sola immagine, come oggi. Non serve quindi una tavola o un'immagine composta da inviare.

## Obiettivi

1. In ogni render, la variante migliore secondo i controlli automatici ha il badge **"Consigliata"**.
2. Dal modulo "Nuovo render" si possono scegliere **più colori e/o più tessuti** e generare in un colpo un render per ogni combinazione, sulla stessa foto, con lo stesso prodotto, le stesse misure e la stessa posizione (volume o sagoma).
3. Una pagina **"Confronto"** mostra le finiture affiancate, ognuna con le sue varianti, e permette di scegliere la variante da consegnare.
4. Nell'archivio un confronto occupa **una scheda sola**.

## Anti-obiettivi

- Un badge "Consigliata" su una variante che ha un avviso (scena alterata, fuori posto, forse tagliata, casa non protetta): sarebbe un consiglio sbagliato con l'aria di essere sicuro.
- Il badge che sceglie al posto di Patrizia: la variante consegnata la sceglie sempre lei con "Scegli".
- Rompere o cambiare il flusso del render singolo (modulo, pagina, "Genera altre", "Riprova", download, "Duplica e modifica", eliminazione): deve funzionare come oggi.
- Il testo per l'IA di una finitura che parla del colore o del tessuto di un'altra.
- Più di una variante "Scelta" dentro lo stesso confronto.

## Non-obiettivi

- Nessuna immagine o PDF di confronto da inviare al cliente.
- Nel confronto variano solo le finiture: niente confronto di prodotti, misure, posizioni o modelli di IA diversi.
- Niente "Duplica confronto": si duplica il singolo render, come oggi.
- Nessun cambiamento alle soglie dei controlli (`DRIFT_ALTERED_THRESHOLD`, `PLACEMENT_THRESHOLD`).

## Vincoli

- Progetto `GibusRender/`, Next.js della versione installata (leggere `node_modules/next/dist/docs/` prima di scrivere codice, vedi `AGENTS.md`), Prisma su PostgreSQL, interfaccia in italiano.
- Ogni render resta autosufficiente: ha la sua copia della foto (`photoFor` in `src/lib/render/generate.ts` copia il file apposta), il suo testo per l'IA e le sue varianti.
- Le generazioni partono dal browser, una richiesta per variante (`POST /api/renders/[id]/variants`), con il limite di 300 s per richiesta di Vercel.

## Approcci considerati

- **A. Un render per finitura, raggruppati in un confronto** — *scelto dall'utente.* Ogni finitura è un render normale; un nuovo record "confronto" li lega e una pagina nuova li mostra affiancati. Tutto quello che esiste per il render singolo continua a funzionare senza modifiche. Costa una pagina nuova, un campo nel database e l'adattamento dell'archivio.
- B. Un solo render con la finitura salvata su ogni variante. Una pagina sola, ma colore, tessuto e testo per l'IA passano dal render alla variante: tocca generazione, riepilogo, "Genera altre" e duplicazione. Scartato: è il più invasivo e rischia di rompere ciò che funziona.
- C. Solo un collegamento tra render "fratelli". Il più economico, ma le finiture non si vedono affiancate: resta il passaggio da una pagina all'altra che si vuole eliminare. Scartato.

## Parte 1 — Variante consigliata

### Regola

Una funzione pura `recommendedVariant(variants, { hasVolume })` in `src/lib/render/variant-list.ts` (usabile da browser e test) restituisce l'id della variante consigliata o `null`. `hasVolume` dice se il render ha il volume 3D: dalle sole varianti non si capisce.

1. **Candidate**: varianti `DONE`, non scadute, con `protected = true`, senza nessun avviso: non `isSceneAltered(driftScore)`, non `isMisplaced(placementOffset)`, non `truncated`.
2. **Il punteggio usato per ordinare è obbligatorio**: con il volume serve `placementOffset`, senza volume serve `driftScore`. Una variante senza quel punteggio **non è candidata**. Motivo: `placementOffset` è `null` anche su varianti nuove quando attorno al volume non è cambiato quasi nulla (`minChangedRatio` in `src/lib/render/placement.ts`), cioè probabilmente la pergola non è stata disegnata. Le varianti vecchie, generate prima che esistesse il punteggio, restano senza badge: è accettabile e non serve un campo nuovo. *(Scelta del redattore, dopo la revisione.)*
3. **Servono almeno 2 varianti `DONE`** nel render (candidate o no): con una sola non c'è nulla da consigliare. *(Scelta del redattore.)*
4. **Ordine**: per il punteggio crescente; a parità, la più vecchia (`createdAt`, poi `id`).
5. Nessuna candidata → `null`, nessun badge.

### Dove si vede

- Pagina del render (`VariantsView`): badge "Consigliata" sulla scheda, accanto a "Scelta". Le due cose sono indipendenti: la consigliata può non essere la scelta.
- Si ricalcola sul client a ogni variante arrivata: durante la generazione il badge può spostarsi. *(Scelta del redattore: è più utile vederlo subito che aspettare la fine.)*
- Un `title` sul badge spiega in una riga perché: "Nessun avviso e la più vicina al volume" oppure "Nessun avviso e la scena più fedele alla foto".

## Parte 2 — Confronto delle finiture

### Dati

Nuovo modello e nuovo campo (migrazione Prisma):

```prisma
model Comparison {
  id        String   @id @default(cuid())
  clientRef String
  renders   Render[]
  createdAt DateTime @default(now())
}

// in Render:
comparisonId String?
comparison   Comparison? @relation(fields: [comparisonId], references: [id], onDelete: SetNull)
@@index([comparisonId])
```

- Nessun campo "render vincitore": la variante scelta resta `Render.chosenVariantId`. In un confronto **al massimo un render ha una variante scelta**: scegliere una variante in un render del confronto azzera `chosenVariantId` negli altri render dello stesso confronto, nella stessa transazione. Questo vale anche quando si sceglie dalla pagina del singolo render che fa parte di un confronto.
- I render esistenti restano con `comparisonId = null`: nulla cambia per loro.

### Modulo "Nuovo render"

- Nel passo **Finiture** compare l'interruttore **"Confronta più finiture"** (spento di default). Spento: i due menu a tendina di oggi. Acceso: due elenchi a caselle (colori compatibili, tessuti compatibili), con il campione di colore (`swatchHex`) accanto al nome.
- **Combinazioni** = colori scelti × tessuti scelti. Un elenco senza nessuna casella vale come "Nessuno (non indicato all'IA)", come oggi. Esempio: 2 colori e 2 tessuti → 4 render; 3 colori e nessun tessuto → 3 render.
- **Da 2 a 6 combinazioni.** Con meno di 2 il modulo chiede di sceglierne di più o di spegnere l'interruttore; oltre 6 avvisa e non genera. *(Scelta del redattore: 6 × 3 varianti = 18 immagini è già molto da confrontare.)*
- Il numero di varianti vale **per ogni finitura**. La stima del costo mostra il totale ("4 finiture × 3 varianti = 12 immagini, circa …").
- **Testo per l'IA**: con il confronto acceso non si può modificare a mano. L'anteprima mostra il testo della prima combinazione e una nota: "Ogni finitura riceve il proprio testo, uguale salvo colore e tessuto". Se c'era un testo modificato a mano, accendendo il confronto si chiede conferma prima di scartarlo. *(Scelta del redattore: un testo scritto a mano non si può adattare in modo sicuro alle altre finiture, ed è l'anti-obiettivo più facile da violare.)*
- "Duplica e modifica" parte, come oggi, con l'interruttore spento e la finitura del render di partenza.

### Creazione

- Nuova route `POST /api/confronti`: riceve gli stessi campi di `POST /api/renders` (senza `prompt`, senza `colorId`/`fabricId`), più `finishes`: JSON `[{ colorId: string | null, fabricId: string | null }]`. Stessi controlli (fornitore abilitato, limite del corpo, foto) e stessi messaggi.
- Crea il `Comparison` e poi un render per combinazione con `createRender`, lasciando che sia il server a costruire il testo per l'IA di ognuno (`buildPrompt`, come quando `prompt` manca). La foto si normalizza una volta sola e si riusa il buffer per tutti i render; ognuno salva la propria copia del file.
- **Tutto o niente**: se un render non si crea, si eliminano quelli già creati (con i loro file) e il confronto, e si restituisce l'errore.
- Risposta `{ id }`; il browser va a `/confronto/[id]?avvia=1`.

### Pagina `/confronto/[id]`

```
← Archivio
Rossi – via Roma 12                          [Elimina confronto]
Bioclima Addossata · 4 finiture · 19/11/2026

┌ Bianco 9010 · Ecru ─┐ ┌ Antracite 7016 · Ecru ┐ ┌ ... ┐
│ [variante 1]        │ │ [variante 1] Consigl.  │
│ [variante 2] Consig.│ │ [variante 2]           │
│ [variante 3]        │ │ [variante 3] ⚠ Fuori   │
│ Apri render →       │ │ Apri render →          │
└─────────────────────┘ └────────────────────────┘
```

- **Una colonna per finitura**, con il campione e il nome di colore e tessuto in testa. Dentro, le schede delle varianti con gli stessi badge della pagina del render, compreso "Consigliata" (calcolata per colonna), e il pulsante "Scegli".
- **"Scegli"** in qualunque colonna segna quella variante come scelta e toglie la scelta dalle altre colonne (vedi Dati). La colonna con la variante scelta è evidenziata.
- Clic sull'immagine: ingrandimento, come nella pagina del render. Per prima/dopo, volume sovrapposto, download, "Genera altre", "Riprova" ed eliminazione della singola variante si usa **"Apri render"**: la pagina del render resta il posto dei dettagli. *(Scelta del redattore: si evita di duplicare `VariantsView` in versione compatta.)*
- In alto un pulsante **"Scarica la scelta"** (attivo quando c'è una variante scelta) usa la route di download che esiste già.
- **Avvio**: con `?avvia=1` la pagina lancia le varianti di tutti i render (`variantsRequested` ciascuno), **al massimo 4 richieste alla volta** per non incappare nei limiti dei fornitori, poi toglie il parametro dall'indirizzo come fa oggi la pagina del render. Le schede in attesa mostrano il segnaposto.
- **Coda interrotta.** La coda vive nel browser: se Patrizia ricarica o lascia la pagina prima della fine, le richieste non ancora partite non partono più (quelle già partite il server le completa). Per questo *(scelte del redattore, dopo la revisione)*:
  - mentre la coda non è vuota, lasciare la pagina chiede conferma (avviso standard del browser) e "Apri render" apre il render in una nuova scheda;
  - quando nessuna richiesta è in corso e in qualche colonna le varianti presenti nel database (di qualsiasi stato) sono meno di `variantsRequested`, compare il pulsante **"Genera le mancanti (N)"**, che rimette in coda solo quelle, con il costo stimato accanto. Anche una variante eliminata a mano conta come mancante: il pulsante è solo una proposta, non parte da sé. Riaprire la pagina non rilancia nulla da solo, come oggi la pagina del render.
- Su schermo stretto le colonne vanno una sotto l'altra.
- Se il fornitore del confronto è disabilitato, si mostra lo stesso avviso della pagina del render e non si lancia nulla.

### Pagina del render di un confronto

- Sotto il titolo: "Fa parte di un confronto di N finiture" con il collegamento alla pagina del confronto.
- Nient'altro cambia, salvo la regola "una sola scelta per confronto".

### Archivio

- Un confronto è **una scheda**: miniatura della variante scelta (in qualsiasi suo render) o, se manca, la prima variante completata del primo render; titolo `clientRef`; sotto "Confronto · N finiture" e il prodotto; badge "Scelta" se una variante è scelta. Il clic apre `/confronto/[id]`.
- La ricerca per riferimento cliente trova anche i confronti. Ordine per data di creazione, come oggi.
- **Paginazione**: le schede (render singoli e confronti) contano come una ciascuna. Come ottenerlo (query su due tabelle unite, oppure raggruppamento) lo decide chi costruisce.

### Eliminazione

- **"Elimina confronto"** (pagina del confronto e scheda d'archivio), con conferma: elimina tutti i suoi render con foto e varianti, poi il confronto.
- Eliminare un singolo render dalla sua pagina lo toglie dal confronto. Se nel confronto resta un solo render, il confronto si scioglie: si elimina il record `Comparison` e il render rimasto torna un render normale. Se non ne resta nessuno, si elimina il confronto.

## Verifica

- Test unitari (Vitest, cartella `tests/`): `recommendedVariant` (candidate, esclusioni per ogni avviso, minimo 2, ordine con e senza volume, varianti vecchie senza punteggio); calcolo delle combinazioni e limiti 2–6; regola "una sola scelta per confronto"; creazione tutto-o-niente (un render che fallisce non lascia residui); testo per l'IA di ogni render con il solo colore e tessuto suo.
- `npm test`, `npm run lint`, `npm run build`.
- Prova nel browser con il server locale: render singolo invariato; confronto di 2 finiture creato, pagina con le colonne, scelta esclusiva, archivio con una scheda, eliminazione.
- **Prova con generazioni reali**: un confronto di 2 finiture × 2 varianti con FLUX.3 Klein via fal.ai, circa 0,04 $. Da fare solo con il via dell'utente.

## Lasciato a chi costruisce

- Organizzazione del codice della pagina del confronto e della route; riuso dei componenti esistenti (badge, ingrandimento, conferma di eliminazione).
- Query dell'archivio con la paginazione per schede.
- Testi esatti di avvisi e suggerimenti, nello stile di quelli esistenti.
