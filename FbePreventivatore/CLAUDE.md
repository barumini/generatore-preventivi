# FBE Preventivatore

Prototipo di preventivatore guidato da AI per FBE WoodLiving (case in legno massiccio MHM).
Genera l'offerta commerciale `mod.05-COM` (25-28 pagine) da un wizard, con preview live.

**Leggi la spec prima di lavorare:**
`docs/superpowers/specs/2026-08-04-fbe-preventivatore-design.md`

I documenti di riferimento forniti da FBE sono in `Documentazione addestramento/`
(~33 MB, non committati). I PDF non si leggono col tool Read in questo ambiente
(manca poppler): usare `pymupdf` in un venv.

## Vincoli non ovvi — violarli produce numeri sbagliati

1. **Gli sconti sono a CASCATA, non additivi.** 10% + 10% = 19%, non 20%.
   Il secondo sconto si applica al residuo dopo il primo.

2. **Due gruppi di voci.** `GREZZO` entra nel `Listino` e subisce gli sconti;
   `POST_SCONTO` (sicurezza, chiavi in mano, garage) si somma **dopo** il `PARZIALE`
   e **non** è scontato. Trattarle uniformemente sbaglia di ~19%.

3. **Il prezzo si riconcilia top-down.** L'`Arrotondamento` è una leva manuale per far
   atterrare il totale su una cifra tonda. Il motore deve risolvere anche l'inverso:
   dato il totale target, quale arrotondamento serve.

4. **I numeri di voce si rinumerano.** `1`, `2`, `4.a` sono calcolati al render sulle voci
   incluse. Nel catalogo si usano id stabili (`pareti-mhm`, `copertura-falda`).
   Nessun testo può citare un numero di voce come costante.

5. **L'importo di una voce non è sempre un numero.** Può essere `comprese`, `escluso`,
   `escluse`, `OMAGGIO`. Solo i numeri entrano nelle somme.

6. **La revisione congela il listino.** Ogni revisione salva una copia dei parametri di
   prezzo usati, non un riferimento. Riaprire una rev. già inviata deve mostrare gli
   stessi numeri firmati dal cliente.

7. **L'AI non decide i prezzi.** Escono dal listino parametrico o sono digitati.
   Ogni importo mostra la provenienza: `proposto` | `manuale` | `ripartito`.

## Golden case

Dati Crivellaro in ingresso → il motore deve restituire esattamente:

```
serramenti      30,50 mq lordi · 15,89 mq netti
Listino 2026    237 000,00
−10% cliente    − 23 700,00  → 213 300,00
−10% conferma   − 21 330,00  → 191 970,00
arrotondamento  −  1 070,00
PARZIALE        190 900,00
TOTALE          300 000,00
```

Se questi numeri non escono, il motore è rotto. Sono test, non documentazione.

## Convenzioni

- `src/domain/` è TypeScript puro: nessun import di React, Prisma o rete. È dove sta la
  logica e dove stanno i test.
- Formato importi italiano: `96 100,00 €` (spazio per le migliaia, virgola decimale).
  Il computo Primus usa invece l'apostrofo: `260´260,99`.
- Le superfici nella tabella `CARATTERISTICHE FABBRICATO` sono **stringhe libere**
  (`13+14`), non numeri: va conservata la forma scritta oltre al valore.

## Database e deploy

- Postgres (Neon) via `@prisma/adapter-pg`; i test usano PGlite in memoria (`src/server/test-db.ts`).
  In locale serve `DATABASE_URL`: `vercel env pull .env.local` (Next la legge; per i comandi
  `prisma` esportarla a mano).
- Deploy su Vercel (progetto `fbe-preventivatore`, team DIH Vicenza): `vercel.json` esegue
  `prisma migrate deploy` prima della build. Accesso protetto da Basic Auth
  (`BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD`, vedi `src/proxy.ts`).

## Workflow

- **Commit automatico per ogni modifica logica completata.** Non chiedere conferma per
  ogni commit: appena una modifica coerente e verificata (test/typecheck passati) è
  conclusa — una fix, un file nuovo, un aggiornamento di documentazione — committala
  subito con un messaggio descrittivo, senza aspettare una richiesta esplicita. Resta
  valido il resto del git safety protocol generale (staging mirato, niente force-push
  o altre operazioni distruttive senza conferma esplicita).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
