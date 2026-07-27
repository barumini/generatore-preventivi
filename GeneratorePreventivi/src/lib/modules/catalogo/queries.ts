import { prisma } from "@/lib/db";

export function listCatalogItems() {
  return prisma.catalogItem.findMany({
    orderBy: [{ active: "desc" }, { description: "asc" }],
  });
}

export function listActiveCatalogItems() {
  return prisma.catalogItem.findMany({
    where: { active: true },
    orderBy: { description: "asc" },
  });
}

export function getCatalogItem(id: string) {
  return prisma.catalogItem.findUnique({ where: { id } });
}
