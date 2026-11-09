# GibusRender

App interna per inserire pergole Gibus, generate con l'intelligenza artificiale, nelle foto dei luoghi dei clienti. Si carica la foto, si sceglie il modello del catalogo e le finiture, si disegna (facoltativamente) la sagoma dell'area da modificare e si ottengono alcune varianti da confrontare e scaricare.

Progetto indipendente: tutto vive in `GibusRender/`, con il proprio `package.json`.

## Requisiti

- Node.js 20 o successivo e npm
- Un database PostgreSQL (in locale con Docker, in produzione Neon)
- Almeno una chiave API di un fornitore di immagini (OpenAI o OpenRouter)
- Per la produzione: un account Vercel (con Vercel Blob) e uno Neon

## Avvio in locale

1. Avviare un PostgreSQL locale, ad esempio con Docker:

   ```bash
   docker run --name gibusrender-db -e POSTGRES_USER=gibus -e POSTGRES_PASSWORD=gibus \
     -e POSTGRES_DB=gibusrender -p 5432:5432 -d postgres:17
   ```

2. Creare il file `.env` partendo dall'esempio e compilarlo:

   ```bash
   cp .env.example .env
   ```

   Per un avvio minimo bastano `DATABASE_URL=postgresql://gibus:gibus@localhost:5432/gibusrender` e una chiave (`OPENAI_API_KEY` o `OPENROUTER_API_KEY`). Senza `BLOB_READ_WRITE_TOKEN` i file vanno in `GibusRender/.data/`; senza `BASIC_AUTH_USERS` l'accesso è libero.

3. Installare, creare le tabelle, caricare il catalogo iniziale e avviare:

   ```bash
   npm install
   npx prisma migrate dev
   npm run db:seed
   npm run dev
   ```

   L'app è su http://localhost:3000. Altri comandi: `npm test` (test), `npm run build` (build di produzione), `npm run lint`.

**Quale file di ambiente legge cosa.** Next.js (`npm run dev`, `npm run build`) legge sia `.env` sia `.env.local`. Prisma (`prisma migrate`) e il seed (`npm run db:seed`) caricano invece **solo `.env`** (tramite `dotenv`). Per evitare sorprese, tenere tutte le variabili in `.env`.

## Variabili d'ambiente

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `DATABASE_URL` | sì | Stringa di connessione PostgreSQL |
| `BLOB_READ_WRITE_TOKEN` | in produzione | Token di Vercel Blob; in sviluppo, se manca, i file vanno in `.data/` |
| `BASIC_AUTH_USERS` | in produzione | Utenti nel formato `utente:password,utente2:password2`. Le password non possono contenere virgole. Se manca: 503 in produzione, accesso libero in sviluppo |
| `OPENAI_API_KEY` | per usare OpenAI | Chiave API OpenAI |
| `OPENROUTER_API_KEY` | per usare OpenRouter | Chiave API OpenRouter |
| `OPENROUTER_MODELS` | no | Modelli OpenRouter suggeriti nelle Impostazioni, separati da virgola (predefinito `google/gemini-2.5-flash-image`) |
| `APP_URL` | no | URL pubblico dell'app, inviato a OpenRouter come `HTTP-Referer`; se manca si usa quello di Vercel, o `http://localhost:3000` |

Le chiavi API stanno solo nelle variabili d'ambiente: mai nel codice, nel database o nel repository.

### Come ottenerle

- **Neon (`DATABASE_URL`)**: su https://neon.tech creare un progetto (regione europea), poi dal pannello "Connect" copiare la stringa di connessione (con `sslmode=require`).
- **Vercel Blob (`BLOB_READ_WRITE_TOKEN`)**: nel progetto Vercel, scheda Storage, creare un archivio Blob e collegarlo al progetto: Vercel aggiunge da solo la variabile `BLOB_READ_WRITE_TOKEN`.
- **OpenAI (`OPENAI_API_KEY`)**: su https://platform.openai.com, sezione API keys, creare una chiave. Il modello predefinito è `gpt-image-2` (`gpt-image-1` è stato spento da OpenAI il 23/10/2026). L'organizzazione potrebbe dover essere verificata per i modelli di immagini.
- **OpenRouter (`OPENROUTER_API_KEY`)**: su https://openrouter.ai, sezione Keys, creare una chiave e caricare un po' di credito.

## Deploy su Vercel

Il deploy richiede gli account dell'utente (Vercel, Neon) e va fatto da lui.

1. Creare il database Neon e copiare `DATABASE_URL`.
2. Su Vercel: **Add New Project**, importare il repository e impostare **Root Directory** su `GibusRender`. Il framework (Next.js) è riconosciuto da solo; `vercel.json` porta a 300 secondi la durata massima della route di generazione.
3. Nel progetto, scheda Storage, creare e collegare un archivio Blob.
4. In Settings, Environment Variables, impostare `DATABASE_URL`, `BASIC_AUTH_USERS`, `OPENAI_API_KEY` e/o `OPENROUTER_API_KEY` (e, se serve, `OPENROUTER_MODELS`, `APP_URL`). `BLOB_READ_WRITE_TOKEN` arriva dal collegamento del Blob. Senza `BASIC_AUTH_USERS` l'app risponde 503 in produzione.
5. Applicare le migrazioni al database di produzione, dalla cartella `GibusRender` con `DATABASE_URL` di produzione nel `.env` (o esportata nella shell):

   ```bash
   npx prisma migrate deploy
   ```

6. Caricare il catalogo iniziale **una sola volta** (con `DATABASE_URL` e `BLOB_READ_WRITE_TOKEN` di produzione nel `.env`):

   ```bash
   npm run db:seed
   ```

   Il seed è idempotente per i dati del catalogo, ma **a ogni esecuzione ricarica le immagini di riferimento** nell'archivio: non rilanciarlo senza necessità.
7. Eseguire il deploy (push sul ramo collegato o `vercel --prod`).

## Uso

- **Catalogo**: elenco dei modelli di pergola con descrizione per l'IA e immagini di riferimento, e finiture (strutture, teli) con relativi colori. Si modificano da qui.
- **Nuovo render**: si carica la foto del cliente, si sceglie modello e finiture, si disegna la sagoma dell'area da modificare, si indica la scala (una misura nota sulla foto) e si controlla l'anteprima del prompt e la stima del costo; poi "Genera". Senza sagoma la casa non è protetta: l'interfaccia avvisa di verificare che nulla sia cambiato.
- **Varianti**: per ogni render si ottengono più varianti (3 per impostazione predefinita) da confrontare; si sceglie la migliore, si scarica in JPG (qualità 92, risoluzione della foto originale) e si ritrovano tutte nell'archivio. Le varianti fallite si rigenerano con "Riprova". La dicitura "Immagine a titolo esemplificativo" è facoltativa e disattivata di default.
- **Impostazioni**: fornitore attivo, modello, qualità, fornitori abilitati e numero predefinito di varianti.

## Aggiungere un nuovo fornitore di immagini

1. Creare `src/lib/providers/<nome>.ts` che esporta un oggetto che implementa `ImageProvider` (`src/lib/providers/types.ts`): `id`, `label`, `supportsMask`, `supportedSizes`, `suggestedModels`, `isConfigured()` e `generate()`. Gli errori vanno sollevati come `ProviderError`.
2. Registrarlo nell'elenco `PROVIDERS` di `src/lib/providers/registry.ts`.
3. Aggiungere il suo id al tipo `ProviderId` in `types.ts` e a `PROVIDER_IDS` in `src/lib/settings.ts` (ed eventualmente a `enabledProviders` nei valori predefiniti).
4. Aggiungere i prezzi in `src/lib/render/cost.ts`; per i modelli non in tabella l'app mostra "Stima non disponibile".
5. Aggiungere la variabile della chiave in `.env.example` e in questo README, ed estendere i test.

## Limiti

- Le foto sono ridimensionate automaticamente dal browser prima dell'invio e **non possono superare 4 MB** (limite di Vercel sul corpo della richiesta, 4,5 MB).
- La generazione di ogni variante può durare fino a **300 secondi** (`maxDuration` della route, configurato anche in `vercel.json`).
- Il piano Vercel deve consentire funzioni da 300 secondi.

## Privacy (punto aperto)

Le foto delle case dei clienti vengono inviate ai fornitori di IA scelti. Se serva un consenso del cliente o vada escluso qualche fornitore è ancora da decidere. L'app non impedisce questa decisione: ogni fornitore si abilita o disabilita da Impostazioni.

## Limiti noti

- La dicitura "Immagine a titolo esemplificativo" è disegnata con i font di sistema: su Vercel i font disponibili sono pochi e **non è stato verificato** che il testo venga reso correttamente. Da controllare al primo deploy; se manca, la dicitura può comparire con caratteri sostitutivi o vuoti.
- Il deploy su Vercel non è stato provato: è da fare con gli account dell'utente.
