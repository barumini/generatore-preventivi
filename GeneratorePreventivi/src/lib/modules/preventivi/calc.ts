export function parseNum(s: unknown): number {
  let v = String(s == null ? "" : s)
    .trim()
    .replace(/[^0-9.,]/g, "");
  if (v.includes(".") && v.includes(",")) {
    v = v.replace(/\./g, "").replace(",", ".");
  } else if (v.includes(",")) {
    v = v.replace(",", ".");
  }
  return parseFloat(v) || 0;
}

export function fmt(n: number): string {
  const neg = Number(n) < 0;
  const parts = Math.abs(Number(n) || 0)
    .toFixed(2)
    .split(".");
  const intGrouped = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (neg ? "− " : "") + "€ " + intGrouped + "," + parts[1];
}

export type QuoteTotals = {
  imponibile: number;
  scontoAmt: number;
  subtotale: number;
  ivaAmt: number;
  totale: number;
};

export function computeTotals(
  items: Array<{ qty: number | string; price: number | string }>,
  scontoPct: number | string,
  ivaPct: number | string
): QuoteTotals {
  const imponibile = items.reduce(
    (acc, it) => acc + parseNum(it.qty) * parseNum(it.price),
    0
  );
  const scontoAmt = (imponibile * parseNum(scontoPct)) / 100;
  const subtotale = imponibile - scontoAmt;
  const ivaAmt = (subtotale * parseNum(ivaPct)) / 100;
  const totale = subtotale + ivaAmt;
  return { imponibile, scontoAmt, subtotale, ivaAmt, totale };
}
