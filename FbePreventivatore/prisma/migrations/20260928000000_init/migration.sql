-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "comune" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Preventivo" (
    "id" TEXT NOT NULL,
    "protocollo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "oggetto" TEXT NOT NULL,
    "progettista" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Preventivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revisione" (
    "id" TEXT NOT NULL,
    "preventivoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "luogo" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'bozza',
    "statoForm" TEXT NOT NULL DEFAULT '',
    "inputCalcolo" TEXT NOT NULL,
    "risultatoCalcolo" TEXT NOT NULL,
    "documentoGeneratoAt" TIMESTAMP(3),

    CONSTRAINT "Revisione_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Preventivo_protocollo_key" ON "Preventivo"("protocollo");

-- CreateIndex
CREATE UNIQUE INDEX "Revisione_preventivoId_numero_key" ON "Revisione"("preventivoId", "numero");

-- AddForeignKey
ALTER TABLE "Preventivo" ADD CONSTRAINT "Preventivo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revisione" ADD CONSTRAINT "Revisione_preventivoId_fkey" FOREIGN KEY ("preventivoId") REFERENCES "Preventivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

