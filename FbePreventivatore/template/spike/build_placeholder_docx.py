#!/usr/bin/env python3
"""
Spike helper (not part of the shipped app): builds
template/spike/master-con-placeholder.docx from
template/spike/master-originale.docx by editing word/document.xml
directly inside the zip, without ever extracting+re-zipping the whole
package (avoids corrupting Content_Types / relationships).

Edits:
1. Replaces the two runs "Baetta" / " Matteo" inside the mc:AlternateContent
   text box (both the mc:Choice/wps:txbx branch and the mc:Fallback/VML
   branch, which duplicate the same paragraph) so the visible text becomes
   "Sig. {cliente}". This is the high-risk case: placeholder inside a
   text box guarded by mc:AlternateContent.
2. Inserts a brand-new plain paragraph "<w:p><w:r><w:t>{totaleNetto}</w:t>
   </w:r></w:p>" immediately before the final <w:sectPr> (which must remain
   the last child of <w:body> per OOXML - so "immediately before </w:body>"
   in practice means immediately before that trailing sectPr, not literally
   between sectPr and </w:body>).
"""
import re
import sys
import zipfile
from pathlib import Path

SPIKE_DIR = Path(__file__).resolve().parent
SRC = SPIKE_DIR / "master-originale.docx"
DST = SPIKE_DIR / "master-con-placeholder.docx"

OLD_NAME_RUNS = (
    '<w:r w:rsidRPr="0091511B" w:rsidR="00626EA7"><w:rPr><w:b /><w:sz w:val="44" />'
    '<w:u w:val="single" /></w:rPr><w:t>Baetta</w:t></w:r>'
    '<w:r w:rsidRPr="0091511B" w:rsidR="00626EA7"><w:rPr><w:b /><w:sz w:val="44" />'
    '<w:u w:val="single" /></w:rPr><w:t xml:space="preserve"> Matteo</w:t></w:r>'
)

NEW_NAME_RUNS = (
    '<w:r w:rsidRPr="0091511B" w:rsidR="00626EA7"><w:rPr><w:b /><w:sz w:val="44" />'
    '<w:u w:val="single" /></w:rPr><w:t>{cliente}</w:t></w:r>'
    '<w:r w:rsidRPr="0091511B" w:rsidR="00626EA7"><w:rPr><w:b /><w:sz w:val="44" />'
    '<w:u w:val="single" /></w:rPr><w:t xml:space="preserve"></w:t></w:r>'
)

NEW_PARAGRAPH = '<w:p><w:r><w:t>{totaleNetto}</w:t></w:r></w:p>'


def main() -> int:
    if not SRC.exists():
        print(f"ERRORE: sorgente non trovata: {SRC}", file=sys.stderr)
        return 1

    with zipfile.ZipFile(SRC, "r") as zin:
        document_xml = zin.read("word/document.xml").decode("utf-8")

        occurrences = document_xml.count(OLD_NAME_RUNS)
        if occurrences != 2:
            print(
                f"ERRORE: attese 2 occorrenze del testo 'Baetta'/' Matteo' "
                f"(Choice + Fallback), trovate {occurrences}. Non procedo.",
                file=sys.stderr,
            )
            return 1
        document_xml = document_xml.replace(OLD_NAME_RUNS, NEW_NAME_RUNS)

        # Sanity: the literal name text must be gone from those two spots,
        # and the placeholder must now appear (at least) twice.
        assert document_xml.count("{cliente}") == 2, "sostituzione {cliente} fallita"

        # Insert the {totaleNetto} paragraph right before the LAST <w:sectPr
        # (the body-level, final section properties). It must remain the
        # last child of <w:body> per OOXML, so we cannot literally put a
        # paragraph after it.
        last_sectpr_idx = document_xml.rfind("<w:sectPr")
        if last_sectpr_idx == -1:
            print("ERRORE: non trovo <w:sectPr> finale nel documento.", file=sys.stderr)
            return 1

        document_xml = (
            document_xml[:last_sectpr_idx]
            + NEW_PARAGRAPH
            + document_xml[last_sectpr_idx:]
        )

        assert document_xml.count("{totaleNetto}") == 1, "inserimento {totaleNetto} fallito"

        with zipfile.ZipFile(DST, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename == "word/document.xml":
                    data = document_xml.encode("utf-8")
                # Preserve original ZipInfo (compression type, dates, etc.)
                zout.writestr(item, data)

    print(f"Scritto {DST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
