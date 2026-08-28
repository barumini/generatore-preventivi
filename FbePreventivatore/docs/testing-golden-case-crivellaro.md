# Golden case Crivellaro — guida ai test sui due sistemi

Riferimento: golden case definito in [`CLAUDE.md`](../CLAUDE.md). Se questi numeri non
tornano, il motore è rotto — sono test, non documentazione.

Il progetto ha due punti di ingresso per creare un preventivo, entrambi basati sullo
stesso motore (`src/domain/calcolo.ts`) e sullo stesso `StatoForm`:

- **Primo sistema** — wizard manuale, route [`/preventivi/nuovo`](../src/app/preventivi/nuovo/page.tsx).
  L'utente compila i campi (o li estrae via chat AI) e il motore calcola i totali.
- **Secondo sistema** — import Excel, route [`/preventivi/nuovo-v2`](../src/app/preventivi/nuovo-v2/page.tsx).
  Carica il foglio conteggi FBE (`Conteggi pulito.xlsx`), ne estrae automaticamente
  **solo i serramenti** (più pareti/falde/travi come dati informativi non prezzati) e li
  inietta nello stesso wizard: il resto (cliente, superfici, sconti, prezzi) va comunque
  compilato a mano per arrivare al totale finale.

---

## 1. Test automatici

```bash
npm test
```

Per isolare solo i test rilevanti al golden case:

```bash
# Primo sistema — motore di calcolo puro
npm test -- src/domain/calcolo.test.ts
npm test -- src/domain/geometria.test.ts
npm test -- src/domain/voci.test.ts
npm test -- src/domain/listino.test.ts

# Primo sistema — mappatura StatoForm → InputCalcolo e generazione documento
npm test -- src/app/preventivi/nuovo/stato-form.test.ts
npm test -- src/documento/costruisci-input-esportazione.test.ts
npm test -- src/documento/export-docx.test.ts

# Secondo sistema — parsing del foglio Excel
npm test -- src/domain/importazione-excel.test.ts
```

Tutti questi test usano dati fedeli al caso Crivellaro (costanti `STATO_CRIVELLARO` /
`INPUT_CRIVELLARO` / `RIGHE_CRIVELLARO`) e verificano esattamente i numeri della sezione
successiva.

---

## 2. Numeri attesi (golden case)

```
serramenti      30,50 mq lordi · 15,89 mq netti
Listino 2026    237 000,00
−10% cliente    − 23 700,00  → 213 300,00
−10% conferma   − 21 330,00  → 191 970,00
arrotondamento  −  1 070,00
PARZIALE        190 900,00
TOTALE          300 000,00
```

Nota sugli sconti: sono **a cascata**, non additivi (10%+10% = 19%, non 20%).

---

## 3. Test manuale — Primo sistema (`/preventivi/nuovo`)

```bash
npm run dev
```

Poi apri `http://localhost:3000/preventivi/nuovo`.

### 3.1 Precompilazione via AI — chat "Apertura rapida"

Prima di compilare i campi a mano, puoi usare il riquadro "Apertura rapida" in cima alla
pagina: invia un testo libero e `POST /api/estrazione` lo trasforma nei campi dello
`StatoForm` tramite un modello locale (schema e prompt di sistema in
[`src/ai/estrazione.ts`](../src/ai/estrazione.ts)).

**Prerequisito**: LM Studio in esecuzione in locale con il server attivo (Impostazioni >
Local Server > Start Server) e la variabile d'ambiente `LM_STUDIO_MODEL` impostata al nome
esatto del modello caricato (`LM_STUDIO_BASE_URL` opzionale, default
`http://localhost:1234/v1`). Senza queste due condizioni la chiamata fallisce con un errore
leggibile invece di bloccarsi in silenzio.

L'estrazione copre **solo** questi campi dello `StatoForm` (schema `CampiEstratti`):
cliente (nome/comune/provincia), protocollo, progettista, luogo, superfici per piano,
tipo di copertura, finitura esterna, pacchetto, i 4 spessori. **Non estrae**: perimetro,
serramenti, sconti, totale target, sicurezza, manto, tipo di tetto — questi restano da
compilare a mano dopo l'estrazione, in tutti i casi.

Incolla questo testo nella chat per far compilare all'AI il massimo di campi possibile in
un colpo solo (i valori seguono il golden case Crivellaro; spessori e progettista sono
aggiunti qui — nel golden case reale restano vuoti/non assegnati — solo per verificare che
l'estrazione copra l'intero schema):

```
Preventivo per il cliente Crivellaro Mariano, comune di Trissino, provincia VI.
Protocollo 2026059. Progettista: arch. Paolo Bianchi. Luogo del cantiere: Trissino.
Superfici: Piano Terra 134 mq, Portico 13+14 mq, Garage 41 mq.
Copertura a falde, finitura esterna a intonaco. Pacchetto grezzo avanzato.
Spessori: esterno 205 mm, interno 160 mm, coibente 200 mm, cappotto 140 mm.
```

Verifica dopo l'invio:

- il form si precompila con tutti i campi sopra, i nomi piano normalizzati esattamente in
  `Piano Terra` / `Portico` / `Garage` (i nomi devono coincidere carattere per carattere
  con quelli in [`geometria.ts`](../src/domain/geometria.ts) — `PIANI_CANONICI` — altrimenti
  il piano resta non riconosciuto e va corretto a mano)
- il pacchetto "grezzo avanzato" imposta `livelli` = struttura completo, involucro
  completo, finiture impoverito (vedi `livelliDaPacchetto`)
- il messaggio dell'assistente non elenca campi mancanti (a parte eventualmente `luogo`,
  che va comunque ignorato: si deduce dal comune anche se il modello lo segnala)

Per testare il percorso "campo mancante", rimuovi una frase (es. togli "Protocollo
2026059") e verifica che l'assistente segnali `protocollo` tra i campi da completare a
mano, senza inventare un valore (vincolo CLAUDE.md §7 — l'AI non decide mai importi né
inventa dati non dichiarati).

### 3.2 Compilazione manuale (o completamento dopo l'estrazione AI)

Compila (o verifica, se hai usato la chat sopra) lo `StatoForm` con questi valori
(identici a `STATO_CRIVELLARO` in
[`stato-form.test.ts`](../src/app/preventivi/nuovo/stato-form.test.ts)):

| Campo | Valore |
|---|---|
| Cliente | Crivellaro Mariano — Trissino (VI) |
| Protocollo | 2026059 |
| Oggetto | Fornitura e posa in opera di casa in legno MHM |
| Data | 2026-08-07 |
| Luogo | Trissino |
| Superfici | Piano Terra: `134` · Portico: `13+14` · Garage: `41` (totale lordo 161 mq, superficie sedime 134 mq da Piano Terra) |
| Serramenti | almeno 1 voce: porta di ingresso, PT, b=1, h=2.2 (portoncino) |
| Perimetro | 60 |
| Livelli | struttura completo · involucro completo · finiture impoverito → pacchetto **"Grezzo avanzato"** |
| Chiavi in mano nel totale | Sì (non cambia il pacchetto: resta "Grezzo avanzato", il flag decide solo l'inclusione nel totale) |
| Sconti | 10% causale "sconto cliente" — **inserisci un secondo 10%** ("sconto conferma") per riprodurre la cascata del golden case |
| Totale target | 300000 (guida l'arrotondamento automatico) |
| Sicurezza | costo dichiarato 2000, valorizzata `OMAGGIO` |
| Copertura | falde, manto Tegole in cemento, finitura esterna intonaco, tetto con travi e perline in abete |
| Spessori | lasciali vuoti (nel golden case restano placeholder non risolti — è atteso) |

Verifica nel pannello preview / nel documento generato:

1. `Listino 2026` = **237 000,00**
2. Dopo i due sconti a cascata → **191 970,00**
3. Con l'arrotondamento risolto sul totale target → `PARZIALE` = **190 900,00**
4. `TOTALE` finale (parziale + chiavi in mano + garage, sicurezza OMAGGIO non pesa) = **300 000,00**
5. Numerazione voci calcolata al render (non hard-coded) e importi con formato italiano
   (`96 100,00 €`, spazio migliaia + virgola decimale)

Se generi il documento Word, verifica che contenga `Crivellaro Mariano` e `300 000,00`
(vedi asserzioni in
[`export-docx.test.ts`](../src/documento/export-docx.test.ts)).

---

## 4. Test manuale — Secondo sistema (`/preventivi/nuovo-v2`)

File sorgente: [`Documentazione addestramento/Conteggi pulito.xlsx`](../Documentazione%20addestramento/Conteggi%20pulito.xlsx)
(non committato in git, ~33 MB la cartella intera — verifica di averlo in locale).

1. Apri `http://localhost:3000/preventivi/nuovo-v2`
2. Nella sezione "Importa dal foglio conteggi", carica `Conteggi pulito.xlsx`
3. Verifica il riepilogo mostrato dopo il caricamento:
   - **11 serramenti** importati (porta di ingresso, finestre, portafinestra — categorie
     mappate automaticamente: "finestra"/"doppia finestra" → `finestra-battente`,
     "portafinestra" → `portafinestra-battente`, "porta..." → `portoncino`)
   - **5 pareti** (4 esterne + 1 interna, con spessore)
   - **7 voci copertura** e **6 voci travi** (dati informativi, notazione libera
     preservata così com'è, es. `5,8x16,5 x17,1` — non entrano nel prezzo)
   - **nessun avviso** "non coincide" tra mq lordi ricalcolati dai serramenti e quelli
     dichiarati nel foglio (colonna totale copertura)
4. Verifica il subset geometrico del golden case:
   - somma `b × h` dei serramenti importati = **30,50 mq lordi**
   - mq netti dichiarati nel foglio (colonna a fianco) = **15,89 mq netti**
5. A questo punto il wizard sottostante si popola con i serramenti/pareti importati.
   Completa manualmente cliente, superfici, sconti, sicurezza, totale target come nella
   sezione 3 per arrivare agli stessi totali finali (237 000 / 190 900 / 300 000).

### Caso di errore utile da provare

- Carica un file con una tipologia di serramento non riconosciuta (es. "oblo rotondo"):
  atteso un avviso `Tipologia serramento non riconosciuta "..."` e categoria di default
  `finestra-battente` assegnata comunque (nessun blocco).
- Carica un file non `.xlsx` valido: atteso messaggio d'errore
  "Lettura del file Excel fallita: verifica che sia un .xlsx valido".

---

## Note

- Pareti, falde e travi importati dal secondo sistema sono **solo informativi**: non
  entrano nel calcolo del prezzo (spec §3.6). Solo i serramenti alimentano la geometria
  prezzata.
- Entrambi i sistemi convergono sullo stesso `StatoForm` e sullo stesso motore di
  calcolo: se il primo sistema passa i suoi test ma il secondo produce numeri diversi a
  parità di dati, il bug è nella mappatura di import (`mappatura-importazione.ts` /
  `importazione-excel.ts`), non nel motore.
