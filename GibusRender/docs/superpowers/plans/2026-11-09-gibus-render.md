# GibusRender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app online che inserisce con l'IA una pergola Gibus del catalogo in una foto di sopralluogo, protegge la casa del cliente tramite ricomposizione con maschera e restituisce varianti tra cui scegliere.

**Architecture:** Next.js (App Router) indipendente in `GibusRender/`. Il catalogo, i render e le impostazioni stanno in Postgres (Prisma); i file stanno in Vercel Blob, con un ripiego su disco in sviluppo. Il cuore è una pipeline pura e testabile: maschera dal poligono, adattamento della foto alle dimensioni del fornitore, prompt, chiamata all'adattatore del fornitore, ritorno alle dimensioni originali e ricomposizione. Ogni variante è una richiesta HTTP separata.

**Tech Stack:** Next.js 16.2.11, React 19.2.4, TypeScript 5, Prisma 7.9 + `@prisma/adapter-pg` + `pg` (Postgres/Neon), `@vercel/blob` 2.x, `sharp` 0.35, `openai` 7.x (SDK), `fetch` per OpenRouter, `heic2any` (browser), `zod` 4, Vitest 4. Estrazione una tantum delle immagini dai PDF con Python + PyMuPDF (già installato sulla macchina di sviluppo).

**Spec:** `GibusRender/docs/superpowers/specs/2026-11-09-gibus-render-design.md`

## Global Constraints

- Progetto indipendente: tutto vive in `GibusRender/`, con il proprio `package.json`; nessun import da `GeneratorePreventivi/` o `FbePreventivatore/`.
- Interfaccia in italiano (testi, errori, etichette).
- Chiavi API solo in variabili d'ambiente: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`; mai nel codice, nel database o nel repository. `.env.local` in `.gitignore`.
- Accesso protetto da password: Basic Auth tramite `src/proxy.ts`, utenti da `BASIC_AUTH_USERS` (formato `utente:password,utente2:password2`); senza variabile → 503 in produzione, libero in sviluppo.
- Variabili richieste: `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN` (facoltativa in sviluppo: senza, file in `GibusRender/.data/`), `BASIC_AUTH_USERS`.
- Varianti predefinite: 3. Uscita: JPG qualità 92 alla risoluzione della foto originale (dopo la normalizzazione di Task 4). Dicitura "Immagine a titolo esemplificativo" facoltativa, disattivata di default.
- Con la sagoma, i pixel fuori dalla maschera allargata devono essere **identici** all'originale normalizzato. Senza sagoma la variante va marcata `protected: false` e l'interfaccia mostra "Casa non protetta: verificare che nulla sia cambiato".
- Allargamento della maschera: 2% della diagonale della foto (minimo 8 px); sfumatura del bordo **solo verso l'interno** della maschera allargata, pari a metà dell'allargamento.
- Durata massima della route di generazione: `export const maxDuration = 300`.

## Review Focus

1. **Foto da smartphone ruotate (EXIF orientation)**: dopo il caricamento la foto deve apparire dritta e la sagoma deve allinearsi. Test in Task 4 (`normalizePhoto` applica la rotazione EXIF e restituisce w/h già ruotati).
2. **Foto pesanti (12+ MP, oltre 4,5 MB)**: Vercel rifiuta corpi delle richieste oltre 4,5 MB, quindi il browser ridimensiona a lato lungo 3000 px, JPEG q 0.9, prima del caricamento. Test in Task 9 (`computeUploadSize`).
3. **Il fornitore restituisce dimensioni o proporzioni diverse**: la variante deve allinearsi comunque alla foto. Test in Task 4 (`fromProviderSize` + `composite` con un'immagine generata 1536×1024 su una foto 4000×3000).
4. **Sagoma non valida**: meno di 3 punti, punti fuori dalla foto. L'app deve rifiutare o correggere invece di generare una maschera vuota. Test in Task 3 (`validatePolygon`).
5. **Una variante fallisce** (timeout, contenuto rifiutato, chiave mancante): le altre proseguono e quella fallita mostra un messaggio in italiano con "Riprova". Test in Task 7 (`generateVariant` registra `FAILED` + `error`).

---

## File Structure

```
GibusRender/
  package.json, tsconfig.json, next.config.ts, vitest.config.ts, vercel.json, .gitignore, .env.example, README.md
  prisma/schema.prisma            # modelli dati
  prisma/seed.ts                  # catalogo iniziale
  seed/extract_references.py      # una tantum: PDF → PNG ritagliati
  seed/images/*.png               # riferimenti estratti (committati)
  src/proxy.ts                    # Basic Auth
  src/lib/db.ts                   # client Prisma
  src/lib/storage.ts              # putFile/getFile (Blob o disco)
  src/lib/catalog/types.ts        # enum ed etichette italiane
  src/lib/catalog/actions.ts      # server actions CRUD catalogo
  src/lib/render/geometry.ts      # Point, validatePolygon, scala
  src/lib/render/mask.ts          # polygonToMask, dilatazione
  src/lib/render/image.ts         # normalizePhoto, toProviderSize, fromProviderSize, composite, addDisclaimer
  src/lib/render/prompt.ts        # buildPrompt
  src/lib/render/cost.ts          # estimateCost
  src/lib/render/generate.ts      # generateVariant (orchestrazione)
  src/lib/providers/types.ts      # ImageProvider, GenerateInput, ProviderError
  src/lib/providers/openai.ts
  src/lib/providers/openrouter.ts
  src/lib/providers/registry.ts   # elenco fornitori, configurati/abilitati
  src/lib/settings.ts             # getSettings/updateSettings
  src/app/layout.tsx, globals.css
  src/app/page.tsx                # archivio render
  src/app/nuovo/page.tsx + NewRenderForm.tsx + PolygonEditor.tsx + ScaleLineEditor.tsx + upload.ts
  src/app/render/[id]/page.tsx + VariantsView.tsx + BeforeAfter.tsx
  src/app/catalogo/page.tsx, catalogo/[id]/page.tsx, catalogo/finiture/page.tsx
  src/app/impostazioni/page.tsx
  src/app/api/files/[...path]/route.ts      # serve .data in sviluppo
  src/app/api/renders/route.ts              # POST crea render
  src/app/api/renders/[id]/variants/route.ts # POST genera una variante
  src/app/api/variants/[id]/download/route.ts
  tests/...                                  # specchio di src/lib
```

---

### Task 1: Scaffolding, Basic Auth, storage

**Files:**
- Create: `GibusRender/package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `vercel.json`, `.gitignore`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (segnaposto "Archivio render"), `src/proxy.ts`, `src/lib/storage.ts`
- Test: `tests/proxy.test.ts`, `tests/storage.test.ts`

**Interfaces:**
- Produces: `putFile(key: string, data: Buffer, contentType: string): Promise<string>` (restituisce un URL usabile in `<img>`); `getFile(url: string): Promise<Buffer>`; `checkBasicAuth(header: string | null, usersEnv: string | undefined, isProd: boolean): "ok" | "unauthorized" | "misconfigured"`.

- [ ] **Step 1:** Crea il progetto Next con `npx create-next-app@16.2.11 GibusRender --ts --app --src-dir --eslint --no-tailwind --import-alias "@/*"` dalla radice del repository; aggiungi le dipendenze `@prisma/client@^7.9 @prisma/adapter-pg@^7.9 prisma@^7.9 pg @vercel/blob@^2 sharp@^0.35 openai@^7 zod@^4 heic2any` e le dev `vitest@^4 @types/pg tsx`. Script: `"test": "vitest run"`, `"postinstall": "prisma generate"`, `"db:seed": "tsx prisma/seed.ts"`. `.gitignore` include `.env*.local`, `.data/`.
- [ ] **Step 2: Test che falliscono** in `tests/proxy.test.ts`:
  - `checkBasicAuth(null, "a:b", true) === "unauthorized"`
  - `checkBasicAuth("Basic " + btoa("a:b"), "a:b,c:d", true) === "ok"`
  - `checkBasicAuth("Basic " + btoa("c:x"), "a:b,c:d", true) === "unauthorized"`
  - `checkBasicAuth(null, undefined, true) === "misconfigured"`; `checkBasicAuth(null, undefined, false) === "ok"`
  - password contenente `:` (`"a:b:c"` → utente `a`, password `b:c`) → `"ok"`.
  
  In `tests/storage.test.ts` (senza `BLOB_READ_WRITE_TOKEN`): `putFile("t/x.txt", Buffer.from("ciao"), "text/plain")` restituisce `"/api/files/t/x.txt"` e `getFile` di quell'URL restituisce `"ciao"`.
- [ ] **Step 3:** Esegui `npm test`: FAIL (moduli mancanti).
- [ ] **Step 4:** Implementa `checkBasicAuth` (esportata da `src/proxy.ts`, confronto a tempo costante) e il `proxy` che risponde 401 con `WWW-Authenticate: Basic realm="GibusRender"` o 503 "Accesso non configurato". In `storage.ts`, con token usa `put(key, data, { access: "public", contentType, addRandomSuffix: true })` di `@vercel/blob` e `fetch` per `getFile`; senza token scrive in `.data/<key>`. Crea `src/app/api/files/[...path]/route.ts`, che serve `.data/` solo se il token manca e blocca `..` nel percorso.
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → completato.
- [ ] **Step 6:** Commit `feat(gibus-render): scaffolding, Basic Auth e storage`.

### Task 2: Modello dati e catalogo iniziale

**Files:**
- Create: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/db.ts`, `src/lib/catalog/types.ts`, `seed/extract_references.py`, `seed/images/*.png`, `prisma/seed.ts`
- Test: `tests/catalog/seed-data.test.ts`

**Interfaces:**
- Produces (Prisma, usati da tutti i task successivi):
  - `enum MountType { ADDOSSATA AUTOPORTANTE }`, `enum CoverType { TELO LAMELLE_ORIENTABILI LAMELLE_IMPACCHETTAMENTO }`, `enum FinishKind { COLORE TESSUTO }`, `enum VariantStatus { PENDING DONE FAILED }`
  - `Product { id, name, mountType, coverType, aiDescription, widthMm, depthMm, clearHeightMm, totalHeightMm, defaultColorId?, defaultFabricId?, references ReferenceImage[], finishes ProductFinish[], createdAt, updatedAt }`
  - `ReferenceImage { id, productId, url, label, sortOrder }`
  - `Finish { id, kind, name, code, swatchHex? }`; `ProductFinish { productId, finishId }` (chiave composta)
  - `Render { id, clientRef, photoUrl, photoWidth, photoHeight, productId? (onDelete: SetNull), productName, widthMm, depthMm, clearHeightMm, totalHeightMm, colorId?, fabricId?, polygon Json?, positionText, scaleLine Json?, prompt, providerId, model, quality, variantsRequested, disclaimer Boolean @default(false), chosenVariantId?, createdAt }`
  - `Variant { id, renderId, status, imageUrl?, protected Boolean, error?, createdAt }`
  - `Settings { id Int @id @default(1), activeProviderId, activeModel, quality, enabledProviders String[], defaultVariants Int @default(3) }`
  - `src/lib/db.ts`: `export const db: PrismaClient` (singleton con `PrismaPg`).
  - `src/lib/catalog/types.ts`: `MOUNT_LABELS`, `COVER_LABELS`: `Record<…, string>` in italiano; `SEED_PRODUCTS: SeedProduct[]` (dati puri usati da `seed.ts` e dal test).

- [ ] **Step 1:** Scrivi `seed/extract_references.py` (eseguito con `python3 -I seed/extract_references.py <cartella_esempi> seed/images`). Per ogni PDF rasterizza a 200 dpi le pagine "VISTA 3D", "VISTA FRONTALE" e "VISTA IN PIANTA", individuate cercando il testo nella pagina, e ritaglia la fascia verticale tra il 19% e il 94% dell'altezza per togliere intestazione, logo e nota a piè di pagina. Per `sabrina.pdf` divide ogni pagina a metà larghezza (sinistra = prodotto 3, destra = prodotto 4). Rifila i margini bianchi. Nomi dei file: `p<N>-3d.png`, `p<N>-frontale.png`, `p<N>-pianta.png`. Esegui lo script su `/Users/matteopisanu/ClaudeCode/Crocco/esempi` e controlla a vista le 12 immagini.
- [ ] **Step 2: Test che fallisce** `tests/catalog/seed-data.test.ts`: `SEED_PRODUCTS` ha 4 prodotti con esattamente questi valori:

  | name | mount | cover | L | P | h sotto trave | h totale | ref |
  |---|---|---|---|---|---|---|---|
  | `ZENIT – Addossata frontale` | ADDOSSATA | TELO | 4200 | 3800 | 2400 | 2746 | p1 |
  | `Lamella Compact` | AUTOPORTANTE | LAMELLE_ORIENTABILI | 3000 | 3080 | 2400 | 2550 | p2 |
  | `Bioclima Orient` | AUTOPORTANTE | LAMELLE_ORIENTABILI | 4000 | 5000 | 2400 | 2650 | p3 |
  | `Bioclima Pack` | AUTOPORTANTE | LAMELLE_IMPACCHETTAMENTO | 4000 | 4900 | 2400 | 2650 | p4 |

  Ogni prodotto ha 3 riferimenti, e ogni file esiste in `seed/images/`. Le finiture seed sono `{COLORE, "Antracite RAL 7016 sablé", "RAL 7016", "#383E42"}` e `{TESSUTO, "Opatex Pro/Opatex Decò OP 272", "OP 272"}`. Lo ZENIT ha come predefiniti entrambe le finiture, gli altri solo il colore. Ogni `aiDescription` è lunga almeno 200 caratteri e contiene il numero dei montanti.
- [ ] **Step 3:** `npm test`: FAIL.
- [ ] **Step 4:** Scrivi lo schema, `db.ts`, `types.ts` con `SEED_PRODUCTS` e `prisma/seed.ts`, che è idempotente (upsert per nome) e carica i PNG con `putFile("references/…")`. Le `aiDescription` sono in inglese e si ricavano dai disegni. ZENIT: addossata alla parete, 2 montanti frontali a sezione quadrata, trave frontale piatta, copertura a telo teso con frangitratta, profili lisci. Lamella Compact: 4 montanti, telaio perimetrale, lamelle in alluminio parallele al lato corto. Bioclima Orient: 4 montanti, lamelle orientabili su tutta la profondità. Bioclima Pack: 4 montanti, lamelle raccolte a pacco su un lato, resto aperto.
- [ ] **Step 5:** `npm test` → PASS; `npx prisma migrate dev --name init` su un Postgres di sviluppo, poi `npm run db:seed` due volte → 4 prodotti, nessun duplicato.
- [ ] **Step 6:** Commit `feat(gibus-render): modello dati e catalogo iniziale dai PDF di esempio`.

### Task 3: Geometria e maschera

**Files:**
- Create: `src/lib/render/geometry.ts`, `src/lib/render/mask.ts`
- Test: `tests/render/geometry.test.ts`, `tests/render/mask.test.ts`

**Interfaces:**
- Produces:
  - `type Point = { x: number; y: number }`: coordinate normalizzate 0..1 rispetto alla foto normalizzata.
  - `type ScaleLine = { a: Point; b: Point; lengthMm: number }`
  - `validatePolygon(points: Point[]): { ok: true; points: Point[] } | { ok: false; error: string }`: almeno 3 punti, coordinate limitate a [0,1], area > 0,1% della foto.
  - `dilationPx(width: number, height: number): number`: `max(8, round(0.02 * hypot(w, h)))`.
  - `polygonToMask(points: Point[], width: number, height: number): Promise<Buffer>`: PNG in scala di grigi, 255 dentro la maschera allargata e 0 fuori (bordo netto).
  - `featheredAlpha(mask: Buffer, width: number, height: number): Promise<Buffer>`: alfa grezzo a 1 canale, 255 nel nucleo, rampa lineare verso 0 solo dentro la fascia di allargamento, 0 ovunque fuori dalla maschera allargata.

- [ ] **Step 1: Test che falliscono**
  - `validatePolygon([{x:0,y:0},{x:1,y:1}])` → `ok:false`, errore `"La sagoma deve avere almeno 3 punti"`.
  - Punti `{x:-0.2,y:1.3}` → ricondotti a `{x:0,y:1}`.
  - Tre punti quasi allineati (area 0) → `ok:false`, `"La sagoma è troppo piccola"`.
  - `dilationPx(4000,3000) === 100`; `dilationPx(200,100) === 8`.
  - `polygonToMask` di un quadrato `(0.25,0.25)–(0.75,0.75)` su 400×400: il pixel (200,200) vale 255, il pixel (5,5) vale 0, il pixel (95,200), cioè 5 px fuori dal quadrato e dentro l'allargamento di 8 px, vale 255.
  - `featheredAlpha` dello stesso caso: (200,200) = 255; (5,5) = 0; ogni pixel con maschera = 0 ha alfa = 0.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa. La maschera si ottiene disegnando il poligono come SVG, rasterizzandolo con `sharp` e allargandolo con `sharp().dilate(dilationPx)` (sharp ≥ 0.34 offre `dilate`). L'alfa sfumato si ottiene così: si erode la maschera allargata di `dilationPx/2`, si applica una sfocatura gaussiana di sigma `dilationPx/4` e si moltiplica il risultato per la maschera allargata binaria, in modo da garantire 0 fuori.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(gibus-render): sagoma, maschera allargata e sfumatura interna`.

### Task 4: Trattamento immagini e ricomposizione

**Files:**
- Create: `src/lib/render/image.ts`
- Test: `tests/render/image.test.ts`

**Interfaces:**
- Consumes: `featheredAlpha` (Task 3).
- Produces:
  - `normalizePhoto(input: Buffer): Promise<{ jpeg: Buffer; width: number; height: number }>`: applica la rotazione EXIF, toglie i metadati, porta il lato lungo a massimo 3000 px e restituisce JPEG q92.
  - `type ProviderSize = { width: number; height: number }`
  - `pickProviderSize(w: number, h: number, supported: ProviderSize[]): ProviderSize`: sceglie la dimensione con le proporzioni più vicine.
  - `toProviderSize(img: Buffer, size: ProviderSize): Promise<Buffer>`: `resize(..., { fit: "fill" })` in PNG.
  - `fromProviderSize(img: Buffer, width: number, height: number): Promise<Buffer>`: `fit: "fill"` di ritorno alle dimensioni della foto.
  - `composite(original: Buffer, generated: Buffer, mask: Buffer, width: number, height: number): Promise<Buffer>`: risultato JPEG q92, `original*(1-α) + generated*α`.
  - `addDisclaimer(jpeg: Buffer, width: number, height: number): Promise<Buffer>`: testo `"Immagine a titolo esemplificativo"` in basso a destra, bianco con ombra, altezza pari al 2% dell'altezza della foto.

- [ ] **Step 1: Test che falliscono**
  - JPEG 400×300 con EXIF orientation 6 → `normalizePhoto` restituisce `width 300, height 400`.
  - JPEG 6000×4000 → `width 3000, height 2000`.
  - `pickProviderSize(4000,3000,[1024²,1536×1024,1024×1536])` → `1536×1024`; `(3000,4000)` → `1024×1536`.
  - **Pixel identici fuori**: originale 4000×3000 con rumore casuale, generata 1536×1024 tutta rossa, sagoma = rettangolo centrale. Si chiama `fromProviderSize` e poi `composite`. Per evitare le perdite del JPEG il test usa una variante interna `compositeRaw`, che restituisce il buffer grezzo. Atteso: tutti i pixel con maschera = 0 sono byte per byte uguali all'originale; il pixel al centro è rosso.
  - `addDisclaimer` non cambia le dimensioni.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa con `sharp`. `composite` delega a `compositeRaw(original, generated, mask, w, h): Promise<Buffer>` (raw RGB, esportata per i test) e poi codifica in JPEG. La miscelazione si fa in TypeScript sul buffer grezzo, pixel per pixel; non usare `sharp().composite`, che non garantisce l'identità esatta dei pixel.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(gibus-render): normalizzazione foto e ricomposizione che preserva la casa`.

### Task 5: Prompt e stima dei costi

**Files:**
- Create: `src/lib/render/prompt.ts`, `src/lib/render/cost.ts`
- Test: `tests/render/prompt.test.ts`, `tests/render/cost.test.ts`

**Interfaces:**
- Produces:
  - `type PromptInput = { product: { name: string; mountType: MountType; coverType: CoverType; aiDescription: string }; dims: { widthMm: number; depthMm: number; clearHeightMm: number; totalHeightMm: number }; color?: { name: string; code: string }; fabric?: { name: string; code: string }; positionText: string; hasMask: boolean; scale?: { lengthMm: number; pixelLength: number; photoWidth: number } ; referenceCount: number }`
  - `buildPrompt(input: PromptInput): string`
  - `estimateCost(providerId: string, model: string, quality: string, variants: number): { eur: number } | null`: tabella prezzi statica in `cost.ts`; restituisce `null` per i modelli sconosciuti (l'interfaccia mostra "Stima non disponibile").

- [ ] **Step 1: Test che falliscono.** Per lo ZENIT 4200×3800, h 2400/2746, RAL 7016, OP 272, testo "addossata alla parete a destra" e `hasMask: true`, il prompt contiene:
  - `"4200 mm"`, `"3800 mm"`, `"2400 mm"`, `"RAL 7016"`, `"OP 272"`, `"addossata alla parete a destra"`;
  - la frase fissa `"Do not change anything outside the masked area"`;
  - la frase fissa `"Reproduce the product exactly as shown in the reference images"`.
  
  Con `hasMask: false` contiene invece `"Do not change the existing building, ground, vegetation or objects"`. Con `scale` contiene `"for scale"` e la misura nota. Senza `fabric` la parola `fabric` non compare.
  
  `estimateCost("openai","gpt-image-1","high",3)` è un numero maggiore di 0; `estimateCost("openrouter","sconosciuto","high",3) === null`.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa. Il prompt è in inglese (i modelli lo seguono meglio) e contiene tra virgolette il testo libero dell'utente, così com'è. Struttura: compito → prodotto e descrizione → misure → finiture → posizione → scala → vincoli di fedeltà → vincoli sulla casa → fotorealismo (luce, ombre portate, prospettiva della foto). Prezzi: valori pubblici correnti per `gpt-image-1` (low/medium/high) e per i modelli immagine Gemini su OpenRouter, convertiti in EUR con il tasso costante `USD_EUR = 0.92` dichiarato in testa al file.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(gibus-render): costruzione del prompt e stima dei costi`.

### Task 6: Fornitori di IA intercambiabili e impostazioni

**Files:**
- Create: `src/lib/providers/types.ts`, `openai.ts`, `openrouter.ts`, `registry.ts`, `src/lib/settings.ts`
- Test: `tests/providers/openai.test.ts`, `tests/providers/openrouter.test.ts`, `tests/providers/registry.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type GenerateInput = { photo: Buffer; mask?: Buffer; references: Buffer[]; prompt: string; model: string; quality: "low" | "medium" | "high" };
  interface ImageProvider {
    id: "openai" | "openrouter";
    label: string;
    supportsMask: boolean;
    supportedSizes: ProviderSize[];
    suggestedModels: string[];
    isConfigured(): boolean;
    generate(input: GenerateInput): Promise<Buffer>; // una immagine PNG/JPEG
  }
  class ProviderError extends Error { kind: "config" | "rejected" | "timeout" | "upstream" }
  ```
  - `getProvider(id: string): ImageProvider` (errore per id sconosciuto); `listProviders(): ImageProvider[]`.
  - `getSettings(): Promise<Settings>` (crea la riga 1 con i valori predefiniti: provider `openai`, modello `gpt-image-1`, qualità `high`, abilitati `["openai","openrouter"]`, varianti 3); `updateSettings(patch: Partial<Settings>): Promise<Settings>`, con validazione zod (il provider attivo deve essere tra quelli abilitati; varianti tra 1 e 6).

- [ ] **Step 1: Test che falliscono** (con `fetch` simulato tramite `vi.stubGlobal`; il client OpenAI riceve un `fetch` iniettato):
  - **OpenAI**: `generate` chiama `POST https://api.openai.com/v1/images/edits` con `model`, `quality`, `n=1`, `size` pari a quello della foto di input e `image[]`, in cui la prima immagine è la foto e le successive sono i riferimenti. Se c'è `mask`, la invia convertita in PNG RGBA con alfa 0 dentro l'area da modificare e 255 fuori (formato OpenAI). Decodifica `data[0].b64_json`. Una risposta 400 con `moderation` → `ProviderError` di tipo `"rejected"`. Senza `OPENAI_API_KEY` → `isConfigured() === false`, e `generate` lancia un errore di tipo `"config"`.
  - **OpenRouter**: `POST https://openrouter.ai/api/v1/chat/completions` con `modalities: ["image","text"]` e messaggio utente composto da testo + foto + (se c'è) maschera + riferimenti, tutti come `image_url` con data URL. Se la maschera è presente, il testo aggiunge la nota `"The second image is a mask: white = area to edit"`. Legge `choices[0].message.images[0].image_url.url` (data URL) e lo decodifica. `supportsMask === false`. Risposta senza immagini → `ProviderError` di tipo `"upstream"`, messaggio `"Il modello non ha restituito un'immagine"`.
  - **Registry**: `listProviders().map(p=>p.id)` vale `["openai","openrouter"]`; `getProvider("x")` lancia un errore.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa. Timeout di 240 s per chiamata, con `AbortSignal.timeout` → `ProviderError` di tipo `"timeout"`. Header OpenRouter: `HTTP-Referer` e `X-Title: GibusRender`. I modelli suggeriti per OpenRouter si leggono dalla variabile `OPENROUTER_MODELS` (separati da virgola), con un valore predefinito `google/gemini-2.5-flash-image`. Nelle Impostazioni il modello si può sempre scrivere a mano.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(gibus-render): fornitori IA intercambiabili (OpenAI, OpenRouter) e impostazioni`.

### Task 7: Orchestrazione della generazione e API

**Files:**
- Create: `src/lib/render/generate.ts`, `src/app/api/renders/route.ts`, `src/app/api/renders/[id]/variants/route.ts`, `src/app/api/variants/[id]/download/route.ts`
- Test: `tests/render/generate.test.ts`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces:
  - `createRender(input: CreateRenderInput): Promise<Render>`, dove `CreateRenderInput` è uno schema zod con: `clientRef`, `photo` (File/Buffer), `productId`, le quattro misure (interi 500–15000 mm), `colorId?`, `fabricId?`, `polygon?: Point[]`, `positionText` (non vuoto se manca `polygon`), `scaleLine?`, `prompt?` (se assente si usa `buildPrompt`), `providerId`, `model`, `quality`, `variantsRequested` (1–6), `disclaimer`. Chiama `normalizePhoto`, salva la foto con `putFile("renders/<id>/photo.jpg")` e calcola il prompt.
  - `generateVariant(renderId: string, deps?: { provider?: ImageProvider }): Promise<Variant>`. Passi: crea la `Variant` PENDING; carica foto e riferimenti; se c'è il poligono costruisce `polygonToMask`; `pickProviderSize` → `toProviderSize` (foto e maschera); `provider.generate`; `fromProviderSize`; poi `composite` se c'è la maschera, altrimenti l'immagine generata così com'è. Applica `addDisclaimer` se richiesto, salva con `putFile`, imposta `DONE`, `protected = !!polygon`. In caso di errore imposta `FAILED` con un messaggio italiano per tipo di errore: config → `"Fornitore non configurato: manca la chiave API"`, rejected → `"Il fornitore ha rifiutato la richiesta"`, timeout → `"Tempo scaduto, riprova"`, altro → `"Errore del fornitore, riprova"`. Non rilancia l'eccezione.
  - `POST /api/renders` (multipart) → `{ id }`; `POST /api/renders/[id]/variants` → la `Variant` (`maxDuration = 300`); `GET /api/variants/[id]/download` → JPEG come allegato, con nome `GibusRender-<clientRef>-<id>.jpg`.

- [ ] **Step 1: Test che falliscono** (`db` sostituito da un finto Prisma in memoria tramite `vi.mock("@/lib/db")`, provider finto che restituisce un PNG rosso 1536×1024):
  - con poligono → variante `DONE`, `protected true`, e i pixel lontani dalla sagoma coincidono con la foto entro la tolleranza del JPEG (differenza media < 2);
  - senza poligono → `protected false`;
  - provider che lancia `ProviderError("…","rejected")` → `FAILED` con `"Il fornitore ha rifiutato la richiesta"`, e la promessa si risolve senza errore;
  - `createRender` senza poligono e con `positionText` vuoto → errore di validazione `"Indica la posizione: disegna la sagoma o descrivila a parole"`.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(gibus-render): pipeline di generazione delle varianti e API`.

### Task 8: Interfaccia catalogo e impostazioni

**Files:**
- Create: `src/lib/catalog/actions.ts`, `src/app/catalogo/page.tsx`, `src/app/catalogo/[id]/page.tsx`, `src/app/catalogo/finiture/page.tsx`, `src/app/impostazioni/page.tsx`, navigazione in `layout.tsx`
- Test: `tests/catalog/actions.test.ts`

**Interfaces:**
- Produces: server actions `saveProduct(form: FormData)`, `deleteProduct(id)`, `addReferenceImage(productId, file)`, `removeReferenceImage(id)`, `saveFinish(form)`, `deleteFinish(id)`. Validazione zod: nome obbligatorio, misure intere 500–15000, `aiDescription` di almeno 50 caratteri. Non si può eliminare una finitura usata come predefinita: errore `"Finitura in uso come predefinita in: <prodotti>"`. Si può eliminare un prodotto anche se ha render collegati: il render conserva `productName` e le misure (relazione `onDelete: SetNull`, Task 2).

- [ ] **Step 1: Test che falliscono** per le regole di validazione e di eliminazione appena descritte (con il finto Prisma).
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa le actions e le pagine.
  - Elenco prodotti in schede, con miniatura del riferimento 3D, tipologia e misure tipo.
  - Pagina prodotto con modulo di modifica: campi, scelta delle finiture compatibili, finiture predefinite, riferimenti con caricamento, eliminazione e ordinamento.
  - Pagina finiture.
  - Impostazioni: fornitore attivo (solo tra quelli abilitati, con stato "configurato / chiave mancante" da `isConfigured()`), modello (scelta tra i suggeriti o testo libero), qualità, abilitazione per fornitore, varianti predefinite.
- [ ] **Step 4:** `npm test` → PASS; `npm run dev` e prova a mano: modifica di "Lamella Compact" in "Prova", salvataggio e ricarica mostrano "Prova"; poi riporta il nome originale.
- [ ] **Step 5:** Commit `feat(gibus-render): gestione catalogo, finiture e impostazioni`.

### Task 9: Nuovo render (foto, sagoma, scala, parametri)

**Files:**
- Create: `src/app/nuovo/page.tsx`, `NewRenderForm.tsx`, `PolygonEditor.tsx`, `ScaleLineEditor.tsx`, `upload.ts`
- Test: `tests/nuovo/upload.test.ts`

**Interfaces:**
- Consumes: `POST /api/renders`, `buildPrompt` (anteprima lato client: `prompt.ts` non deve importare moduli solo server), `estimateCost`, `validatePolygon`.
- Produces: `computeUploadSize(w: number, h: number, maxSide = 3000): { width: number; height: number }`; `prepareUpload(file: File): Promise<Blob>` (HEIC → JPEG con `heic2any`, ridimensionamento su canvas, JPEG 0.9).

- [ ] **Step 1: Test che falliscono**: `computeUploadSize(4032,3024)` → `{3000,2250}`; `(2000,1000)` → invariato; `(3024,4032)` → `{2250,3000}`.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa la pagina come un unico modulo a sezioni numerate, come da spec §2:
  1. **Foto**, con anteprima.
  2. **Prodotto**, a schede.
  3. **Misure**, precompilate e modificabili.
  4. **Finiture**: solo quelle compatibili, con predefinite preselezionate.
  5. **Posizione**:
     - `PolygonEditor` in SVG sovrapposto alla foto: clic per aggiungere punti, trascinamento per spostarli, doppio clic su un punto per eliminarlo, pulsante "Cancella sagoma";
     - area di testo per la descrizione a parole.
     
     Se non c'è sagoma compare l'avviso "Senza sagoma la casa non è protetta dalle modifiche dell'IA".
  6. **Scala facoltativa** (`ScaleLineEditor`: due punti + campo mm).
  7. **Fornitore, modello e qualità**, con valori dalle Impostazioni, modificabili per il singolo render.
  8. **Varianti** e **dicitura**.
  9. **Prompt**: anteprima con "Modifica testo per l'IA" (area di testo; se modificata a mano, smette di aggiornarsi da sola e compare "Ripristina").
  10. **Stima costo** e pulsante **Genera**.

  Al clic su Genera si chiama `POST /api/renders` e si va su `/render/<id>?avvia=1`.
- [ ] **Step 4:** `npm test` → PASS; prova a mano con una foto di esterni scaricata da Unsplash in `GibusRender/.data/test-photos/`: disegna la sagoma, aggiungi la scala, controlla che l'anteprima del prompt contenga misure e finiture.
- [ ] **Step 5:** Commit `feat(gibus-render): pagina nuovo render con sagoma, scala e anteprima prompt`.

### Task 10: Varianti, confronto, archivio

**Files:**
- Create: `src/app/render/[id]/page.tsx`, `VariantsView.tsx`, `BeforeAfter.tsx`; Modify: `src/app/page.tsx` (archivio); Create: `src/lib/render/actions.ts`

**Interfaces:**
- Consumes: `POST /api/renders/[id]/variants`, `GET /api/variants/[id]/download`.
- Produces: server actions `chooseVariant(renderId, variantId)`, `duplicateRender(renderId): Promise<string>` (nuovo id con gli stessi parametri e la stessa foto, senza varianti; porta a `/nuovo?da=<id>`, che precompila il modulo).

- [ ] **Step 1: Test che falliscono** (`tests/render/actions.test.ts`): `chooseVariant` rifiuta una variante di un altro render o con stato diverso da `DONE`; `duplicateRender` copia tutti i parametri tranne `chosenVariantId`.
- [ ] **Step 2:** `npm test`: FAIL.
- [ ] **Step 3:** Implementa.
  - **Pagina render**: con `?avvia=1` lancia in parallelo `variantsRequested` chiamate `POST …/variants`, mostra un segnaposto con "Generazione in corso…" e riempie le varianti man mano che arrivano.
  - **Varianti**: un badge "Casa non protetta" se `protected false`; per quelle `FAILED`, il messaggio con "Riprova" (una nuova chiamata). Per ognuna: "Confronta" (cursore prima/dopo in `BeforeAfter`), "Scegli" e "Scarica". Sopra c'è "Genera altre varianti", che chiede il numero.
  - **Riepilogo** dei parametri e del prompt usato, con "Duplica e modifica".
  - **Archivio** (`/`): elenco con miniatura della variante scelta (o della prima `DONE`), riferimento cliente, prodotto e data; ricerca per riferimento cliente.
- [ ] **Step 4:** `npm test` → PASS. Prova a mano completa, con chiave OpenAI reale in `.env.local`: un render ZENIT con sagoma su una foto di prova, 3 varianti, scelta e scaricamento. Controllo a vista: la casa è intatta fuori dalla sagoma e il JPEG ha le dimensioni della foto normalizzata.
- [ ] **Step 5:** Commit `feat(gibus-render): varianti con confronto, scelta, scaricamento e archivio`.

### Task 11: Deploy e documentazione

**Files:**
- Create: `GibusRender/README.md`, `vercel.json` (`{"functions": {"src/app/api/renders/[id]/variants/route.ts": {"maxDuration": 300}}}`), `.env.example` completo

- [ ] **Step 1:** Il README, in italiano, spiega:
  - a cosa serve l'app;
  - le variabili d'ambiente e come ottenerle (Neon, Vercel Blob, chiavi OpenAI e OpenRouter);
  - i comandi `npm run dev`, `npx prisma migrate deploy` e `npm run db:seed`;
  - come aggiungere un nuovo fornitore (implementare `ImageProvider` e registrarlo in `registry.ts`);
  - il punto aperto sulla privacy, ripreso dalla spec.
- [ ] **Step 2:** `npm test` e `npm run build` → tutto verde.
- [ ] **Step 3:** Commit `docs(gibus-render): README e configurazione per il deploy`.
- [ ] **Step 4:** Il deploy (nuovo progetto Vercel con Root Directory `GibusRender`, database Neon, archivio Blob e variabili) richiede gli account dell'utente: va preparato con lui, non fatto in autonomia.
