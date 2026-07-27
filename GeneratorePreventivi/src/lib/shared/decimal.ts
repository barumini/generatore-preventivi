import type { Prisma } from "@/generated/prisma/client";

/** Prisma Decimal isn't serializable across the Server/Client Component boundary. */
export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return typeof value === "object" ? Number(value.toString()) : Number(value);
}
