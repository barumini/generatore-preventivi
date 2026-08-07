-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Revisione" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "preventivoId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "luogo" TEXT NOT NULL,
    "stato" TEXT NOT NULL DEFAULT 'bozza',
    "statoForm" TEXT NOT NULL DEFAULT '',
    "inputCalcolo" TEXT NOT NULL,
    "risultatoCalcolo" TEXT NOT NULL,
    CONSTRAINT "Revisione_preventivoId_fkey" FOREIGN KEY ("preventivoId") REFERENCES "Preventivo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Revisione" ("data", "id", "inputCalcolo", "luogo", "numero", "preventivoId", "risultatoCalcolo", "stato") SELECT "data", "id", "inputCalcolo", "luogo", "numero", "preventivoId", "risultatoCalcolo", "stato" FROM "Revisione";
DROP TABLE "Revisione";
ALTER TABLE "new_Revisione" RENAME TO "Revisione";
CREATE UNIQUE INDEX "Revisione_preventivoId_numero_key" ON "Revisione"("preventivoId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
