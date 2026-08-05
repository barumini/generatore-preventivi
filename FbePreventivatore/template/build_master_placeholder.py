#!/usr/bin/env python3
"""
Costruisce `template/Offerta MHM master.docx` a partire dal master FBE
originale (`Documentazione addestramento/Offerta MHM rev.00_.docx`),
sostituendo i campi variabili con i placeholder di docxtemplater elencati in
`template/PLACEHOLDER.md`.

Tecnica (validata dallo spike del Task 2, cfr. template/spike/README.md):
in questo ambiente non esiste Word/LibreOffice, quindi le modifiche sono
fatte sull'XML grezzo dentro lo zip del .docx. Il pacchetto viene
ricostruito voce per voce con zipfile.ZipFile, copiando ogni membro
invariato tranne `word/document.xml` e `word/header1.xml`: MAI un
extract+rezip naive, che corrompe i pacchetti Office Open XML.

Regole seguite per contenere il rischio (nessuna verifica visiva possibile):

1. Le sostituzioni di testo toccano SOLO il contenuto dei nodi `<w:t>`.
   La struttura dei run, e quindi la formattazione, resta byte-identica.
   Quando un valore era spezzato su piu' run (tipico di Word), il primo run
   riceve il placeholder e i successivi vengono svuotati.
2. Ogni sostituzione dichiara quante occorrenze si aspetta e lo script
   fallisce se il conto non torna. I testi in copertina e nelle caselle di
   testo sono duplicati dentro `mc:AlternateContent` (rami mc:Choice +
   mc:Fallback), percio' li' le occorrenze attese sono 2.
3. Le due sole modifiche strutturali sono documentate a parte:
   - pag. 5: il run col disegno `image15.png` (tabella prezzi come
     immagine) viene rimosso e al suo posto viene inserita una `<w:tbl>`
     nativa con i blocchi di ciclo docxtemplater;
   - pag. 6: nella tabella dei SAL le righe ripetute vengono ridotte a una
     riga-modello per ciascuno dei due gruppi (prima/dopo la clausola di
     fidejussione), con i tag `{#salPrimi}`/`{#salSuccessivi}`.

Uso:
    python3 template/build_master_placeholder.py
"""

from __future__ import annotations

import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Documentazione addestramento" / "Offerta MHM rev.00_.docx"
DST = ROOT / "template" / "Offerta MHM master.docx"

DOC = "word/document.xml"
HDR = "word/header1.xml"

WT = re.compile(r"<w:t(?: [^>]*)?>([^<]*)</w:t>")


class Fallita(SystemExit):
    pass


def _wt(testo: str) -> str:
    """Serializza un nodo <w:t>. Il testo passa attraverso senza ri-escaping:
    le stringhe attese sono estratte dall'XML grezzo e i placeholder non
    contengono caratteri da escapare. Controllo esplicito per sicurezza."""
    for vietato in ("<", ">", "&"):
        if vietato in testo:
            raise Fallita(f"testo di sostituzione non serializzabile: {testo!r}")
    return f'<w:t xml:space="preserve">{testo}</w:t>'


def sostituisci(
    xml: str,
    attesi: tuple[str, ...],
    nuovi: tuple[str, ...],
    occorrenze: int,
    etichetta: str,
) -> str:
    """Trova le sequenze di nodi <w:t> consecutivi il cui contenuto e'
    esattamente `attesi` e ne riscrive il contenuto con `nuovi`.

    Fallisce se il numero di sequenze trovate != `occorrenze`: e' la rete di
    sicurezza contro un master diverso da quello atteso o contro una
    sostituzione che colpisce testo non in perimetro.
    """
    if len(attesi) != len(nuovi):
        raise Fallita(f"[{etichetta}] attesi/nuovi di lunghezza diversa")

    match = list(WT.finditer(xml))
    testi = [m.group(1) for m in match]
    n = len(attesi)
    trovate = [i for i in range(len(testi) - n + 1) if testi[i : i + n] == list(attesi)]

    if len(trovate) != occorrenze:
        raise Fallita(
            f"[{etichetta}] attese {occorrenze} occorrenze, trovate {len(trovate)}. "
            f"Sequenza: {attesi!r}"
        )

    # Dall'ultima alla prima, cosi' gli offset gia' calcolati restano validi.
    for i in reversed(trovate):
        for j in reversed(range(n)):
            if nuovi[j] == attesi[j]:
                continue  # invariato: non toccare il run
            m = match[i + j]
            xml = xml[: m.start()] + _wt(nuovi[j]) + xml[m.end() :]
    return xml


# ---------------------------------------------------------------------------
# Tabella prezzi nativa di pag. 5
# ---------------------------------------------------------------------------
# Larghezze: la tabella `CARATTERISTICHE FABBRICATO` di pag. 4 usa
# tblW=10184 dxa (= larghezza utile A4 con questi margini). Stessa larghezza,
# tre colonne: n. | descrizione | importo.
COL_N, COL_DESC, COL_IMP = 709, 7479, 1996
BORDO = '<w:top w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>'
BORDI = (
    "<w:tblBorders>"
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>'
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>'
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>'
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>'
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>'
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="7F7F7F"/>'
    "</w:tblBorders>"
)
FONT = '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'


def _rpr(grassetto: bool) -> str:
    # L'ordine degli elementi dentro w:rPr e' quello imposto da CT_RPr:
    # rFonts, b, color, sz, szCs.
    return (
        "<w:rPr>"
        + FONT
        + ("<w:b/>" if grassetto else "")
        + '<w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="20"/>'
        "</w:rPr>"
    )


def _p(testo: str, grassetto: bool = False, allineamento: str | None = None) -> str:
    # CT_PPr: spacing prima di jc.
    ppr = '<w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>'
    if allineamento:
        ppr += f'<w:jc w:val="{allineamento}"/>'
    ppr += "</w:pPr>"
    if testo == "":
        return "<w:p>" + ppr + "</w:p>"
    return "<w:p>" + ppr + "<w:r>" + _rpr(grassetto) + _wt(testo) + "</w:r></w:p>"


def _tc(larghezza: int, paragrafo: str, gridspan: int | None = None) -> str:
    # CT_TcPr: tcW prima di gridSpan.
    tcpr = f'<w:tcPr><w:tcW w:w="{larghezza}" w:type="dxa"/>'
    if gridspan:
        tcpr += f'<w:gridSpan w:val="{gridspan}"/>'
    tcpr += "</w:tcPr>"
    return "<w:tc>" + tcpr + paragrafo + "</w:tc>"


def _tr_tre_colonne(numero: str, descrizione: str, importo: str, grassetto: bool = False) -> str:
    return (
        "<w:tr>"
        + _tc(COL_N, _p(numero, grassetto))
        + _tc(COL_DESC, _p(descrizione, grassetto))
        + _tc(COL_IMP, _p(importo, grassetto, "right"))
        + "</w:tr>"
    )


def _tr_riepilogo(descrizione: str, importo: str, grassetto: bool = False) -> str:
    """Riga di riepilogo (sconti, arrotondamento, parziale, sicurezza, totale).

    Nell'immagine originale (`image15.png`) queste etichette partono dal bordo
    sinistro della tabella, attraversando la colonna stretta del numero voce:
    servono quindi DUE celle, con la prima che copre le colonne n.+descrizione
    (`gridSpan=2`). Una prima cella vuota da 709 twip rientrerebbe il testo di
    ~1,25 cm rispetto all'originale. La riga `Listino {annoListino}` invece e'
    rientrata anche nell'originale e resta a tre celle.

    Nota per la riga di ciclo degli sconti: con due celle il tag di apertura
    resta nella prima e quello di chiusura nell'ultima cella della stessa
    riga, quindi la regione fra i due tag attraversa ancora un confine
    `<w:tc>` e il loop continua a espandere a `w:tr`.
    """
    return (
        "<w:tr>"
        + _tc(COL_N + COL_DESC, _p(descrizione, grassetto), gridspan=2)
        + _tc(COL_IMP, _p(importo, grassetto, "right"))
        + "</w:tr>"
    )


def _tr_intestazione(testo: str) -> str:
    return "<w:tr>" + _tc(COL_N + COL_DESC + COL_IMP, _p(testo, True), gridspan=3) + "</w:tr>"


def tabella_prezzi() -> str:
    """Tabella prezzi di pag. 5 come tabella Word nativa.

    I blocchi di ciclo seguono la convenzione docxtemplater per le righe di
    tabella: tag di apertura nella PRIMA cella e tag di chiusura nell'ULTIMA
    cella della STESSA riga. Cosi' la regione fra i due tag attraversa dei
    confini `<w:tc>` e il modulo loop espande a `w:tr` (cfr.
    node_modules/docxtemplater/js/file-type-config.js: expandTags =
    [{contains: "w:tc", expand: "w:tr"}]), duplicando l'intera riga.
    Aprire e chiudere un ciclo su righe DIVERSE produrrebbe XML malformato.
    """
    righe = [
        _tr_intestazione("GREZZO AVANZATO"),
        # voci di listino (gruppo GREZZO): una riga per voce
        _tr_tre_colonne("{#voci}{numero}", "{descrizione}", "{importo}{/voci}"),
        # unica riga rientrata anche nell'originale: resta a tre celle
        _tr_tre_colonne("", "Listino {annoListino}", "{listinoTotale}", grassetto=True),
        # sconti a cascata: una riga per sconto, nell'ordine di applicazione
        _tr_riepilogo(
            "{#sconti}SCONTO RISERVATO: {percentuale}   {causale}",
            "{importo}{/sconti}",
        ),
        _tr_riepilogo("Arrotondamento", "{arrotondamento}"),
        _tr_riepilogo(
            "PARZIALE AL GREZZO AVANZATO  esclusa I.V.A.", "{parziale}", grassetto=True
        ),
        _tr_riepilogo("COSTI SICUREZZA :      SICUREZZA ***", "{sicurezza.valorizzata}"),
        # voci POST_SCONTO (chiavi in mano, garage): sommate dopo il PARZIALE
        _tr_tre_colonne(
            "{#vociPostSconto}{numero}", "{descrizione}", "{importo}{/vociPostSconto}"
        ),
        _tr_riepilogo("TOTALE AL NETTO  esclusa I.V.A.", "{totaleNetto}", grassetto=True),
        _tr_intestazione("Optional:"),
        _tr_tre_colonne("{#optional}{lettera}", "{descrizione}", "{importo}{/optional}"),
        _tr_intestazione("Esclusioni :"),
        _tr_tre_colonne("{#esclusioni}{lettera}", "{descrizione}", "{importo}{/esclusioni}"),
    ]
    # CT_TblPr: tblW, tblBorders, tblLayout, tblLook.
    return (
        "<w:tbl><w:tblPr>"
        '<w:tblW w:w="10184" w:type="dxa"/>'
        + BORDI
        + '<w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0"/>'
        "</w:tblPr>"
        f'<w:tblGrid><w:gridCol w:w="{COL_N}"/><w:gridCol w:w="{COL_DESC}"/>'
        f'<w:gridCol w:w="{COL_IMP}"/></w:tblGrid>' + "".join(righe) + "</w:tbl>"
    )


def sostituisci_immagine_prezzi(xml: str) -> str:
    """Rimuove il run col disegno di `image15.png` (la tabella prezzi come
    immagine, nel paragrafo del titolo "Preventivo" di pag. 5) e inserisce la
    tabella nativa subito dopo quel paragrafo.

    `image15.png` e le sue relazioni restano nel pacchetto: una relazione non
    usata e' valida OOXML e togliere il file richiederebbe di riscrivere
    anche `word/_rels/document.xml.rels` (rischio non necessario)."""
    if xml.count('r:embed="rId23"') != 1:
        raise Fallita("atteso esattamente 1 riferimento a rId23 (image15.png)")

    pos = xml.index('r:embed="rId23"')
    inizio_run = xml.rfind("<w:r ", 0, pos)
    inizio_run_alt = xml.rfind("<w:r>", 0, pos)
    inizio_run = max(inizio_run, inizio_run_alt)
    fine_run = xml.index("</w:r>", pos) + len("</w:r>")
    run = xml[inizio_run:fine_run]
    if run.count("<w:drawing>") != 1 or "<w:t" in run:
        raise Fallita("il run di image15.png non ha la forma attesa (solo disegno)")

    xml = xml[:inizio_run] + xml[fine_run:]

    # Il paragrafo che conteneva il disegno e' il titolo "Preventivo": la
    # tabella va inserita subito DOPO la sua chiusura.
    fine_paragrafo = xml.index("</w:p>", inizio_run) + len("</w:p>")
    # Dopo una tabella serve sempre un paragrafo: il documento ne ha gia' uno
    # (paragrafo successivo del body), ma ne aggiungiamo uno vuoto per
    # separare la tabella dal testo che segue, come nel resto del documento.
    return xml[:fine_paragrafo] + tabella_prezzi() + "<w:p/>" + xml[fine_paragrafo:]


# ---------------------------------------------------------------------------
# Tabella SAL di pag. 6
# ---------------------------------------------------------------------------
def sostituisci_tabella_sal(xml: str) -> str:
    """Nella tabella `Pagamento` di pag. 6:
    - la caparra diventa `€ {caparra}`;
    - le 3 righe SAL prima della clausola di fidejussione si riducono a una
      riga-modello `{#salPrimi}`;
    - le 4 righe SAL dopo la clausola si riducono a una riga-modello
      `{#salSuccessivi}`.
    La clausola di fidejussione resta dov'e': si riferisce ai "seguenti SAL",
    quindi separa i due gruppi in modo non eliminabile (un unico ciclo non
    puo' scavalcare una riga fissa)."""
    ancora = " confirmatoria da restituire al SAL 7"
    if xml.count(ancora) != 1:
        raise Fallita("attesa 1 sola occorrenza della riga caparra")
    pos = xml.index(ancora)
    inizio = xml.rfind("<w:tbl>", 0, pos)
    fine = xml.index("</w:tbl>", pos) + len("</w:tbl>")
    tbl = xml[inizio:fine]
    if tbl.count("<w:tbl>") != 1:
        raise Fallita("tabella SAL: trovata tabella annidata, non procedo")

    righe = list(re.finditer(r"<w:tr\b.*?</w:tr>", tbl, re.S))
    if len(righe) != 9:
        raise Fallita(f"tabella SAL: attese 9 righe, trovate {len(righe)}")

    r_caparra = sostituisci(
        righe[0].group(0),
        ("€", "____", "____"),
        ("€ {caparra}", "", ""),
        1,
        "caparra",
    )
    r_sal_primi = sostituisci(
        righe[1].group(0),
        ("2", "0%", "Acconto al contratto"),
        ("{#salPrimi}{percentuale}", "", "{descrizione}{/salPrimi}"),
        1,
        "salPrimi",
    )
    r_clausola = righe[4].group(0)
    r_sal_successivi = sostituisci(
        righe[5].group(0),
        ("1", "0", "%", "Al tetto primo tavolato (escluso tegole)"),
        ("{#salSuccessivi}{percentuale}", "", "", "{descrizione}{/salSuccessivi}"),
        1,
        "salSuccessivi",
    )

    nuova = (
        tbl[: righe[0].start()]
        + r_caparra
        + r_sal_primi
        + r_clausola
        + r_sal_successivi
        + tbl[righe[8].end() :]
    )
    return xml[:inizio] + nuova + xml[fine:]


# ---------------------------------------------------------------------------
# Elenco delle sostituzioni di testo
# ---------------------------------------------------------------------------
# (etichetta, attesi, nuovi, occorrenze)
# occorrenze == 2 -> il testo vive in una casella di testo duplicata nei rami
# mc:Choice e mc:Fallback di mc:AlternateContent (cfr. spike Task 2).
SOSTITUZIONI_DOCUMENT: list[tuple[str, tuple[str, ...], tuple[str, ...], int]] = [
    # --- copertina (x2) + blocco destinatario di pag. 4 (x1) ---
    ("cliente.nome", ("Baetta", " Matteo"), ("{cliente.nome}", ""), 3),
    (
        "cliente.comune/provincia (copertina)",
        ("Carpi", " ", "(MO)"),
        ("{cliente.comune}", " ", "({cliente.provincia})"),
        2,
    ),
    (
        "cliente.comune/provincia (destinatario)",
        ("Carpi", "Modena"),
        ("{cliente.comune}", "({cliente.provincia})"),
        1,
    ),
    (
        "protocollo/revisione (copertina)",
        ("PROT. ", "2025049", " REV.00"),
        ("PROT. ", "{protocollo}", " REV.{revisione}"),
        2,
    ),
    # bug spec 3.8: segnaposto mai sostituito, va rimosso
    ("residuo PROT. 000-22 REV.00", ("PROT. 0", "00", "-22 REV.00"), ("", "", ""), 2),
    # --- pag. 4 ---
    (
        "dataOfferta",
        ("Castelgomberto  lì", "   ", "27 luglio 2026"),
        ("Castelgomberto  lì", "   ", "{dataOfferta}"),
        1,
    ),
    (
        "sistemaCostruttivo",
        ("SISTEMA COSTRUTTIVO", "MassivHolzMauer", "® (M.H.M.)"),
        ("SISTEMA COSTRUTTIVO", "{sistemaCostruttivo}", ""),
        1,
    ),
    (
        "tetto",
        ("TETTO", "Tetto con travi", " e perline", " in abete "),
        ("TETTO", "{tetto}", "", ""),
        1,
    ),
    (
        "mantoCopertura",
        ("MANTO DI COPERTURA", "Tegole in cemento", " "),
        ("MANTO DI COPERTURA", "{mantoCopertura}", ""),
        1,
    ),
    (
        "finituraEsterna",
        ("FINITURA ESTERNA ", "Intonaco"),
        ("FINITURA ESTERNA ", "{finituraEsterna}"),
        1,
    ),
    (
        "pacchettoConsegna",
        ("PACCHETTO DI CONSEGNA", "Grezzo avanzato"),
        ("PACCHETTO DI CONSEGNA", "{pacchettoConsegna}"),
        1,
    ),
    (
        "superficie.totaleLorda",
        ("CARATTERISTICHE F", "ABBRICATO – Totale Lordi", " ", "         ", "=", "  ", "18", "7", " mq.", " "),
        (
            "CARATTERISTICHE F",
            "ABBRICATO – Totale Lordi",
            " ",
            "         ",
            "=",
            "  ",
            "{superficie.totaleLorda}",
            "",
            " mq.",
            " ",
        ),
        1,
    ),
    (
        "superficie.pianoTerra",
        ("Piano Terra ", "Sup. lorda", "Mq ", "63"),
        ("Piano Terra ", "Sup. lorda", "Mq ", "{superficie.pianoTerra}"),
        1,
    ),
    (
        "superficie.pianoPrimo",
        ("Piano Primo", "Sup. lorda", "Mq ", " ", "63"),
        ("Piano Primo", "Sup. lorda", "Mq ", "", "{superficie.pianoPrimo}"),
        1,
    ),
    (
        "superficie.sottotetto",
        ("Piano ", "sottotetto ", "Sup. lorda", "Mq", " ", "55"),
        ("Piano ", "sottotetto ", "Sup. lorda", "Mq", " ", "{superficie.sottotetto}"),
        1,
    ),
    (
        "superficie.portico",
        ("Portico", "Sup. lorda", "Mq ", "8.5"),
        ("Portico", "Sup. lorda", "Mq ", "{superficie.portico}"),
        1,
    ),
    (
        "superficie.terrazzo",
        ("Ter", "razzo", "Sup. lorda", "Mq   ", "4"),
        ("Ter", "razzo", "Sup. lorda", "Mq   ", "{superficie.terrazzo}"),
        1,
    ),
    (
        # il garage nel master di partenza e' vuoto: il placeholder si aggiunge
        # al testo "Mq" della cella importo
        "superficie.garage",
        ("Garage", "Sup. lorda", "Mq"),
        ("Garage", "Sup. lorda", "Mq {superficie.garage}"),
        1,
    ),
    # --- pag. 6: nessun numero di voce puo' restare costante (CLAUDE.md 4) ---
    (
        "riferimenti.praticaGenioCivile",
        (
            "La struttura sopra descritta rispetta i requisiti previsti per l’antisismica, è escluso il costo della pratica completa e firmata da depositare al Genio Civile (quotato al punto ",
            "a",
            ") optional).",
        ),
        (
            "La struttura sopra descritta rispetta i requisiti previsti per l’antisismica, è escluso il costo della pratica completa e firmata da depositare al Genio Civile (quotato al punto ",
            "{riferimenti.praticaGenioCivile}",
            ") optional).",
        ),
        1,
    ),
    (
        "riferimenti.tracciamentoImpianti",
        (
            "* Predisposizioni su struttura lignea e tracciature aggiuntive rispetto a quelle indicate al punto 1.a verranno conteggiate su rapporto orario per un costo di € ",
        ),
        (
            "* Predisposizioni su struttura lignea e tracciature aggiuntive rispetto a quelle indicate al punto {riferimenti.tracciamentoImpianti} verranno conteggiate su rapporto orario per un costo di € ",
        ),
        1,
    ),
    (
        "riferimenti.progettazioneEsecutiva",
        ("*", "*", " CONDIZIONI DI FORNITURA (quotazione punto ", "7", "):"),
        (
            "*",
            "*",
            " CONDIZIONI DI FORNITURA (quotazione punto ",
            "{riferimenti.progettazioneEsecutiva}",
            "):",
        ),
        1,
    ),
    ("consegna", ("Consegna: ", "da pattuire"), ("Consegna: ", "{consegna}"), 1),
    (
        "validita",
        ("Validità ", "offerta: ", "31", ".", "07", ".202", "6", " - Nel caso in"),
        ("Validità ", "offerta: ", "{validita}", "", "", "", "", " - Nel caso in"),
        1,
    ),
    # --- pagg. 19-20: abaco serramenti (caselle di testo, x2) ---
    (
        "abaco.finestreBattente",
        (
            "Finestre con apertura a battente",
            ": ",
            "n. 1 dim. ",
            "130",
            "x",
            "11",
            "0; n. ",
            "3",
            " dim. ",
            "5",
            "0x1",
            "4",
            "0; n. ",
            "1",
            " dim. ",
            "18",
            "0x1",
            "4",
            "0; ",
            "n. 1 dim. 130x140; n. 2 dim. 90x140;",
        ),
        (
            "Finestre con apertura a battente",
            ": ",
            "{abaco.finestreBattente}",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
        ),
        2,
    ),
    (
        "abaco.portefinestreBattente",
        ("a battente: n. ", "1", " dim. ", "13", "0x2", "05", ";"),
        ("a battente: {abaco.portefinestreBattente}", "", "", "", "", "", ""),
        2,
    ),
    (
        "abaco.fissiVetrate",
        ("Fissi / vetrate: ", "n. 1 dim. ", "5", "0x2", "4", "0", ", n. 2 dim. 50x230;"),
        ("Fissi / vetrate: ", "{abaco.fissiVetrate}", "", "", "", "", ""),
        2,
    ),
    (
        "abaco.alzantiScorrevoli",
        ("Alzante scorrevole: n. 1 dim. 240x230, n. 1 dim. 180x230;",),
        ("Alzante scorrevole: {abaco.alzantiScorrevoli}",),
        2,
    ),
    (
        # elenco completo dei serramenti = output di generaAbacoSerramenti()
        "abacoSerramenti (monoblocchi)",
        (
            "n. 1 dim. 90x",
            "23",
            "0; ",
            "n. 1 dim. 130x110; n. 3 dim. 50x140; n. 1 dim. 180x140; n. 1 dim. 130x140; n. 2 dim. 90x140; n. 1 dim. 130x205",
            ";",
            " n. 1 dim. 50x240, n. 2 dim. 50x230; n. 1 dim. 240x230, n. 1 dim. 180x230;",
        ),
        ("{abacoSerramenti}", "", "", "", "", ""),
        1,
    ),
    (
        "abaco.portoncini",
        ("n. ", "1", " portoncin", "i", " di ingresso dim. standard ", "9", "0", "x2", "30"),
        ("{abaco.portoncini}", "", "", "", "", "", "", "", ""),
        2,
    ),
]

SOSTITUZIONI_HEADER: list[tuple[str, tuple[str, ...], tuple[str, ...], int]] = [
    (
        "protocollo/revisione (header)",
        ("PROT ", " ", "2025049", "_REV. ", "0", "0"),
        ("PROT ", " ", "{protocollo}", "_REV. ", "{revisione}", ""),
        1,
    ),
]


def main() -> int:
    if not SRC.exists():
        print(f"ERRORE: sorgente non trovata: {SRC}", file=sys.stderr)
        return 1

    with zipfile.ZipFile(SRC, "r") as zin:
        document = zin.read(DOC).decode("utf-8")
        header = zin.read(HDR).decode("utf-8")

        tbl_prima = document.count("<w:tbl>")

        for etichetta, attesi, nuovi, quante in SOSTITUZIONI_DOCUMENT:
            document = sostituisci(document, attesi, nuovi, quante, etichetta)
            print(f"  ok  {etichetta} ({quante}x)")

        document = sostituisci_tabella_sal(document)
        print("  ok  tabella SAL pag. 6 (righe ripetute -> cicli)")

        document = sostituisci_immagine_prezzi(document)
        print("  ok  tabella prezzi nativa pag. 5 (image15.png rimossa dal flusso)")

        for etichetta, attesi, nuovi, quante in SOSTITUZIONI_HEADER:
            header = sostituisci(header, attesi, nuovi, quante, etichetta)
            print(f"  ok  {etichetta} ({quante}x)")

        tbl_dopo = document.count("<w:tbl>")
        if tbl_dopo != tbl_prima + 1:
            raise Fallita(f"tabelle: attese {tbl_prima + 1}, trovate {tbl_dopo}")

        # nessun frammento dei dati del cliente d'esempio deve restare nei
        # punti sostituiti
        for residuo, atteso in (("Baetta", 0), ("2025049", 0), ("PROT. 0", 0)):
            if document.count(residuo) != atteso:
                raise Fallita(
                    f"residuo inatteso {residuo!r}: {document.count(residuo)} occorrenze"
                )

        tmp = DST.with_suffix(".docx.tmp")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                dati = zin.read(item.filename)
                if item.filename == DOC:
                    dati = document.encode("utf-8")
                elif item.filename == HDR:
                    dati = header.encode("utf-8")
                zout.writestr(item, dati)  # ZipInfo originale: compressione, date

    shutil.move(str(tmp), str(DST))
    print(f"Scritto {DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
