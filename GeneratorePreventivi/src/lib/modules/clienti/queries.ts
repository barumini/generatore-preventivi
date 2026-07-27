import { prisma } from "@/lib/db";

export function listClients() {
  return prisma.client.findMany({
    orderBy: [{ active: "desc" }, { ragioneSociale: "asc" }],
  });
}

export function listActiveClients() {
  return prisma.client.findMany({
    where: { active: true },
    orderBy: { ragioneSociale: "asc" },
  });
}

export function getClient(id: string) {
  return prisma.client.findUnique({ where: { id } });
}
