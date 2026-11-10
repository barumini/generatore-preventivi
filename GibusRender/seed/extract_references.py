"""Estrae le immagini di riferimento dei prodotti dai PDF di esempio Gibus.

Uso: python3 -I seed/extract_references.py <cartella_esempi> seed/images

Per ogni PDF cerca le pagine "VISTA 3D", "VISTA FRONTALE" e "VISTA IN PIANTA",
le rasterizza a 200 dpi, tiene la fascia verticale tra TOP e BOTTOM dell'altezza
(toglie intestazione, logo e nota a piè di pagina) e rifila i margini bianchi.
sabrina.pdf contiene due prodotti affiancati: metà sinistra = prodotto 3,
metà destra = prodotto 4.
"""

import sys
from pathlib import Path

import pymupdf

DPI = 200
# La brief suggeriva 19%-94%: a 19% resta il titolo "VISTA ..." (19,8%-22,9%)
# e a 94% si tagliano i piedi dei montanti; la nota a piè di pagina parte dal 95,4%.
TOP = 0.235
BOTTOM = 0.95
WHITE_THRESHOLD = 240  # i pixel più chiari di così contano come sfondo
MARGIN_PX = 12

VIEWS = {"VISTA 3D": "3d", "VISTA FRONTALE": "frontale", "VISTA IN PIANTA": "pianta"}

# (file, [(numero prodotto, frazione orizzontale sinistra, destra)])
SOURCES = [
    ("bonetto.pdf", [(1, 0.0, 1.0)]),
    ("mariasole.pdf", [(2, 0.0, 1.0)]),
    ("sabrina.pdf", [(3, 0.0, 0.5), (4, 0.5, 1.0)]),
]

_NORMALIZE = bytes(255 if v >= WHITE_THRESHOLD else 0 for v in range(256))


def content_bbox(pix: pymupdf.Pixmap):
    """Riquadro (x0, y0, x1, y1) in pixel del contenuto non bianco, o None."""
    stride, n = pix.stride, pix.n
    data = pix.samples.translate(_NORMALIZE)
    row_len = pix.width * n
    top = bottom = None
    left, right = pix.width, -1
    for y in range(pix.height):
        row = data[y * stride : y * stride + row_len]
        stripped_l = row.lstrip(b"\xff")
        if not stripped_l:
            continue
        if top is None:
            top = y
        bottom = y
        first = (row_len - len(stripped_l)) // n
        last = (len(row.rstrip(b"\xff")) - 1) // n
        left = min(left, first)
        right = max(right, last)
    if top is None:
        return None
    return left, top, right + 1, bottom + 1


def render_crop(page: pymupdf.Page, x0f: float, x1f: float) -> pymupdf.Pixmap:
    r = page.rect
    clip = pymupdf.Rect(r.x0 + r.width * x0f, r.y0 + r.height * TOP, r.x0 + r.width * x1f, r.y0 + r.height * BOTTOM)
    pix = page.get_pixmap(dpi=DPI, clip=clip, alpha=False, colorspace=pymupdf.csRGB)
    bbox = content_bbox(pix)
    if bbox is None:
        raise RuntimeError(f"Nessun contenuto nella pagina {page.number + 1}")
    scale = DPI / 72
    bx0, by0, bx1, by1 = bbox
    trimmed = pymupdf.Rect(
        max(clip.x0, clip.x0 + (bx0 - MARGIN_PX) / scale),
        max(clip.y0, clip.y0 + (by0 - MARGIN_PX) / scale),
        min(clip.x1, clip.x0 + (bx1 + MARGIN_PX) / scale),
        min(clip.y1, clip.y0 + (by1 + MARGIN_PX) / scale),
    )
    return page.get_pixmap(dpi=DPI, clip=trimmed, alpha=False, colorspace=pymupdf.csRGB)


def find_pages(doc: pymupdf.Document) -> dict:
    found = {}
    for page in doc:
        text = page.get_text().upper()
        for title, slug in VIEWS.items():
            if slug not in found and title in text:
                found[slug] = page
    missing = [s for s in VIEWS.values() if s not in found]
    if missing:
        raise RuntimeError(f"Pagine mancanti in {doc.name}: {', '.join(missing)}")
    return found


def main(argv: list) -> int:
    if len(argv) != 3:
        print(__doc__)
        return 2
    src_dir, out_dir = Path(argv[1]), Path(argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    for filename, products in SOURCES:
        doc = pymupdf.open(src_dir / filename)
        pages = find_pages(doc)
        for slug, page in pages.items():
            for num, x0f, x1f in products:
                pix = render_crop(page, x0f, x1f)
                out = out_dir / f"p{num}-{slug}.png"
                pix.save(out)
                print(f"{out} {pix.width}x{pix.height} (pagina {page.number + 1} di {filename})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
