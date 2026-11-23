-- AlterTable
ALTER TABLE "Render" ADD COLUMN     "comparisonId" TEXT;

-- CreateTable
CREATE TABLE "Comparison" (
    "id" TEXT NOT NULL,
    "clientRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Render_comparisonId_idx" ON "Render"("comparisonId");

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "Comparison"("id") ON DELETE SET NULL ON UPDATE CASCADE;
