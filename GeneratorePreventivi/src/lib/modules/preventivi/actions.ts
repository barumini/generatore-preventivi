"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { quoteFormSchema } from "@/lib/shared/validation";
import { computeTotals, parseNum } from "./calc";
import { toQuoteDTO } from "./queries";
import type { QuoteFormInput, QuoteDTO } from "./types";
import type { Prisma } from "@/generated/prisma/client";

export type QuoteActionResult =
  | { ok: true; quote: QuoteDTO }
  | { ok: false; error: string };

function buildQuoteData(
  input: QuoteFormInput,
  client: { ragioneSociale: string; indirizzo: string | null; piva: string | null; codiceSdi: string | null; referenteDih: string | null }
) {
  const totals = computeTotals(
    input.items.map((item) => ({ qty: item.qty, price: item.unitPrice })),
    input.scontoPct,
    input.ivaPct
  );
  return {
    title: input.title,
    quoteDate: new Date(input.quoteDate),
    cup: input.cup || null,
    attivitaProgetto: input.attivitaProgetto || "",
    clientId: input.clientId,
    clientNomeSnap: client.ragioneSociale,
    clientIndirizzoSnap: client.indirizzo,
    clientPivaSnap: client.piva,
    clientSdiSnap: client.codiceSdi,
    clientReferenteSnap: client.referenteDih,
    scontoPct: parseNum(input.scontoPct),
    ivaPct: parseNum(input.ivaPct),
    imponibile: totals.imponibile,
    scontoAmt: totals.scontoAmt,
    subtotale: totals.subtotale,
    ivaAmt: totals.ivaAmt,
    totale: totals.totale,
  };
}

function itemsCreateInput(input: QuoteFormInput): Prisma.QuoteItemCreateWithoutQuoteInput[] {
  return input.items.map((item, index) => ({
    description: item.description,
    qty: parseNum(item.qty),
    unitPrice: parseNum(item.unitPrice),
    order: index,
    ...(item.catalogItemId ? { catalogItem: { connect: { id: item.catalogItemId } } } : {}),
  }));
}

type ValidateResult =
  | { success: true; data: QuoteFormInput; client: NonNullable<Awaited<ReturnType<typeof prisma.client.findUnique>>> }
  | { success: false; error: string };

async function validateAndLoadClient(input: QuoteFormInput): Promise<ValidateResult> {
  const parsed = quoteFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const client = await prisma.client.findUnique({ where: { id: parsed.data.clientId } });
  if (!client) {
    return { success: false, error: "Cliente non trovato." };
  }
  return { success: true, data: parsed.data, client };
}

export async function saveDraft(
  quoteId: string | null,
  input: QuoteFormInput
): Promise<QuoteActionResult> {
  const user = await requireUser();
  const result = await validateAndLoadClient(input);
  if (!result.success) return { ok: false, error: result.error };
  const { data, client } = result;

  if (quoteId) {
    const existing = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!existing) return { ok: false, error: "Preventivo non trovato." };
    if (existing.status === "ISSUED") {
      return { ok: false, error: "Il preventivo è già emesso e non è più modificabile." };
    }
  }

  const quoteData = buildQuoteData(data, client);

  const quote = await prisma.$transaction(async (tx) => {
    if (quoteId) {
      await tx.quoteItem.deleteMany({ where: { quoteId } });
      return tx.quote.update({
        where: { id: quoteId },
        data: { ...quoteData, items: { create: itemsCreateInput(data) } },
        include: { items: true },
      });
    }
    return tx.quote.create({
      data: { ...quoteData, createdById: user.id, items: { create: itemsCreateInput(data) } },
      include: { items: true },
    });
  });

  revalidatePath("/preventivi");
  revalidatePath(`/preventivi/${quote.id}`);
  return { ok: true, quote: toQuoteDTO(quote) };
}

export async function issueQuote(
  quoteId: string | null,
  input: QuoteFormInput
): Promise<QuoteActionResult> {
  const user = await requireUser();
  const result = await validateAndLoadClient(input);
  if (!result.success) return { ok: false, error: result.error };
  const { data, client } = result;
  const quoteData = buildQuoteData(data, client);

  const quote = await prisma.$transaction(async (tx) => {
    let current = quoteId ? await tx.quote.findUnique({ where: { id: quoteId } }) : null;

    if (!current) {
      current = await tx.quote.create({
        data: { ...quoteData, createdById: user.id, items: { create: itemsCreateInput(data) } },
      });
    }

    if (current.status === "ISSUED") {
      // Idempotent: already issued (double click / two tabs) — return as-is.
      return tx.quote.findUniqueOrThrow({ where: { id: current.id }, include: { items: true } });
    }

    await tx.quoteItem.deleteMany({ where: { quoteId: current.id } });
    await tx.quote.update({
      where: { id: current.id },
      data: { ...quoteData, items: { create: itemsCreateInput(data) } },
    });

    const updatedClient = await tx.client.update({
      where: { id: client.id },
      data: { lastIssuedSeq: { increment: 1 } },
    });
    const codiceServizio = `${updatedClient.codePrefix}-${String(updatedClient.lastIssuedSeq).padStart(3, "0")}`;

    return tx.quote.update({
      where: { id: current.id },
      data: {
        status: "ISSUED",
        codiceServizio,
        issuedAt: new Date(),
        issuedById: user.id,
      },
      include: { items: true },
    });
  });

  revalidatePath("/preventivi");
  revalidatePath(`/preventivi/${quote.id}`);
  return { ok: true, quote: toQuoteDTO(quote) };
}

export async function deleteDraft(quoteId: string): Promise<void> {
  await requireUser();
  const quote = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
  if (quote.status === "ISSUED") {
    throw new Error("Non è possibile eliminare un preventivo emesso.");
  }
  await prisma.quote.delete({ where: { id: quoteId } });
  revalidatePath("/preventivi");
}

export async function duplicateAsDraft(quoteId: string): Promise<{ id: string }> {
  const user = await requireUser();
  const source = await prisma.quote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { items: true },
  });

  const copy = await prisma.quote.create({
    data: {
      title: source.title,
      quoteDate: new Date(),
      cup: source.cup,
      attivitaProgetto: source.attivitaProgetto,
      clientId: source.clientId,
      clientNomeSnap: source.clientNomeSnap,
      clientIndirizzoSnap: source.clientIndirizzoSnap,
      clientPivaSnap: source.clientPivaSnap,
      clientSdiSnap: source.clientSdiSnap,
      clientReferenteSnap: source.clientReferenteSnap,
      scontoPct: source.scontoPct,
      ivaPct: source.ivaPct,
      imponibile: source.imponibile,
      scontoAmt: source.scontoAmt,
      subtotale: source.subtotale,
      ivaAmt: source.ivaAmt,
      totale: source.totale,
      createdById: user.id,
      items: {
        create: source.items.map((item) => ({
          catalogItemId: item.catalogItemId,
          description: item.description,
          qty: item.qty,
          unitPrice: item.unitPrice,
          order: item.order,
        })),
      },
    },
  });

  revalidatePath("/preventivi");
  return { id: copy.id };
}
