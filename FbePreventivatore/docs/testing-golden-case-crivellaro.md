# Golden case Crivellaro — guida ai test sui due sistemi

Riferimento: golden case definito in [`CLAUDE.md`](../CLAUDE.md). Se questi numeri non
tornano, il motore è rotto — sono test, non documentazione.

Il progetto ha due punti di ingresso per creare un preventivo, entrambi basati sullo
stesso motore (`src/domain/calcolo.ts`) e sullo stesso `StatoForm`:

- **Primo sistema** — wizard manuale, route [`/preventivi/nuovo`](../src/app/preventivi/nuovo/page.tsx).
  L'utente compila i campi (o li estrae via chat AI) e il motore calcola i totali. Include
  anche pareti/copertura/travi come sezioni editabili (dati tecnici di riferimento, non
  prezzati — aggiunti nel commit `89b4aa6`), inseribili a mano o via chat AI.
- **Secondo sistema** — import Excel, route [`/preventivi/nuovo-v2`](../src/app/preventivi/nuovo-v2/page.tsx).
  Carica il foglio conteggi FBE (`Conteggi pulito.xlsx`), ne estrae automaticamente
  serramenti, pareti, falde e travi e li inietta nello stesso wizard (solo i serramenti
  entrano nel prezzo): il resto (cliente, superfici, sconti, prezzi) va comunque compilato
  a mano per arrivare al totale finale.

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

# Primo sistema — estrazione AI e mappatura di pareti/falde/travi (chat "Apertura rapida")
npm test -- src/ai/estrazione.test.ts
npm test -- src/app/preventivi/nuovo/mappatura-estrazione.test.ts

# Secondo sistema — parsing del foglio Excel
npm test -- src/domain/importazione-excel.test.ts
```

Tutti questi test usano dati fedeli al caso Crivellaro (costanti `STATO_CRIVELLARO` /
`INPUT_CRIVELLARO` / `RIGHE_CRIVELLARO`) e verificano esattamente i numeri della sezione
successiva. `estrazione.test.ts` e `mappatura-estrazione.test.ts` coprono in particolare il
round-trip di pareti/falde/travi (testo libero → `CampiEstratti` → `StatoForm`) con gli
stessi valori usati nell'esempio manuale del §3.1.

Suite completa: 26 file, 230 test, tutti verdi (`npm test`, verificato 2026-08-31).

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

L'estrazione copre questi campi dello `StatoForm` (schema `CampiEstratti`):
cliente (nome/comune/provincia), protocollo, progettista, luogo, superfici per piano,
tipo di copertura, finitura esterna, pacchetto, i 4 spessori, e — dal commit `89b4aa6` —
pareti (tipo I/E, base, altezza, spessore) e falde/travi (etichetta + notazione testuale,
mai interpretata come numero). **Non estrae**: perimetro, serramenti, sconti, totale
target, sicurezza, manto, tipo di tetto — questi restano da compilare a mano dopo
l'estrazione, in tutti i casi.

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

Per testare pareti/copertura via chat (verificato con un modello reale su LM Studio),
aggiungi ad esempio: *"Ha una parete esterna di base 12,5 m, altezza 2,7 m, spessore
20 mm. La copertura ha una falda con notazione 5,8x16,5 x17,1."* — atteso: una riga in
"Pareti" con tipo Esterna/12.5/2.7/20, e una riga in "Copertura" con la notazione
riportata testualmente (l'etichetta esatta può variare leggermente, es. "falda" invece di
"Una falda": è testo libero, non normalizzato).

### 3.2 Compilazione manuale (o completamento dopo l'estrazione AI)

Compila (o verifica, se hai usato la chat sopra) lo `StatoForm`, step per step. **Lo step
4 "Prezzi" è quello che fa quadrare i totali: senza gli override digitati lì, il motore
propone i valori del listino parametrico (leggermente diversi, non tondi) e il totale
target resta 0** — è la causa più probabile se i tuoi totali non coincidono con la stima.

**1. Anagrafica**

| Campo | Valore |
|---|---|
| Cliente | Crivellaro Mariano — Trissino (VI) |
| Protocollo | 2026059 |
| Oggetto | Fornitura e posa in opera di casa in legno MHM |
| Data | 2026-08-07 |
| Luogo | Trissino |

**2. Configurazione** (struttura/involucro/finiture e copertura sono già i default corretti — verificali comunque)

| Campo | Valore |
|---|---|
| Livelli | struttura completo · involucro completo · finiture impoverito → pacchetto **"Grezzo avanzato"** |
| Chiavi in mano nel totale | Sì (checkbox — non cambia il pacchetto: resta "Grezzo avanzato", decide solo l'inclusione nel totale) |
| Copertura / manto / finitura esterna / tetto | A falde · Tegole in cemento · Intonaco · "Tetto con travi e perline in abete" |
| Spessori | esterno 205 · interno 160 · coibente 200 · cappotto 140 (mm) |

**3. Geometria**

| Campo | Valore |
|---|---|
| Superfici | Piano Terra: `134` · Portico: `13+14` · Garage: `41` (totale lordo 161 mq, sedime 134 mq) |
| Perimetro | 60 |
| Serramenti | tutti e 11, non solo il portoncino — vedi `SERRAMENTI_CRIVELLARO` in [`geometria.test.ts`](../src/domain/geometria.test.ts): 1 portoncino (1×2.2), 9 finestre/portafinestra di dimensioni varie, per un totale di **30,50 mq lordi / 15,89 mq netti** (le mq nette sono calcolate dalle detrazioni standard 0,60×0,30, non serve inserirle a mano) |

Nella stessa pagina, sotto Serramenti, ci sono le sezioni **Pareti / Copertura / Travi**:
facoltative, non entrano nel calcolo del prezzo (vedi Note in fondo), ma se vuoi
riprodurre fedelmente il golden case Excel (stessi dati di `RIGHE_CRIVELLARO` in
[`importazione-excel.test.ts`](../src/domain/importazione-excel.test.ts)) usa questi
valori:

*Pareti* (tipo, base×altezza m, spessore mm):

| n. | Tipo | Base | Altezza | Spessore |
|---|---|---:|---:|---:|
| 1 | Esterna | 12.5 | 2.7 | 20 |
| 2 | Esterna | 10 | 3.4 | 20 |
| 3 | Esterna | 12.5 | 2.7 | 20 |
| 4 | Esterna | 10 | 3.4 | 20 |
| 5 | Interna | 5.3 | 3.75 | 16 |

*Copertura* (etichetta / notazione libera, mai interpretata come numero):

`Una falda` / `5,8x16,5 x17,1` · `Una falda` / `5,8x16,5` · `Una falda` / `4,9x6,3` ·
`Una falda` / `4,9x6,3` · `Pluviali` / `(8)3+(4)2,9` · `Grondaia` / `45,6` ·
`Scossalina` / `33+9,8`

*Travi* (etichetta / notazione):

`Colmo` / `16,5x0,2x0,32` · `Colmo` / `6,3x0,2x0,33` ·
`Pilastri ex` / `(2)2,7+4,15+(4)2,6+3,8x0,2x0,20` · `Travi ex` / `(2)3,2+(2)6x0,2x0,24` ·
`Pilastri int` / `0,2x0,2` · `travi interne` / `1,6x0,2x0,24`

Verificato in browser: con questi dati aggiunti i totali restano identici (237 000 /
190 900 / 300 000) — confermano che pareti/falde/travi non influenzano il prezzo.

**4. Prezzi — override voci di listino (il passaggio critico)**

Ogni voce del catalogo ha un campo "proposto dal listino"; il golden case usa valori
**digitati**, non quelli proposti. Inserisci esattamente questi (da `INPUT_CRIVELLARO` in
[`calcolo.test.ts`](../src/domain/calcolo.test.ts)):

| id voce | Override |
|---|---:|
| `pareti-mhm` | 96100 |
| `trave-larice` | 5800 |
| `copertura-falda` | 63600 |
| `cappotto` | 20300 |
| `cartongesso-q2` | 15500 |
| `assistenza-cartongessisti` | 2200 |
| `infissi-pvc` | 19300 |
| `monoblocchi` | 10200 |
| `progettazione-esecutiva` | 4000 |
| `opere-chiavi-in-mano` | 89100 |
| `garage` | 20000 |

(`tracciamento-impianti` e `pareti-telaio` restano testuali "comprese", nessun override;
`solaio-interpiano` è escluso perché Crivellaro è monopiano.)

Poi imposta:

| Campo | Valore |
|---|---|
| Totale target | 300000 |
| Sicurezza | costo dichiarato 2000, valorizzata `OMAGGIO` |

**5. Condizioni**

| Campo | Valore |
|---|---|
| Sconti | riga 1: 10% "sconto cliente" · riga 2: 10% "per conferme entro il 30.06.2026" (l'ordine conta: il secondo si applica al residuo del primo) |

Verifica nel pannello preview / nel documento generato (valori confermati via test
manuale in browser):

1. `Listino 2026` = **237 000,00 €**
2. `SCONTO RISERVATO: 10% sconto cliente` = **− 23 700,00 €** → `SCONTO RISERVATO: 10% per
   conferme entro il 30.06.2026` = **− 21 330,00 €**
3. `Arrotondamento` = **− 1 070,00 €**
4. `PARZIALE AL GREZZO AVANZATO` = **190 900,00 €**
5. `Stima opere chiavi in mano` = 89 100,00 € · `Garage` = 20 000,00 € · sicurezza OMAGGIO
   non pesa
6. `TOTALE AL NETTO` = **300 000,00 €**

Se salti lo step Prezzi (nessun override, totale target a 0), osserverai invece: Listino
≈ 237 031,75 € (proposto dal listino, non tondo), un arrotondamento enorme e negativo che
cerca comunque di risolvere verso il totale target di 0, un `PARZIALE` negativo e un
`TOTALE AL NETTO` di 0,00 € — sintomo diretto dello step 4 saltato.

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
   - **14 pareti** (4 esterne + 10 interne, con spessore) — il file reale ha più righe
     pareti della subset `RIGHE_CRIVELLARO` usata nel test unitario (5 righe, 4 esterne +
     1 interna): non è un mismatch, il test copre solo un sottoinsieme
   - **7 voci copertura** e **6 voci travi** (dati informativi, notazione libera
     preservata così com'è, es. `5,8x16,5 x17,1` — non entrano nel prezzo)
   - **nessun avviso** "non coincide" tra mq lordi ricalcolati dai serramenti e quelli
     dichiarati nel foglio (colonna totale copertura)
4. Verifica il subset geometrico del golden case:
   - somma `b × h` dei serramenti importati = **30,50 mq lordi**
   - mq netti dichiarati nel foglio (colonna a fianco) = **15,89 mq netti**
5. A questo punto il wizard sottostante si popola con serramenti/pareti/falde/travi
   importati — sono editabili anche da qui (stesse sezioni descritte al punto 3, non più
   sola lettura). Completa manualmente cliente, superfici, sconti, sicurezza, totale
   target come nella sezione 3 per arrivare agli stessi totali finali
   (237 000 / 190 900 / 300 000). **Non dimenticare la checkbox "Chiavi in mano nel
   totale" in Configurazione** (§3.2 punto 2): di default è deselezionata, e senza di
   essa il `PARZIALE` risulta 280 000,00 € invece di 190 900,00 € (manca la riga "Stima
   opere chiavi in mano" da 89 100,00 €) — verificato manualmente in browser.

### Caso di errore utile da provare

- Carica un file con una tipologia di serramento non riconosciuta (es. "oblo rotondo"):
  atteso un avviso `Tipologia serramento non riconosciuta "..."` e categoria di default
  `finestra-battente` assegnata comunque (nessun blocco).
- Carica un file non `.xlsx` valido: atteso messaggio d'errore
  "Lettura del file Excel fallita: verifica che sia un .xlsx valido".

---

## Note

- Pareti, falde e travi sono **solo informativi**: non entrano mai nel calcolo del prezzo
  (spec §3.6), indipendentemente da come arrivano nel form (import Excel, chat AI o
  digitati a mano nel primo sistema). Solo i serramenti alimentano la geometria prezzata.
- Entrambi i sistemi convergono sullo stesso `StatoForm` e sullo stesso motore di
  calcolo: se il primo sistema passa i suoi test ma il secondo produce numeri diversi a
  parità di dati, il bug è nella mappatura di import (`mappatura-importazione.ts` /
  `importazione-excel.ts`), non nel motore.
