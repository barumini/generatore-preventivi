import { prisma } from "@/lib/db";
import { decimalToNumber } from "@/lib/shared/decimal";

export async function getStatusCounts() {
  const grouped = await prisma.quote.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const draft = grouped.find((g) => g.status === "DRAFT")?._count._all ?? 0;
  const issued = grouped.find((g) => g.status === "ISSUED")?._count._all ?? 0;
  return { draft, issued };
}

export async function getIssuedTotalsSummary() {
  const issued = await prisma.quote.findMany({
    where: { status: "ISSUED" },
    select: { totale: true },
  });
  const totalValue = issued.reduce((acc, q) => acc + decimalToNumber(q.totale), 0);
  const avgValue = issued.length ? totalValue / issued.length : 0;
  return { count: issued.length, totalValue, avgValue };
}

export async function getMonthlyTotals(monthsBack = 6) {
  const since = new Date();
  since.setMonth(since.getMonth() - (monthsBack - 1));
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const issued = await prisma.quote.findMany({
    where: { status: "ISSUED", issuedAt: { gte: since } },
    select: { issuedAt: true, totale: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(since);
    d.setMonth(d.getMonth() + i);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
  }

  for (const q of issued) {
    if (!q.issuedAt) continue;
    const key = `${q.issuedAt.getFullYear()}-${String(q.issuedAt.getMonth() + 1).padStart(2, "0")}`;
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + decimalToNumber(q.totale));
    }
  }

  return Array.from(buckets.entries()).map(([month, total]) => ({ month, total }));
}

export async function getTopCatalogItems(limit = 5) {
  const grouped = await prisma.quoteItem.groupBy({
    by: ["catalogItemId"],
    where: { catalogItemId: { not: null } },
    _count: { _all: true },
    _sum: { qty: true },
    orderBy: { _count: { catalogItemId: "desc" } },
    take: limit,
  });

  const items = await prisma.catalogItem.findMany({
    where: { id: { in: grouped.map((g) => g.catalogItemId).filter((id): id is string => id !== null) } },
  });

  return grouped.map((g) => {
    const item = items.find((i) => i.id === g.catalogItemId);
    return {
      description: item?.description ?? "(voce eliminata)",
      count: g._count._all,
      totalQty: decimalToNumber(g._sum.qty ?? 0),
    };
  });
}

export async function getTopClients(limit = 5) {
  const grouped = await prisma.quote.groupBy({
    by: ["clientId"],
    where: { status: "ISSUED" },
    _sum: { totale: true },
    _count: { _all: true },
    orderBy: { _sum: { totale: "desc" } },
    take: limit,
  });

  const clients = await prisma.client.findMany({
    where: { id: { in: grouped.map((g) => g.clientId) } },
  });

  return grouped.map((g) => {
    const client = clients.find((c) => c.id === g.clientId);
    return {
      ragioneSociale: client?.ragioneSociale ?? "(cliente eliminato)",
      total: decimalToNumber(g._sum.totale ?? 0),
      count: g._count._all,
    };
  });
}
