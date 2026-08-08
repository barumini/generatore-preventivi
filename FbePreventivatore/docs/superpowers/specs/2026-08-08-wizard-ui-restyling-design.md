# Restyling UI del wizard — Design

**Data:** 2026-08-08
**Stato:** approvato
**Committente:** FBE WoodLiving — tramite DIH Vicenza

---

## 1. Obiettivo

L'app funziona (chat di apertura, wizard a 5 step, preview A4 live, salvataggio bozza,
elenco preventivi, riapertura revisione) ma l'interfaccia del wizard è HTML/form senza
alcuno stile: nessun framework CSS è installato, a parte `print.css` che dà la cornice
A4 alla preview del documento.

Questo intervento porta il **flusso del wizard** (non l'intera app) a uno standard
visivo moderno, coerente con l'identità FBE (case in legno massiccio, artigianale,
filiera certificata).

---

## 2. Perimetro

**Dentro:**

- `ChatApertura.tsx` — apertura in linguaggio naturale
- `FormStrutturato.tsx` — i 5 step (Anagrafica, Configurazione, Geometria, Prezzi, Condizioni)
- `WizardConSalvataggio.tsx` — layout affiancato form/preview, bottone salva, stati di errore

**Fuori scope in questa fase** (restyling successivo, non decomposto qui):

- `documento/preview/Pagina*.tsx` e `print.css` — le pagine A4 devono restare fedeli
  al documento Word finale; non vanno "abbellite", sono l'anteprima di un output che
  esce identico in `.docx`
- `ElencoPreventivi` (`src/app/preventivi/page.tsx`)
- pagina di riapertura revisione (`src/app/preventivi/[id]/revisioni/[numero]/page.tsx`)

Nessuna modifica di logica: `stato-form.ts`, `domain/`, le chiamate API e la gestione
errori esistenti restano identiche. È restyling e riorganizzazione del markup dove
serve per applicare le classi — non un cambio di comportamento.

---

## 3. Stack tecnico

- **Tailwind CSS v4** — setup nativo Next 16 (App Router), configurazione dei design
  token via direttiva `@theme` in CSS, nessun `tailwind.config.js` separato
- **Inter** via `next/font/google`, applicato al chrome dell'app (nav, form, bottoni).
  **Non** dentro `.pagina-a4`, che resta `Georgia, serif` come oggi — è il font del
  documento finale, non del wizard
- **lucide-react** per le icone (frecce, spunte di stato, cestino "rimuovi riga",
  spinner di caricamento, dischetto "salva")

---

## 4. Design token

```
Fondo pagina        #FAF6F0   crema caldo
Superficie/card      #FFFFFF
Bordo                #E8DCC8
Accento primario     #8B5E34   marrone-ambra — bottoni, step attivo, focus ring
Accento hover        #6B4726
Testo primario       #2B2420   quasi-nero caldo
Testo secondario     #6B5A3F
Errore               #B3261E   avvisi di coerenza bloccanti, salvataggio fallito
Avviso               #9A6A00   avvisi di coerenza non bloccanti
```

Tipografia: Inter, pesi 400/500/600. Importi e superfici (mq, €) con
`font-variant-numeric: tabular-nums` per l'allineamento in colonna nelle tabelle di
riepilogo del form (es. lista sconti, override voci).

Palette e font valgono **solo per il chrome del wizard**; la preview A4 (§2, fuori
scope) resta con la sua identità visiva attuale.

---

## 5. Componenti UI condivisi

Nuova cartella `src/app/preventivi/ui/`. Le stesse pattern si ripetono identiche nei
5 step (label+input, label+select, riga con bottone "Rimuovi", raggruppamento con
titolo) — estrarre primitive evita di duplicare le stesse classi Tailwind decine di
volte tra i quattro file interessati:

| Componente | Sostituisce | Note |
|---|---|---|
| `Field` | `<label><input/></label>` grezzo | wrapper label+input/select, stato di errore opzionale |
| `Button` | `<button>` senza stile | varianti `primary` (accento pieno), `secondary` (outline), `ghost` (icona sola, es. rimuovi riga) |
| `StepTabs` | `<nav>` con `<button>` grezzi | barra a 5 tab pieni; step corrente evidenziato in accento, step visitati color bordo, cliccabili liberamente (comportamento invariato) |
| `Section` | `<fieldset><legend>` grezzo | card bianca con bordo e titolo maiuscolo piccolo, usata per ogni step e per i sotto-gruppi (es. "Superfici per piano", "Serramenti", "Sconti a cascata") |
| `Alert` | `<p role="alert">` grezzo | avvisi di coerenza e errore di salvataggio, varianti errore/avviso, icona coerente |

Ogni componente è un file `.tsx` isolato in `ui/`, senza dipendenze da `domain/` o
`server/` — riceve solo props primitive (value, onChange, label, error?, variant?).

---

## 6. Layout

- `WizardConSalvataggio`: due colonne — form ~55%, preview ~45%. La colonna preview è
  `sticky` rispetto allo scroll della pagina, così resta visibile mentre si scorre un
  form lungo (es. step Geometria con molte righe di serramenti)
- `ChatApertura`: card in evidenza sopra il wizard, textarea più ampia, stato di
  caricamento con icona spinner (lucide) al posto del solo testo "Sto leggendo..."
- Bottone "Salva bozza" ancorato in fondo alla colonna form (non in fondo pagina):
  resta raggiungibile senza scroll completo anche su step lunghi

Non è previsto un layout responsive per schermi stretti (mobile/tablet): è uno
strumento interno usato da commerciali al desktop, come l'app oggi. Se in futuro
servirà, si riprende dal layout affiancato con una soglia di breakpoint per impilare
le colonne (opzione valutata e scartata in fase di brainstorming per non introdurre
complessità non richiesta ora).

---

## 7. Cosa non cambia

- Nessuna nuova validazione, nessun nuovo stato, nessun cambio di comportamento nei
  15 campi/step esistenti
- Gli `avvisi di coerenza` (`verificaCoerenza`) restano identici nella logica; cambia
  solo la resa visiva tramite `Alert`
- Il salvataggio bozza (`salvaBozza` in `WizardConSalvataggio.tsx`) resta invariato:
  stessa chiamata `fetch`, stessi stati `inattivo | in-corso | errore`

---

## 8. Verifica

Restyling puro, non logica: nessun nuovo test automatico. Verifica manuale nel
browser di sviluppo:

1. Percorrere i 5 step con dati del golden case Crivellaro, controllare che form e
   preview restino sincronizzati come oggi
2. Verificare gli stati visivi: step attivo/visitato, campo con errore, bottone
   disabilitato durante il salvataggio, alert di errore dopo un salvataggio fallito
3. Confermare che il pannello preview mostri ancora esattamente i numeri del golden
   case (`docs/superpowers/specs/2026-08-04-fbe-preventivatore-design.md` §11):
   `PARZIALE 190 900,00` → `TOTALE 300 000,00`
4. `npm run typecheck` e `npm run test` (suite `domain/`) devono restare verdi:
   nessuna modifica al dominio, ma la riorganizzazione del markup non deve introdurre
   errori di tipo nelle props dei nuovi componenti `ui/`

---

## 9. Fuori scope

- Restyling di `ElencoPreventivi` e della pagina di riapertura revisione
- Qualsiasi modifica alla resa delle pagine A4 (`documento/preview/`)
- Layout responsive per schermi stretti
- Dark mode
- Libreria di componenti pre-costruiti (shadcn/ui o simili): i componenti in `ui/`
  sono scritti su misura, pochi e semplici, senza introdurre una dipendenza aggiuntiva
