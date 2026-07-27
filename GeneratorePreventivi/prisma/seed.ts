import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CATALOG: Array<{ description: string; unitPrice: number }> = [
  { description: "Assessment maturità digitale (DMA)", unitPrice: 2500 },
  { description: "Test before invest — Intelligenza Artificiale", unitPrice: 4200 },
  { description: "Cybersecurity assessment", unitPrice: 3200 },
  { description: "Formazione competenze digitali", unitPrice: 1800 },
  { description: "Consulenza adozione tecnologie 4.0", unitPrice: 2800 },
  { description: "Dimostrazione tecnologica (demo)", unitPrice: 1500 },
  { description: "Analisi processi e roadmap digitale", unitPrice: 3600 },
];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@dihvicenza.it";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "cambiami-subito";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Amministratore DIH",
      passwordHash: await hashPassword(adminPassword),
    },
  });
  console.log(`Utente pronto: ${admin.email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.log(
      `  password provvisoria: "${adminPassword}" — cambiarla al primo accesso.`
    );
  }

  for (const item of CATALOG) {
    const existing = await prisma.catalogItem.findFirst({
      where: { description: item.description },
    });
    if (!existing) {
      await prisma.catalogItem.create({
        data: { description: item.description, unitPrice: item.unitPrice },
      });
    }
  }
  console.log(`Catalogo servizi popolato (${CATALOG.length} voci).`);

  const demoClient = await prisma.client.findFirst({
    where: { ragioneSociale: "Nome Azienda SRL" },
  });
  if (!demoClient) {
    await prisma.client.create({
      data: {
        ragioneSociale: "Nome Azienda SRL",
        indirizzo: "Via con nome lungo 12, 36100, Nome città (VI)",
        piva: "00000000000",
        codiceSdi: "SUBM70N",
        referenteDih: "Nome del referente DIH",
        codePrefix: "NOM",
      },
    });
    console.log("Cliente demo creato: Nome Azienda SRL (NOM).");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
