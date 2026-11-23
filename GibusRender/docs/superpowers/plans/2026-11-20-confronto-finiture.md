# Variante consigliata e confronto delle finiture — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Badge "Consigliata" sulla variante migliore di ogni render e confronto di 2–6 finiture sulla stessa foto, con pagina dedicata e una scheda sola in archivio.

**Architecture:** Un confronto è un record `Comparison` che raggruppa render normali, uno per combinazione colore × tessuto, tutti creati con `createRender`. Le regole (consigliata, combinazioni, voci d'archivio, coda limitata) stanno in moduli puri testati; pagina del confronto e modulo usano quelli. Il render singolo non cambia, salvo la regola "una sola scelta per confronto".

**Tech Stack:** Next.js 16.2.11 (App Router), React 19, Prisma 7 su PostgreSQL, zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-confronto-finiture-design.md`

## Global Constraints

- Tutto in `GibusRender/`. Prima di scrivere codice Next.js leggere la guida pertinente in `node_modules/next/dist/docs/` (`AGENTS.md`: «This is NOT the Next.js you know»).
- Interfaccia e messaggi d'errore in italiano, nello stile di quelli esistenti.
- Combinazioni per confronto: minimo 2, massimo 6 (`MIN_COMBOS = 2`, `MAX_COMBOS = 6`).
- Varianti per finitura: 1–6, come oggi; il numero vale per ogni finitura.
- Coda della pagina del confronto: al massimo 4 richieste di generazione contemporanee (`MAX_PARALLEL = 4`).
- "Consigliata": solo con almeno 2 varianti `DONE` nel render; mai su una variante con un avviso o senza il punteggio usato.
- Nessun cambiamento a `DRIFT_ALTERED_THRESHOLD` (12) e `PLACEMENT_THRESHOLD` (0,25).
- Il render singolo (modulo, pagina, "Genera altre", "Riprova", download, "Duplica e modifica", eliminazione) deve funzionare come oggi: i test esistenti restano verdi.

## Review Focus

1. **Prodotto senza tessuti** (solo colori): il confronto si fa sui soli colori; l'elenco tessuti non compare; ogni render ha `fabricId = null`. → test in Task 2 (`finishCombos`).
2. **"Duplica e modifica" con il confronto acceso**: la foto viene dal render di partenza (`sourceRenderId`), non da un caricamento. → test in Task 3 (`createComparison` con `sourceRenderId`).
3. **Scelta dalla pagina del singolo render che fa parte di un confronto**: toglie la scelta agli altri render del confronto. → test in Task 4.
4. **Fornitore del confronto disabilitato nelle Impostazioni**: la pagina del confronto non lancia nulla e mostra l'avviso. → test in Task 6 (`planLaunch`).
5. **Render vecchi** (senza `driftScore` né `placementOffset`): nessun badge, nessun errore. → test in Task 1.

---

### Task 1: Variante consigliata

**Files:**
- Modify: `src/lib/render/variant-list.ts` (funzioni nuove e `variantFromJson`, `localVariantFailure` spostate qui)
- Modify: `src/app/render/[id]/VariantsView.tsx` (badge, prop `hasVolume`, usa le funzioni spostate)
- Modify: `src/app/render/[id]/page.tsx` (passa `hasVolume={volume !== undefined}`)
- Test: `tests/render/variant-list.test.ts`

**Interfaces:**
- Produces:
  - `recommendedVariant(variants: readonly VariantInfo[], opts: { hasVolume: boolean }): string | null`
  - `recommendationReason(hasVolume: boolean): string` — `"Nessun avviso e la più vicina al volume"` / `"Nessun avviso e la scena più fedele alla foto"`
  - `variantFromJson(json: unknown): VariantInfo | null` e `localVariantFailure(key: string, error: string): VariantInfo` (corpo identico agli attuali `fromJson`/`localFailure` di `VariantsView.tsx`)
  - Costante `RECOMMENDED = "Consigliata"`

- [ ] **Step 1: Test che falliscono** in `describe("recommendedVariant")`, con l'helper `v()` già presente:
  - con volume: `a` offset 0.12, `b` offset 0.08, `c` offset 0.30 → `"b"` (`c` è fuori posto).
  - senza volume: `a` drift 6.1, `b` drift 4.4 → `"b"`.
  - parità di punteggio → la più vecchia (`createdAt`, poi `id`).
  - esclusioni, ognuna in un caso che altrimenti vincerebbe: `protected: false`; `truncated: true`; drift 13 (alterata); offset 0.26; `stale: true`; `status: "FAILED"`.
  - con volume, `placementOffset: null` su una variante nuova → esclusa; senza volume, `driftScore: null` → esclusa.
  - una sola variante `DONE` (anche perfetta) → `null`.
  - tutte con avvisi → `null`.
  - render vecchio: 3 varianti `DONE` senza punteggi, `hasVolume: false` → `null`.
  - `variantFromJson` ritorna `null` su `{}` e su status sconosciuto; legge `placementOffset`.
- [ ] **Step 2:** `npx vitest run tests/render/variant-list.test.ts` → FAIL (funzioni non esportate).
- [ ] **Step 3:** Implementare in `variant-list.ts` usando `isSceneAltered` e `isMisplaced` (moduli puri, già importabili lato browser). Spostare `fromJson`/`localFailure` con i nuovi nomi e importarli in `VariantsView.tsx`.
- [ ] **Step 4:** `npx vitest run tests/render/variant-list.test.ts` → PASS.
- [ ] **Step 5:** In `VariantsView`: nuova prop `hasVolume: boolean`; `const recommendedId = recommendedVariant(<varianti visibili>, { hasVolume })`, ricalcolato a ogni render (si sposta mentre arrivano varianti); nella riga del titolo, prima di "Scelta", `<span className="badge badge-ok" title={recommendationReason(hasVolume)}>Consigliata</span>` se `v.id === recommendedId`. In `page.tsx` passare `hasVolume`.
- [ ] **Step 6:** `npm test && npm run lint` → tutto verde.
- [ ] **Step 7: Commit** `feat(gibus-render): badge "Consigliata" sulla variante migliore`

### Task 2: Combinazioni di finiture

**Files:**
- Create: `src/lib/render/combos.ts` (puro, usato da browser e server)
- Test: `tests/render/combos.test.ts`

**Interfaces:**
- Produces:
  - `type FinishCombo = { colorId: string | null; fabricId: string | null }`
  - `MIN_COMBOS = 2`, `MAX_COMBOS = 6`
  - `finishCombos(colorIds: readonly string[], fabricIds: readonly string[]): FinishCombo[]` — prodotto cartesiano nell'ordine colori × tessuti; elenco vuoto = `[null]`
  - `checkCombos(combos: readonly FinishCombo[]): string | null` — `null` se va bene, altrimenti il messaggio: sotto 2 `"Scegli almeno due finiture da confrontare, oppure spegni «Confronta più finiture»"`; sopra 6 `"Al massimo 6 finiture per confronto: ne hai scelte N"`; duplicati `"Finiture ripetute nel confronto"`
  - `parseCombos(raw: unknown): FinishCombo[]` — zod, lancia `Error("Finiture del confronto non valide")`

- [ ] **Step 1: Test che falliscono:** 2 colori × 2 tessuti → 4 combinazioni nell'ordine `[c1f1, c1f2, c2f1, c2f2]`; 3 colori × nessun tessuto → 3 con `fabricId: null` (Review Focus 1); nessun colore × 2 tessuti → 2 con `colorId: null`; `checkCombos` su 1, 7 e duplicati → i messaggi sopra; su 2 e 6 → `null`; `parseCombos` su `[{colorId:"a",fabricId:null}]` → ok, su `"x"` e su `[{colorId:1}]` → lancia.
- [ ] **Step 2:** `npx vitest run tests/render/combos.test.ts` → FAIL.
- [ ] **Step 3:** Implementare `combos.ts`.
- [ ] **Step 4:** `npx vitest run tests/render/combos.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(gibus-render): combinazioni di finiture per il confronto`

### Task 3: Modello `Comparison`, creazione e route `POST /api/confronti`

**Files:**
- Modify: `prisma/schema.prisma` (modello `Comparison`, `Render.comparisonId` come nella spec, sezione Dati)
- Create: migrazione `prisma/migrations/<timestamp>_comparison/` con `npx prisma migrate dev --name comparison` (DB locale da `.env`)
- Modify: `src/lib/render/generate.ts` (`CreateRenderInput` accetta `comparisonId: optionalId`, salvato sul render)
- Create: `src/lib/render/comparison.ts`
- Create: `src/app/api/confronti/route.ts`
- Test: `tests/render/comparison.test.ts` (stesso finto Prisma in memoria e finto storage di `tests/render/generate.test.ts`, esteso con `comparison`)

**Interfaces:**
- Consumes: `FinishCombo`, `checkCombos`, `parseCombos` (Task 2); `createRender`, `renderInputFromForm`, `RenderInputError` (esistenti); `deleteRender` (esistente, `src/lib/render/actions.ts`).
- Produces:
  - `createComparison(input: CreateRenderInput, combos: readonly FinishCombo[]): Promise<{ id: string; renderIds: string[] }>` in `comparison.ts`
  - Route `POST /api/confronti`: corpo multipart come `POST /api/renders` più `finishes` (JSON); risposta `{ id }`; stessi codici d'errore di `/api/renders` (413, 404, 400, 500).

- [ ] **Step 1: Test che falliscono:**
  - 3 combinazioni → 1 `Comparison` con `clientRef` dell'input e 3 render con `comparisonId` uguale, `colorId`/`fabricId` di ciascuna combinazione, ognuno con la propria `photoUrl`.
  - Il `prompt` di ogni render contiene il codice del proprio colore e **non** quello degli altri; un `prompt` nell'input viene ignorato.
  - Il primo render usa la foto caricata, gli altri `sourceRenderId` = id del primo (nessuna seconda normalizzazione).
  - Input con `sourceRenderId` e senza foto (Review Focus 2) → tutti i render hanno le dimensioni della foto del render di partenza.
  - Tutto o niente: con il secondo colore inesistente → lancia `RenderInputError("Colore non trovato")`, nello store non restano render né `Comparison` e i file del primo render sono stati cancellati.
  - `checkCombos` che fallisce → `RenderInputError` con il suo messaggio, nessuna scrittura.
  - Route: `finishes` mancante o non valido → 400 `"Finiture del confronto non valide"`; fornitore non abilitato → 400; caso valido → 200 con `{ id }`.
- [ ] **Step 2:** `npx vitest run tests/render/comparison.test.ts` → FAIL.
- [ ] **Step 3:** Schema e migrazione; `npx prisma generate`. Aggiungere `comparisonId` a `CreateRenderInput` e a `db.render.create`.
- [ ] **Step 4:** Implementare `createComparison`: controlla `checkCombos`; crea `Comparison`; crea i render in sequenza (`prompt: undefined`, poi `photo: undefined, sourceRenderId: first.id` dal secondo in poi); in caso di errore chiama `deleteRender` su ogni render creato, elimina il `Comparison` con `deleteMany` (dopo il Task 4 `deleteRender` può averlo già sciolto) e rilancia.
- [ ] **Step 5:** Implementare la route sul modello di `src/app/api/renders/route.ts`: stessi controlli (lunghezza del corpo, impostazioni, fornitore abilitato), `parseCombos(JSON.parse(form.get("finishes")))` con errore 400.
- [ ] **Step 6:** `npx vitest run tests/render/comparison.test.ts` → PASS; `npm test` → tutto verde.
- [ ] **Step 7: Commit** `feat(gibus-render): confronto di finiture, modello e creazione`

### Task 4: Scelta esclusiva ed eliminazione nel confronto

**Files:**
- Modify: `src/lib/render/actions.ts`
- Create: `src/components/DeleteComparisonButton.tsx` (come `DeleteRenderButton`)
- Test: `tests/render/actions.test.ts` (finto Prisma esteso con `comparison`, `render.updateMany`, `render.findMany`, `$transaction` su array)

**Interfaces:**
- Produces:
  - `chooseVariant(renderId, variantId)` — firma invariata; se il render ha `comparisonId`, in una `db.$transaction([...])` azzera `chosenVariantId` degli altri render del confronto e imposta quello scelto; `revalidatePath` anche di `/confronto/<id>`.
  - `deleteRender(renderId)` — firma invariata; dopo l'eliminazione, se il confronto ha 1 render lo scioglie (`comparisonId = null` sul rimasto, elimina il `Comparison`), se ne ha 0 elimina il `Comparison`.
  - `deleteComparison(comparisonId: string): Promise<ActionResult>` — elimina tutti i render (foto e varianti, con `removeFiles`) e il `Comparison`; revalida `/`.

- [ ] **Step 1: Test che falliscono:**
  - Confronto con `r1` (scelta `v1`) e `r2`: `chooseVariant("r2","v2")` → `r2.chosenVariantId = "v2"`, `r1.chosenVariantId = null` (Review Focus 3).
  - Render senza confronto: la scelta non tocca gli altri render (comportamento di oggi).
  - Confronto di 3 render: elimino `r1` → il confronto resta con 2; elimino anche `r2` → `r3.comparisonId = null` e `Comparison` eliminato.
  - `deleteComparison` → nessun render né variante né `Comparison` restano; cancellati foto e immagini di tutti; un file che non si cancella non blocca.
  - `deleteComparison("inesistente")` → `{ ok: false, error: "Confronto non trovato" }`.
- [ ] **Step 2:** `npx vitest run tests/render/actions.test.ts` → FAIL.
- [ ] **Step 3:** Implementare; `DeleteComparisonButton` con il testo di conferma `Eliminare il confronto "<clientRef>" con tutte le sue N finiture, le varianti e le foto? Non si può annullare.`
- [ ] **Step 4:** `npx vitest run tests/render/actions.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(gibus-render): una sola scelta per confronto ed eliminazione del confronto`

### Task 5: Modulo "Nuovo render" con "Confronta più finiture"

**Files:**
- Create: `src/app/nuovo/FinishChecklist.tsx` (elenco a caselle con campione `swatchHex`)
- Modify: `src/app/nuovo/NewRenderForm.tsx` (passo 4 Finiture, stima del costo, passo Prompt, `validate`, `onGenerate`)

**Interfaces:**
- Consumes: `finishCombos`, `checkCombos`, `MAX_COMBOS` (Task 2); `POST /api/confronti` (Task 3).
- Produces: `FinishChecklist({ label, finishes, selected, onChange }: { label: string; finishes: FinishInfo[]; selected: string[]; onChange(ids: string[]): void })`.

- [ ] **Step 1:** Stato nuovo: `compareOn: boolean` (false; resta false anche con `draft`), `colorIds: string[]`, `fabricIds: string[]`. Accendendo, si pre-seleziona il colore e il tessuto correnti; cambiando prodotto si azzerano come oggi `colorId`/`fabricId`.
- [ ] **Step 2:** Passo 4: interruttore `Confronta più finiture`; acceso → due `FinishChecklist` (tessuti solo se `fabrics.length > 0`) e sotto `N finiture: <elenco nomi>`; spento → i due `<select>` di oggi invariati.
- [ ] **Step 3:** Stima del costo: con confronto acceso `estimateCost(..., variantsN * combos.length)` e la dicitura `N finiture × V varianti = T immagini`.
- [ ] **Step 4:** Passo Prompt con confronto acceso: niente "Modifica"; anteprima del testo della prima combinazione e la nota `Ogni finitura riceve il proprio testo, uguale salvo colore e tessuto.` Se `manualPrompt !== null`, accendere chiede `window.confirm("Il testo modificato a mano verrà scartato: ogni finitura riceve il proprio testo automatico. Continuare?")`; se annullato resta spento.
- [ ] **Step 5:** `validate`: con confronto acceso aggiungere `checkCombos(combos)`. `onGenerate`: con confronto acceso stessi campi di oggi senza `prompt`, `colorId`, `fabricId`, più `finishes = JSON.stringify(combos)`, `POST /api/confronti`, poi `router.push(`/confronto/${id}?avvia=1`)`. Spento: invariato.
- [ ] **Step 6:** `npm run lint && npm test` → verde.
- [ ] **Step 7: Commit** `feat(gibus-render): scelta di più finiture nel nuovo render`

### Task 6: Pagina `/confronto/[id]`

**Files:**
- Create: `src/lib/render/queue.ts` (puro)
- Create: `src/app/confronto/[id]/page.tsx` (server)
- Create: `src/app/confronto/[id]/ComparisonView.tsx` (client)
- Modify: `src/app/render/[id]/page.tsx` (riga "Fa parte di un confronto di N finiture" con link)
- Modify: `src/app/globals.css` (colonne affiancate, una sotto l'altra sotto i 900 px, colonna scelta evidenziata)
- Test: `tests/render/queue.test.ts`

**Interfaces:**
- Consumes: `recommendedVariant`, `recommendationReason`, `variantFromJson`, `localVariantFailure`, `VariantInfo` (Task 1); `chooseVariant`, `deleteComparison`, `DeleteComparisonButton` (Task 4); `disabledProviderMessage`, `isStale`, `estimateCost`, route di download esistenti.
- Produces:
  - `MAX_PARALLEL = 4`
  - `type ColumnState = { renderId: string; requested: number; existing: number }`
  - `planLaunch(columns: readonly ColumnState[], opts: { providerDisabled: boolean; mode: "start" | "missing" }): string[]` — lista di `renderId`, uno per variante da lanciare, alternando le colonne (round-robin) così le finiture avanzano insieme; `"start"` → `requested` per colonna; `"missing"` → `max(0, requested - existing)`; `providerDisabled` → `[]`.
  - `runLimited<T>(tasks: readonly (() => Promise<T>)[], limit: number): Promise<T[]>`

- [ ] **Step 1: Test che falliscono:** `planLaunch` con colonne `a`(3) e `b`(2) in `"start"` → `["a","b","a","b","a"]`; in `"missing"` con `existing` 3 e 0 → `["b","b"]`; `providerDisabled: true` → `[]` (Review Focus 4). `runLimited` con 10 compiti e limite 4 → mai più di 4 in corso (contatore nei compiti), risultati nell'ordine dei compiti, un compito che rifiuta non ferma gli altri.
- [ ] **Step 2:** `npx vitest run tests/render/queue.test.ts` → FAIL.
- [ ] **Step 3:** Implementare `queue.ts`.
- [ ] **Step 4:** `npx vitest run tests/render/queue.test.ts` → PASS.
- [ ] **Step 5:** `page.tsx`: carica il `Comparison` con i render (ordine `createdAt`, poi `id`), le finiture e le varianti; `notFound()` se manca; calcola `isStale` sul server e `providerDisabled` dal fornitore del primo render; passa dati semplici al client. Intestazione: `clientRef`, `<prodotto> · N finiture · <data>`, "Scarica la scelta" (link a `/api/variants/<id>/download`, disabilitato senza scelta), `DeleteComparisonButton` con `redirectTo="/"`.
- [ ] **Step 6:** `ComparisonView`: una colonna per render con campioni e nomi di colore/tessuto (`Nessun colore`/`Nessun tessuto` se null), schede variante con immagine (clic → ingrandimento a schermo intero), stessi badge di `VariantsView` più "Consigliata" per colonna, "Scegli" (chiama `chooseVariant`, aggiorna la scelta su tutte le colonne), "Apri render" (nuova scheda mentre la coda non è vuota). Con `?avvia=1`: `planLaunch(..., "start")` + `runLimited(..., MAX_PARALLEL)` con `POST /api/renders/<id>/variants` e `variantFromJson`, una sola volta, poi toglie il parametro con `router.replace` come `VariantsView`. Segnaposto per le richieste in coda o in corso. Con coda non vuota: `beforeunload` attivo. Senza richieste in corso e con varianti mancanti: pulsante `Genera le mancanti (N)` con il costo stimato. Fornitore disabilitato: l'avviso di `VariantsView` e nessun lancio.
- [ ] **Step 7:** In `src/app/render/[id]/page.tsx`, se `render.comparisonId`: sotto il titolo `Fa parte di un confronto di N finiture` con link a `/confronto/<id>`.
- [ ] **Step 8:** `npm test && npm run lint && npm run build` → verde.
- [ ] **Step 9: Commit** `feat(gibus-render): pagina del confronto delle finiture`

### Task 7: Archivio con una scheda per confronto

**Files:**
- Modify: `src/lib/render/variant-list.ts` (funzione pura `archiveEntries`)
- Modify: `src/app/page.tsx`
- Test: `tests/render/variant-list.test.ts`

**Interfaces:**
- Produces:
  - `type ArchiveRow = { id: string; comparisonId: string | null; createdAt: Date }`
  - `type ArchiveEntry = { kind: "render"; renderId: string } | { kind: "comparison"; comparisonId: string; renderIds: string[] }`
  - `archiveEntries(rows: readonly ArchiveRow[]): ArchiveEntry[]` — righe già in ordine `createdAt` decrescente; un confronto compare una volta, nella posizione della sua riga più recente, con tutti i suoi `renderIds`.

- [ ] **Step 1: Test che falliscono:** righe `[r5(c1), r4, r3(c1), r2(c2), r1]` → `[comparison c1 [r5,r3], render r4, comparison c2 [r2], render r1]`; nessun confronto → una voce per render, stesso ordine.
- [ ] **Step 2:** `npx vitest run tests/render/variant-list.test.ts` → FAIL.
- [ ] **Step 3:** Implementare `archiveEntries`.
- [ ] **Step 4:** `npx vitest run tests/render/variant-list.test.ts` → PASS.
- [ ] **Step 5:** `page.tsx`: leggere tutte le righe che corrispondono alla ricerca con solo `id, comparisonId, createdAt` (ordine `createdAt desc, id desc`); `archiveEntries`; paginare le voci (30 per pagina, `clampPage`); caricare i dettagli solo dei render della pagina. Scheda confronto: miniatura della variante scelta in uno qualsiasi dei suoi render, altrimenti `archiveThumbnail` del primo render del confronto; `clientRef`; `Confronto · N finiture` e il prodotto; badge "Scelta" se c'è; link a `/confronto/<id>`; `DeleteComparisonButton small`. Schede render: invariate.
- [ ] **Step 6:** `npm test && npm run lint && npm run build` → verde.
- [ ] **Step 7: Commit** `feat(gibus-render): archivio con una scheda per confronto`

### Task 8: Verifica finale e documentazione

**Files:**
- Modify: `README.md` (sezione Uso: "Variante consigliata" e "Confronto delle finiture", due paragrafi brevi)

- [ ] **Step 1:** `npm test && npm run lint && npm run build` → tutto verde.
- [ ] **Step 2:** Server locale (`preview_start` con `gibusrender-dev`, porta 3110): render singolo invariato (crea, apri, scegli, duplica); confronto di 2 finiture creato dal modulo; pagina con 2 colonne; "Scegli" esclusivo tra colonne e dalla pagina del render; archivio con una scheda; "Elimina confronto". Senza generazioni reali (fornitore senza chiave o generazioni fallite vanno bene per la struttura).
- [ ] **Step 3:** Solo con il via dell'utente: confronto reale 2 finiture × 2 varianti con `blackforestlabs/flux-3/klein/edit-image` via fal.ai (circa 0,04 $); controllare badge "Consigliata" e scelta.
- [ ] **Step 4:** Aggiornare il README e fare il commit `docs(gibus-render): variante consigliata e confronto delle finiture`.
