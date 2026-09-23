# Guida — test completo Da Croce, dalla chat al documento

Test end-to-end da fare in autonomia su `/preventivi/nuovo-v3`: anagrafica e spessori compilati
dalla chat "Apertura rapida", computo metrico caricato da PDF, totale commerciale **calcolato**
(255 000,00 €, nessun campo da digitare), bozza salvata e documento `.docx` generato.

Tempo: circa 5 minuti. Eseguito dal vivo il 2026-09-23 con esito positivo — i numeri attesi qui
sotto sono quelli ottenuti in quel giro.

Per il dettaglio tecnico del caso (origine dei numeri, scarti rispetto all'offerta firmata) vedi
[`testing-golden-case-dacroce.md`](testing-golden-case-dacroce.md).

---

## 0. Prerequisiti

1. **LM Studio acceso**, con il server locale avviato (Impostazioni › Local Server › Start Server)
   e il modello caricato che corrisponde a `LM_STUDIO_MODEL` in `.env.local`
   (oggi `google/gemma-4-12b`). Senza LM Studio la chat risponde con un errore rosso: puoi
   comunque proseguire compilando a mano (vedi §2, "Piano B").
2. **Server di sviluppo avviato** dalla cartella del progetto:

   ```bash
   npm run dev
   ```

3. **PDF del computo** a portata di mano. Uno dei due, sono lo stesso file:
   - `e2e/fixtures/computo-dacroce.pdf` (nel repository)
   - `Documentazione addestramento/x IA/Computo Dacroce Dalila - senza terrazzo.PDF`

---

## 1. Apri il wizard

Vai su <http://localhost:3000/preventivi/nuovo-v3>. Se hai già una pagina aperta con un test
precedente, ricaricala: il wizard deve partire vuoto.

> **Ordine importante: prima la chat, poi il computo.** La chat riscrive per intero la sezione
> Configurazione (spessori, copertura, finitura). Il computo invece non viene toccato dalla chat,
> ma partire dalla chat evita sorprese.

---

## 2. Anagrafica e dati bloccanti via chat

Nel riquadro **"Apertura rapida"** in alto incolla questo testo e premi **Invio**:

```
Preventivo per la cliente Dacroce Dalila, comune di Rovereto, provincia TN. Protocollo 2022077. Progettista: Campana Tommaso. Pacchetto grezzo avanzato, copertura a falde, finitura esterna a intonaco. Spessori: pareti esterne 205 mm, pareti interne 205-160 mm, coibente falda 80+60+20 mm, cappotto 60+40 mm.
```

Attendi che sparisca "Sto leggendo..." (da qualche secondo a circa un minuto, dipende dal modello).

**Risposta attesa della chat:** qualcosa come *"mi manca ancora: superfici, pareti, falde, travi,
serramenti"*. **Ignorala**: in questo wizard quei dati arrivano dal computo metrico, non servono.

### Verifica — step "1. Anagrafica"

| Campo | Valore atteso |
|---|---|
| Cliente | `Dacroce Dalila` |
| Protocollo | `2022077` |
| Comune | `Rovereto` |
| Provincia | `TN` |
| Progettista | `Campana Tommaso` |
| Oggetto | `Fornitura e posa in opera di casa in legno MHM` |
| Data | la data di oggi |
| Luogo | `Rovereto` |

### Verifica — step "2. Configurazione"

| Campo | Valore atteso |
|---|---|
| Struttura / Involucro / Finiture | `completo` / `completo` / `impoverito` (= grezzo avanzato) |
| Copertura | `falde` |
| Finitura esterna | `intonaco` |
| Spessore pareti esterne (mm) | `205` |
| Spessore pareti interne (mm) | `205-160` |
| Spessore coibente falda (mm) | `80+60+20` |
| Spessore cappotto (mm) | `60+40` |

Gli **spessori sono l'unico dato che blocca davvero** la generazione del documento: se uno
resta vuoto, "Genera documento" fallisce. Se il modello ne ha saltato qualcuno, scrivilo a mano.

### Piano B — senza LM Studio

Compila a mano gli stessi valori delle due tabelle qui sopra, negli step 1 e 2.

---

## 3. Carica il computo — step "3. Computo metrico"

Trascina il PDF sulla zona di caricamento (oppure cliccala e scegli il file).

| Cosa guardare | Valore atteso |
|---|---|
| Voci lette | `166` |
| Categorie | `8` |
| Totale computo | `323 643,58 €` |
| Alert verde | "Verifica superata: la somma delle voci pareggia il riepilogo" |
| Riconciliazione — somma voci | `278 787,93 €` |
| Riconciliazione — target | `300 343,58 €` |
| Riconciliazione — delta | `21 555,65 €` |
| Scheda `solaio-interpiano` | `15 240,96 €` (un numero, **non** "compresa") |

È normale anche un avviso giallo sulla sicurezza (23 352,50 nel computo contro i 23 300,00
forfettari): non blocca nulla.

---

## 4. Sconti — step "5. Condizioni"

Nessuna azione: nel wizard v3 sono già precompilati. Controlla soltanto che ci siano:

| Percentuale | Causale |
|---|---|
| `5` | `sconto cliente` |
| `10` | `per conferme entro il 31.01.2026` |

(Sono a cascata: il 10% si applica al residuo dopo il 5%.)

---

## 5. Totale calcolato — step "4. Prezzi"

In fondo, riquadro **Totale**:

| Cosa guardare | Valore atteso |
|---|---|
| "Imposta il totale a mano" | **non** spuntato |
| Arrotonda il totale per difetto a | `5 000,00 €` |
| **Totale calcolato** | **`255 000,00 €`** |
| Riga sotto | `Arrotondamento calcolato: -1 793,76 €` |

Il conto che fa il motore: 300 343,58 − 5% − 10% = 256 793,76 € → per difetto ai 5 000 € →
**255 000,00 €**.

Prove facoltative (poi rimetti tutto com'era):

- Passo `1 000,00 €` → totale `256 000,00 €`, arrotondamento `-793,76 €`.
- Spunta "Imposta il totale a mano" → compare il campo Totale target, **già precompilato con
  `255000`**. Togli la spunta per tornare al calcolo.

### Avvisi sotto ai tab

Con tutti i dati inseriti **non deve comparire nessun avviso**. Se ne vedi uno:

| Avviso | Causa | Rimedio |
|---|---|---|
| "placeholder di protocollo non sostituito" | Protocollo ancora `BOZZA-…` | Step 1: scrivi il protocollo |
| "Spessori non compilati nelle descrizioni" | Uno spessore vuoto | Step 2: compila i 4 spessori |
| "L'arrotondamento (…) supera il 2% del Listino" | Computo non ancora caricato | Normale prima del §3, sparisce dopo |

---

## 6. Salva la bozza

Clicca **"Salva bozza"** in basso a sinistra.

### ⚠️ Errore "Esiste già un preventivo con protocollo 2022077"

È il blocco più probabile se hai già fatto questo test: il protocollo deve essere **univoco**, e
nel database di sviluppo esiste già una bozza con `2022077`. Due possibilità:

- **Consigliata per i test:** step 1, cambia il protocollo in uno univoco, ad esempio
  `2022077-TEST-2` (poi `-3` e così via), e rifai "Salva bozza".
- Oppure elimina la vecchia bozza dall'elenco <http://localhost:3000/preventivi> (seleziona la
  riga › elimina). L'operazione è irreversibile: fallo solo se quella bozza non ti serve.

Esito atteso: la bozza viene salvata e accanto a "Salva bozza" compare **"Genera documento"**.

---

## 7. Genera il documento

Clicca **"Genera documento"**: il browser scarica `<protocollo>-rev00.docx` (circa 35 MB).

Aprilo in Word e controlla:

- **Copertina:** `PROT. <protocollo> REV.00`, `Sig. Dacroce Dalila`, `Rovereto (TN)`.
- **Descrizioni voce:** `… esterne sp. mm 205 ed interne sp. mm 205-160`,
  `Cappotto … sp. mm 60+40 …` — nessun `{{…}}` rimasto.
- **Tabella prezzi:**

  ```
  Listino 2026                                        300 343,58 €
  SCONTO RISERVATO: 5%   sconto cliente               - 15 017,18 €
  SCONTO RISERVATO: 10%  per conferme entro il 31.01.2026   - 28 532,64 €
  Arrotondamento                                       - 1 793,76 €
  PARZIALE AL GREZZO AVANZATO  esclusa I.V.A.          255 000,00 €
  COSTI SICUREZZA: OMAGGIO
  TOTALE AL NETTO  esclusa I.V.A.                      255 000,00 €
  ```

Nota: `REV.00` è corretto per la prima revisione (la numerazione del documento parte da 00).
Il progettista viene salvato nel preventivo ma non compare nel testo del documento.

---

## Riepilogo — test superato se

- [ ] La chat compila anagrafica e 4 spessori (§2)
- [ ] Il computo dà 166 voci e 323 643,58 € (§3)
- [ ] Il **Totale calcolato** è **255 000,00 €** senza aver digitato nulla (§5)
- [ ] Nessun avviso sotto ai tab (§5)
- [ ] La bozza viene salvata (§6)
- [ ] Il `.docx` si genera e la tabella prezzi termina con TOTALE 255 000,00 € (§7)

Se un numero non torna, annota lo step e il valore visto: il motore è verificato anche dai test
automatici (`npm test`) e dall'e2e (`npm run test:e2e`), che controlla lo stesso 255 000,00 €.
