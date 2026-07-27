import { prisma } from "@/lib/db";

function slug(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function isTaken(codePrefix: string, excludeId?: string): Promise<boolean> {
  const existing = await prisma.client.findFirst({
    where: { codePrefix, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return existing !== null;
}

/**
 * Derives a short, unique client code from the company name: first 3 letters,
 * extended to 4-6 or given a numeric suffix on collision (ROS, ROSS, ROS2, …).
 */
export async function generateUniqueCodePrefix(
  ragioneSociale: string,
  excludeId?: string
): Promise<string> {
  const base = slug(ragioneSociale) || "CLI";

  const maxLen = Math.min(6, Math.max(3, base.length));
  for (let len = Math.min(3, base.length); len <= maxLen; len++) {
    const candidate = base.slice(0, len);
    if (!(await isTaken(candidate, excludeId))) return candidate;
  }

  const root = base.slice(0, 3) || "CLI";
  let n = 2;
  while (await isTaken(`${root}${n}`, excludeId)) {
    n++;
  }
  return `${root}${n}`;
}
