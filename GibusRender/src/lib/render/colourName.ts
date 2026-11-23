// Parola inglese del colore ricavata dal "Colore di anteprima" del catalogo (#RRGGBB).
// Serve al prompt: nelle prove il solo nome italiano e il codice RAL non bastavano,
// un Bianco RAL 9010 usciva grigio. Usato anche lato browser: nessuna dipendenza.

/** "#RRGGBB" in maiuscolo, oppure null se il valore non è un esadecimale a 6 cifre. */
export function normalizeHex(hex: string | null | undefined): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

/** Nome semplice in inglese (white, light grey, anthracite grey, beige, blue…), o null. */
export function colourName(hex: string | null | undefined): string | null {
  const norm = normalizeHex(hex);
  if (!norm) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(norm.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const light = (max + min) / 2;

  // Neutri (anche i bianchi caldi come il RAL 9010): conta solo la luminosità.
  if (chroma < 0.1) {
    if (light >= 0.85) return "white";
    if (light >= 0.65) return "light grey";
    if (light >= 0.4) return "grey";
    if (light >= 0.15) return "anthracite grey";
    return "black";
  }

  let hue: number;
  if (max === r) hue = ((g - b) / chroma) % 6;
  else if (max === g) hue = (b - r) / chroma + 2;
  else hue = (r - g) / chroma + 4;
  hue = (hue * 60 + 360) % 360;

  // Toni caldi poco saturi: beige e marroni (corten, legno) prima dei nomi di tinta.
  if (hue >= 15 && hue < 50) {
    if (light >= 0.7) return "beige";
    if (light >= 0.25) return "brown";
    return "dark brown";
  }

  const base =
    hue < 15 || hue >= 345
      ? "red"
      : hue < 70
        ? "yellow"
        : hue < 170
          ? "green"
          : hue < 260
            ? "blue"
            : "purple";
  if (light >= 0.7) return `light ${base}`;
  if (light < 0.25) return `dark ${base}`;
  return base;
}
