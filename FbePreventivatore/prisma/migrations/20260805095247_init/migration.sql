-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "comune" TEXT NOT NULL,
    "provincia" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Preventivo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "protocollo" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "oggetto" TEXT NOT NULL,
    "progettista" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Preventivo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Revisione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "preventivoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "luogo" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'bozza',
    "inputCalcolo" TEXT NOT NULL,
    "risultatoCalcolo" TEXT NOT NULL,
    CONSTRAINT "Revisione_preventivoId_fkey" FOREIGN KEY ("preventivoId") REFERENCES "Preventivo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Preventivo_protocollo_key" ON "Preventivo"("protocollo");

-- CreateIndex
CREATE UNIQUE INDEX "Revisione_preventivoId_numero_key" ON "Revisione"("preventivoId", "numero");
