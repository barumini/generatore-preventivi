# Da Croce: quattro domande per FBE

Riepilogo da portare a FBE per chiudere il confronto fra il preventivatore e l'offerta reale.
Versione pubblicata: <https://claude.ai/artifact/WXpTbGVQwec7rj99GNWXtw>. Analisi completa in
[`testing-golden-case-dacroce.md`](testing-golden-case-dacroce.md), sezione "Nota".

Il preventivatore legge il computo Primus **DACROCE DALILA rev.03** e applica le regole di
conteggio FBE. Il risultato è stato confrontato riga per riga con l'offerta **mod.05-COM PROT
2022077 rev.02**. Gli scarti si spiegano tutti, ma per quattro punti serve una decisione di FBE:
i due documenti fanno scelte diverse e le regole scritte non dicono quale sia quella giusta.

## Dove differiscono preventivatore e offerta

Nel preventivatore le pareti MHM sono la voce di pareggio: prendono tutto quello che resta del
totale del computo (meno i 23 300 € di sicurezza forfettaria) dopo le altre righe. Per questo ogni
euro in più messo su un'altra riga compare come un euro in meno sulle pareti.

| Voce | Preventivatore | Offerta rev.02 | Differenza | Causa |
|---|---:|---:|---:|---|
| Trave alla base in larice | 10 104,24 | 14 500,00 | +4 395,76 | Posa cordolo inclusa nella trave → **domanda 1** |
| Solaio interpiano | 15 240,96 | 16 900,00 | +1 659,04 | 62 mq lordi invece di 56 netti → **domanda 2** |
| Monoblocchi Hella | 14 495,00 | 13 200,00 | −1 295,00 | Fattore alzanti 1,25 invece di 1,70 → **domanda 3** |
| Copertura, cappotto, cartongesso, assistenza, infissi | 128 960,10 | 129 000,00 | +39,90 | Arrotondamenti alle centinaia → **domanda 4** |
| Pareti strutturali MHM | 127 543,28 | 123 200,00 | −4 343,28 | Riflesso delle righe sopra (voce di pareggio) |
| **Listino** | **300 343,58** | **300 800,00** | **+456,42** | Solaio e monoblocchi non riassorbiti dalle pareti, più arrotondamenti |

Importi in euro. Progettazione esecutiva (4 000,00) coincide. Il totale commerciale dell'offerta
(255 000,00) si ottiene anche dal preventivatore con gli stessi sconti.

## 1. Posa cordolo pareti: trave alla base o pareti?

La tariffa `104.01.024` «POSA cordolo pareti» vale 4 401,36 € nel computo Da Croce. La regola FBE
per la trave è «totale a pagina 2 + `104.01.022` + `104.01.023`»: la pagina 2 si chiude sulla voce
9 e la posa cordolo è la voce 12, a pagina 3. Il preventivatore quindi la lascia nelle pareti.

```
voci 1–11 (regola)          10 104,24   ← preventivatore
+ voce 12 posa cordolo        4 401,36
                             ─────────
                             14 505,60   → 14 500,00 in offerta
```

**Le due offerte non sono coerenti.** Nell'offerta Crivellaro rev.04 la trave è 5 800,00, cioè la
regola senza posa cordolo (5 843,70). In Da Croce la posa cordolo è inclusa. È l'unica voce del
computo che spiega lo scarto.

> **Domanda:** la posa cordolo va sotto «Trave alla base» o resta dentro «Pareti strutturali»?

| Risposta | Effetto | Modifica |
|---|---|---|
| Trave alla base | Da Croce: trave 14 505,60, pareti 123 141,92 (in linea con l'offerta). Crivellaro: trave 8 504,27 contro i 5 800 della sua offerta. | Una tariffa in più nella regola trave (`TARIFFE_TRAVE_BASE`) |
| Pareti | Il preventivatore è già corretto; l'offerta Da Croce contiene un errore manuale. | Nessuna |

## 2. Solaio: superficie lorda del piano o netta del computo?

Il pacchetto solaio del computo costa 272,16 €/mq (voci 35–40: lamellare 213,32 + membrana 3,22 +
isolante acustico 11,40 + ferramenta 6,55 + posa 37,67). Nel computo la voce 35 è misurata
`(par.ug.=62-6) 56,00`: il computista parte da 62 mq e ne toglie 6, probabilmente il foro scala.
L'offerta, a pagina 4, riporta per il Piano Primo una superficie lorda di 62 mq e usa quella.

```
56 mq netti × 272,16 = 15 240,96   ← preventivatore
62 mq lordi × 272,16 = 16 873,92   → 16 900,00 in offerta
```

> **Domanda:** il solaio interpiano si fattura sulla superficie lorda del piano (62 mq) o su quella
> netta misurata nel computo (56 mq)? E i 6 mq detratti sono il foro scala?

| Risposta | Effetto | Modifica |
|---|---|---|
| Netta (56 mq) | Il preventivatore è già corretto; l'offerta contiene un errore manuale di 1 632,96 €. | Nessuna |
| Lorda (62 mq) | Il solaio va calcolato sulla superficie lorda del piano primo, che nel computo non esiste come dato a sé. | Nuova regola e un dato in più da inserire |

## 3. Fattore degli alzanti scorrevoli: 1,70 o 1,25?

I monoblocchi sono la somma di tre tariffe. Nella `109.04.13` il computo conta gli alzanti
scorrevoli con un fattore: 2 portoncini + 4 portefinestre + 3 alzanti × 1,70 + 1 portabalcone =
12,10 pezzi. Con il fattore a 1,25, lo stesso che il computo Crivellaro usa sulla stessa riga, il
totale coincide con l'offerta.

| Tariffa | Voce | €/pz | Pezzi con 1,70 | Totale | Pezzi con 1,25 | Totale |
|---|---|---:|---:|---:|---:|---:|
| `109.04.12` | Monoblocchi finestre | 600 | 4 | 2 400,00 | 4 | 2 400,00 |
| `109.04.13` | Monoblocchi portefinestre | 800 | 12,10 | 9 680,00 | 10,75 | 8 600,00 |
| `109.04.14` | Montaggio monoblocchi | 150 | 16,10 | 2 415,00 | 14,75 | 2 212,50 |
| | **Totale** | | | **14 495,00** | | **13 212,50** |

Sono state provate tutte le varianti semplici: fattori da 1 a 2, pezzi e voci inclusi o esclusi.
Solo il fattore 1,25 dà 13 200. Nel caso Crivellaro FBE aveva già indicato i monoblocchi fra gli
errori di calcolo manuale dell'offerta.

> **Domanda:** per gli alzanti scorrevoli di Da Croce vale il fattore 1,70 del computo rev.03, o
> l'offerta è stata fatta con un computo precedente con fattore 1,25?

| Risposta | Effetto | Modifica |
|---|---|---|
| 1,70 (computo) | Il preventivatore è già corretto; l'offerta contiene un errore di 1 295 €. | Nessuna |
| 1,25 | Il fattore va corretto nel computo Primus: il preventivatore usa i totali del computo e non lo ricalcola. | Nel computo, non nel preventivatore |

## 4. Arrotondamento delle righe alle centinaia

Nelle offerte ogni riga è arrotondata alle centinaia, ma non sempre nella stessa direzione. Il
preventivatore oggi riporta gli importi al centesimo e lascia l'arrotondamento alla sola riga
«Arrotondamento», prima del PARZIALE.

| Voce | Calcolato | Offerta | Direzione |
|---|---:|---:|---|
| Copertura a falda | 54 474,19 | 54 500,00 | per eccesso |
| Cappotto | 21 624,51 | 21 700,00 | per eccesso (il più vicino sarebbe 21 600) |
| Infissi | 31 230,00 | 31 300,00 | per eccesso (il più vicino sarebbe 31 200) |
| Cartongesso | 18 975,90 | 18 900,00 | per difetto (il più vicino sarebbe 19 000) |
| Assistenza cartongessisti | 2 655,50 | 2 600,00 | per difetto (il più vicino sarebbe 2 700) |
| Pareti (con posa cordolo in trave) | 123 141,92 | 123 200,00 | per eccesso |

> **Domanda:** le righe dell'offerta vanno arrotondate alle centinaia? Se sì, con quale regola: al
> più vicino, sempre per eccesso, o a discrezione di chi redige?

| Risposta | Effetto | Modifica |
|---|---|---|
| Nessun arrotondamento di riga | Resta com'è: importi al centesimo, un solo arrotondamento sul totale. | Nessuna |
| Regola fissa | Il preventivatore arrotonda ogni riga e le pareti pareggiano il resto. | Una regola di arrotondamento per riga |

## Cosa è già chiarito

- Il totale commerciale dell'offerta (255 000,00 €) si ottiene anche dal preventivatore con gli
  stessi sconti (5% + 10% a cascata) e l'arrotondamento per difetto ai 5 000 €.
- Da Croce e Crivellaro mostrano scarti simili per voce. Su Crivellaro lo scarto sulle pareti
  (−4 545,84 €) viene da copertura, cappotto e monoblocchi, che FBE ha già dichiarato errori di
  calcolo manuale.
- Nessuna regola unica riproduce le pareti di entrambe le offerte: le due sono state compilate con
  criteri diversi. Per questo le risposte alle quattro domande valgono per tutti i preventivi
  futuri, non solo per Da Croce.
- Le risposte alle domande 1–3 non cambiano il Listino: qualunque importo si sposti fra trave,
  solaio o monoblocchi viene compensato dalle pareti.

Fonti: computo Primus «DACROCE DALILA rev.03» del 19/12/2025 (166 voci, totale 323 643,58 €);
offerta «Offerta MHM rev.02_Dacroce Dalila riscontro»; computo e offerta Crivellaro rev.04 come
controprova.
