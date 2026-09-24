# Valutazione dei modelli per l'estrazione AI (chat "Apertura rapida")

Per chi riprende il lavoro sull'estrazione di `/preventivi/nuovo`: perché il sistema è stato
rifatto, cosa fa quello in produzione, con quali prove è stato scelto e come rifarle.
Misure del 2026-09-24 su OpenRouter.

**In produzione**: sistema *json-libero v2*, modello `openai/gpt-6-luna` con riserva
`qwen/qwen3.8-flash`, ragionamento spento.

| File | Contenuto |
|---|---|
| [`src/ai/estrazione.ts`](../src/ai/estrazione.ts) | prompt, esempi, clienti OpenRouter / LM Studio, ciclo dei tentativi |
| [`src/ai/normalizzazione-estrazione.ts`](../src/ai/normalizzazione-estrazione.ts) | strato deterministico (TypeScript puro, testato senza rete) |
| [`src/ai/valutazione/insiemi.ts`](../src/ai/valutazione/insiemi.ts) | i tre insiemi di casi della valutazione |
| [`scripts/valuta-estrazione.ts`](../scripts/valuta-estrazione.ts) | valutazione dal vivo contro OpenRouter |

---

## 1. Perché è stato rifatto

La versione precedente mandava `response_format: json_schema` ricavato da `SchemaCampiEstratti`,
dove quasi tutte le chiavi sono facoltative. Con la decodifica vincolata il modello poteva
saltare una chiave o finire nel ramo sbagliato dello schema: comune del cliente perso, spessori
generali scritti dentro `travi`. `deepseek/deepseek-v4-pro` a ragionamento spento partiva da
**40/78** controlli sull'insieme di sviluppo (×3).

Cambia anche la configurazione (vedi [`.env.example`](../.env.example)):

- `OPENROUTER_MODEL` è ora un **elenco separato da virgole** (primo = principale, poi le riserve),
  default `openai/gpt-6-luna,qwen/qwen3.8-flash`. Prima era un solo modello, default
  `deepseek/deepseek-v4.1-flash`: un `.env.local` che lo imposta ancora scavalca i nuovi default.
- `OPENROUTER_REASONING` ha la **semantica invertita**: prima il ragionamento era acceso salvo
  `off`, ora è spento salvo `on`.

---

## 2. Il sistema in produzione: json-libero v2

### 2.1 Richiesta

```json
{
  "models": ["openai/gpt-6-luna", "qwen/qwen3.8-flash"],
  "messages": ["…"],
  "temperature": 0,
  "max_tokens": 2500,
  "response_format": { "type": "json_object" },
  "reasoning": { "enabled": false },
  "provider": { "ignore": ["streamlake"], "data_collection": "deny" }
}
```

Nessuno schema vincolato. Timeout di 60 s. Il campo `models` (non `model`) fa passare OpenRouter
al secondo modello se il primo non risponde. LM Studio riceve gli stessi messaggi con
`temperature: 0` ma senza `response_format`, perché non accetta `json_object`.

`messaggiEstrazione(testo)` compone sei messaggi:

1. `system` con `PROMPT_SISTEMA`. È un modello di risposta con **tutte le 16 chiavi sempre
   presenti** (`null` o `[]` se il dato non c'è): il modello non decide se aprire una chiave,
   solo cosa scriverci. Seguono dieci regole (niente dati inventati, vale l'ultima versione,
   piani canonici, superfici come scritte, spessori mai in pareti/falde/travi, categorie dei
   serramenti…).
2. Due esempi completi, ognuno come coppia di turni `user` → `assistant`, su dati inventati. Il
   primo ha tutti i campi e una portafinestra senza altezza (`h: null`). Il secondo è senza
   protocollo né progettista e contiene pareti, una falda, una trave e una correzione finale
   ("correggo: …").
3. `user` con il testo dell'operatore, cioè i turni della chat concatenati.

Prompt ed esempi sono copiati **byte per byte** dal sistema misurato. Se li cambi, le misure del
§4 non valgono più e va rifatta la valutazione (§6).

### 2.2 Ciclo dei tentativi (`estraiCampi`, al massimo 2)

| Esito del tentativo | Cosa succede |
|---|---|
| errore di rete o del fornitore (429, 5xx, ma anche 401/402: ogni errore del client tranne il timeout) | pausa di 1,5 s, poi la stessa richiesta |
| timeout (60 s) | nessun nuovo tentativo: si propaga subito l'errore leggibile |
| risposta non valida: non JSON, forma sbagliata, nome cliente assente dal testo, schema Zod violato | secondo tentativo con `messaggioUnico`: prompt, esempi, motivo dell'errore e testo in **un solo** messaggio `user`, per i fornitori che perdono il `system` o i turni |
| risposta valida | `normalizzaEstrazione`, poi validazione con `SchemaCampiEstratti` |

Se falliscono entrambi i tentativi, l'errore è `Estrazione fallita: <ultimo motivo>`.

- `parsaJsonTollerante` accetta le recinzioni markdown e il testo attorno all'oggetto (prende dalla
  prima `{` all'ultima `}`).
- `controllaForma` pretende un oggetto con `cliente` oggetto, `superfici` lista e al massimo 3
  delle 16 chiavi assenti. Scarta un'eventuale chiave radice che lo avvolge
  (`{"preventivo": {…}}`).
- `verificaNomeCliente` pretende che almeno una parola del nome compaia nel testo. Se non compare,
  il modello ha risposto ad altro: ha ripetuto un esempio, oppure il fornitore ha servito la
  conversazione di un altro utente (§5).

### 2.3 Strato deterministico (`normalizzaEstrazione`)

Le regole di dominio non sono affidate al modello:

- **Niente valori senza riscontro nel testo.** Devono comparire nel testo:
  - il protocollo, a meno di spazi e punteggiatura;
  - il progettista, per almeno una parola che non sia un titolo;
  - gli spessori;
  - le misure di pareti e serramenti, anche se il testo le scrive in cm o mm;
  - i numeri della notazione di falde e travi.

  Un dato senza riscontro viene tolto, mai corretto. I segnaposto (`n/d`, `non specificato`,
  `-`, `null`) contano come dato assente.
- **Forma scritta conservata.** Le unità si tolgono (`mq`, `m²`, `mm`), ma `13+14` resta `13+14`
  e `60+40` resta `60+40`.
- **Piani canonici.** I nomi vengono ricondotti a `PIANI_CANONICI` di
  [`geometria.ts`](../src/domain/geometria.ts) (mansarda → `Piano sottotetto`, box auto →
  `Garage`, pianterreno → `Piano Terra`…). Per ogni piano vale l'ultima superficie citata.
- **Elementi incompleti scartati, mai completati.** Un serramento senza piano, tipologia, base o
  altezza non compare, e nemmeno una parete senza tipo, base, altezza o spessore. Mai righe a 0×0.
  La numerazione `n` viene rifatta.
- **Categoria del serramento.** Vale quella del modello se è tra le ammesse, perché il modello
  legge tutta la conversazione ("la portafinestra la facciamo alzante scorrevole"). Altrimenti si
  deduce dalla tipologia. È l'unica differenza tra v2 e v1.
- **Falde e travi.**
  - "Copertura a falde" da sola non è una falda.
  - Uno spessore finito tra le falde o le travi torna nel suo campo, se quel campo è vuoto.
  - Le falde valgono solo se il testo parla di falde, copertura o tetto; le travi solo se il
    testo cita travi.
- **Valori ammessi.** Copertura, finitura e pacchetto vengono ricondotti ai valori previsti.
- **`campiMancanti` calcolati dal codice, mai dal modello.** Sono gli id dei campi rimasti
  vuoti:
  - `cliente.nome`, `cliente.comune`, `cliente.provincia`;
  - `protocollo`, `progettista`;
  - `tipoCopertura`, `finituraEsterna`, `pacchetto`;
  - i 4 spessori;
  - `superfici`.

  A questi si aggiunge il nome grezzo di ogni piano non canonico. `luogo` non compare mai,
  perché si deduce dal comune. La UI traduce gli id in etichette leggibili.

L'estrazione non produce importi: i prezzi restano quelli del listino o quelli digitati
(CLAUDE.md §7).

### 2.4 Differenze volute rispetto al sistema misurato

Sono solo queste:

- Niente identificativo casuale in testa al prompt (`PREFISSO_UNICO`) e niente registrazione
  delle risposte grezze. La misura è stata fatta senza il prefisso.
- `models` con la riserva e `provider` (`ignore`, `data_collection`) al posto del solo `model`.
  Il coordinatore ha verificato dal vivo che risponde 200 con entrambi i modelli.
- Nessun nuovo tentativo dopo un timeout.
- In `categoriaDa` è tolto un ricontrollo finale ridondante, senza effetti sul risultato.

---

## 3. Insiemi di valutazione

Gli insiemi sono in [`src/ai/valutazione/insiemi.ts`](../src/ai/valutazione/insiemi.ts), in
`INSIEMI_VALUTAZIONE`.

| Insieme | Casi | Controlli | Cosa mette alla prova |
|---|---|---|---|
| `sviluppo` | 3 | 26 | `CASI_VALUTAZIONE` di [`valutazione-estrazione.ts`](../src/ai/valutazione-estrazione.ts): testo completo, protocollo assente, finestra senza altezza |
| `controllo` | 5 | 26 | casi scritti a parte, mai usati per mettere a punto il prompt: pareti e falda, conversazione a più turni, piani da normalizzare, serramenti misti, testo minimo |
| `avversari` | 12 | 83 | conversazioni (correzioni a catena, distrattori numerici, dati ritirati, serramenti e spessori a turni); anagrafica (particelle, sinonimi e negazioni, piano non canonico, alternative negate, negazione a turni); formati (serramenti in formati misti, superfici con unità e spessori composti, pareti e falde complesse, misure corrette a turni) |

I punteggi del §4 si leggono così: `sviluppo` + `controllo` ×3 = **156** controlli, `avversari`
×2 = **166**.

**Riferimento**: `deepseek/deepseek-v4-pro` a ragionamento acceso fa 166/166 sugli avversari.
Quindi ogni controllo è superabile: se un controllo fallisce, la colpa è del modello o del
sistema, non del caso.

---

## 4. Screening dei modelli

### 4.1 Metodo

Sono stati provati **125 modelli** di OpenRouter più economici di V4 Pro e con almeno un
fornitore che accetta `response_format`. Due sistemi sono stati confrontati: *json-libero* (§2)
e *schema-completo*, cioè `json_schema` strict con tutte le chiavi obbligatorie e `nullable`.

Ogni stadio riesegue solo chi ha superato tutto nello stadio precedente:

1. `sviluppo` ×1 (26 controlli), a ragionamento spento. Per i modelli che non dichiarano il
   parametro `reasoning`, il parametro è stato omesso.
2. `sviluppo` + `controllo` ×3 (156).
3. **Fornitori forzati**: si ripete la prova su ogni fornitore del modello, con `provider.only` e
   `allow_fallbacks: false`. Serve perché OpenRouter smista le richieste tra fornitori con
   quantizzazioni e comportamenti diversi.
4. `avversari` ×2 (166). Con la v2, i vincitori sono stati rimisurati anche su `avversari` ×1 per
   ogni fornitore forzato.

**Costo** = costo reale addebitato (`usage.cost` delle risposte, nuovi tentativi compresi)
diviso per le estrazioni. Non è una stima dal listino.

**Tempi**: mediana e massimo per estrazione, con i casi lanciati in parallelo.

### 4.2 Risultati (json-libero v2, ragionamento spento)

**Vincitori**: superano tutto, anche con ogni fornitore forzato.

| Modello | $/estrazione | Mediana | Massimo | Fornitori puliti |
|---|---|---|---|---|
| `openai/gpt-6-luna` (principale) | 0,00012 (OpenAI; Azure 0,00032) | 3,3 s | 6,2 s | 2/2: OpenAI, Azure |
| `qwen/qwen3.8-flash` (riserva) | 0,00014 | 3,8 s | 10 s | solo Alibaba |
| `qwen/qwen3.5-flash-02-23` | 0,00018 | 2,5 s | 3,5 s | solo Alibaba |

Estrazioni con la v2: 72 per `gpt-6-luna`, 60 per ciascuno dei due qwen. Contando anche la v1
(identica salvo la categoria dei serramenti) si arriva a 155 per `gpt-6-luna` e a 127 per
`qwen3.8-flash`, sempre senza un controllo fallito.

**Pieni su tutti gli insiemi, ma fornitori non riverificati con la v2**: sono candidati per
un'altra riserva.

| Modello | $/estrazione | Note |
|---|---|---|
| `google/gemma-3-27b-it` | 0,00020 | lento: mediana 40 s nella misura |
| `google/gemma-4-26b-a4b-it` | 0,00022 | con la v1, 4 fornitori su 11 problematici |
| `mistralai/ministral-14b-2512` | 0,00025 | solo Mistral |
| `qwen/qwen3-30b-a3b-instruct-2507` | 0,00025 | |
| `qwen/qwen3-32b` | 0,00029 | |

Attenzione: `gemma-3-27b-it`, `ministral-14b-2512` e `qwen3-30b-a3b-instruct-2507` sono stati
misurati **senza** il parametro `reasoning`, perché non lo dichiarano. La produzione manda sempre
`reasoning: { enabled: false }`. Prima di metterli in `OPENROUTER_MODEL`, verifica che lo
accettino.

**Non passano**:

- `deepseek/deepseek-v4-pro` spento fa 156/156, ma sugli avversari solo 163/166. Costa inoltre
  0,00088 $ a estrazione.
- `deepseek/deepseek-v4-flash` fa 164/166 sugli avversari e cede con i fornitori
  Baidu, GMICloud e Novita.
- `microsoft/phi-4` e `google/gemini-2.5-flash-lite` fanno 164/166.
- `nvidia/nemotron-3-nano-30b-a3b` fa 160/166.
- `openai/gpt-4.1-nano` fa 154/166.
- Il sistema *schema-completo* non arriva mai a 156/156 con nessun modello: sbaglia le pareti del
  caso "pareti e falda" dell'insieme `controllo`.
- I modelli con ragionamento obbligatorio (`gpt-oss`, `gpt-5-nano`/`mini`, `minimax`,
  `glm-5.3-flash`, `deepseek-r1`) rifiutano `reasoning` spento.

---

## 5. Rischi e limiti

- **StreamLake ha servito conversazioni altrui.** A raffiche, questo fornitore ha restituito la
  continuazione di conversazioni di altri utenti presa dalla sua cache dei prefissi (per esempio
  `{"suggestions":[…]}`). È escluso con `provider.ignore`. Il controllo di forma e il controllo
  sul nome cliente intercettano risposte di questo tipo e rifanno la richiesta. Se un altro
  fornitore mostra lo stesso difetto, va aggiunto a `ignore`.
- **`data_collection: "deny"`.** Nel testo ci sono i nomi dei clienti, quindi si usano solo
  fornitori che, secondo le politiche dichiarate a OpenRouter, non raccolgono i dati delle
  richieste (né conservazione né addestramento). Se cambi modello,
  verifica che abbia almeno un fornitore con questa politica, altrimenti OpenRouter non trova
  endpoint.
- **Fornitore unico.** `qwen3.8-flash` gira solo su Alibaba; `gpt-6-luna` su OpenAI e Azure.
  Se OpenAI e Azure cadono insieme, resta la sola Alibaba.
- **Campioni piccoli, nessuna garanzia statistica.** Zero errori su circa 60-70 estrazioni v2
  dicono, con la regola del tre, che il tasso d'errore reale è sotto il 5% circa al 95% di
  confidenza, non che è zero. I casi reali degli operatori vanno tenuti d'occhio e, se ne sbaglia
  uno, aggiunti agli insiemi.
- **429 a monte.** I fornitori economici rispondono spesso "rate-limited upstream". Il nuovo
  tentativo e la riserva in `models` li assorbono, ma sotto carico possono allungare i tempi.

---

## 6. Rieseguire la valutazione

```bash
node --env-file=.env.local --import tsx scripts/valuta-estrazione.ts \
  [--set sviluppo|controllo|avversari|tutti] [--modello a,b] [--ragionamento on|off] \
  [--ripetizioni N] [--fornitore slug] [--dettagli file.json]
```

Default: `--set tutti` (sviluppo, controllo e avversari: 20 casi, 135 controlli per
ripetizione) e `--ripetizioni 2`. Senza `--modello` / `--ragionamento` lo script usa la
configurazione dell'app (`OPENROUTER_MODEL`, poi i modelli di default; ragionamento acceso solo
con `OPENROUTER_REASONING=on`); `--modello` accetta un elenco separato da virgole, come
`OPENROUTER_MODEL`. `--fornitore` fissa il fornitore (`provider.only` con
`allow_fallbacks: false`; più slug separati da virgole) e serve a ripetere lo stadio 3 del §4.1.
`--dettagli` salva ogni estrazione con i suoi esiti e, per ogni chiamata, modello, fornitore e
costo.

Lo script stampa il punteggio per insieme e il totale, mediana e massimo dei tempi, il costo
totale e per estrazione (sommato su tutte le chiamate, compresi i nuovi tentativi), i modelli e i
fornitori che hanno risposto davvero e una riga `✗` per ogni estrazione con controlli falliti.
Esce con codice 1 se anche un solo controllo fallisce, 2 se le opzioni non sono valide o manca
`OPENROUTER_API_KEY`. Le estrazioni partono tutte in parallelo, come nelle misure del §4.

Il **costo** è di qualche centesimo per un giro completo con i modelli di default. La chiave
OpenRouter ha però un limite di spesa: controlla il credito residuo prima di lanciare molte
ripetizioni o molti modelli. Lo trovi nella pagina della chiave su openrouter.ai, oppure in
`limit_remaining` di `GET https://openrouter.ai/api/v1/key`.

Quando rifare la valutazione: se cambi prompt o esempi, se cambi lo strato deterministico, se
cambi i modelli, o se un fornitore cambia comportamento (errori nuovi nei log di
`/api/estrazione`).
