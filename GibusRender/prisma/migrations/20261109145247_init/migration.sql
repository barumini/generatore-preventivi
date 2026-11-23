-- CreateEnum
CREATE TYPE "MountType" AS ENUM ('ADDOSSATA', 'AUTOPORTANTE');

-- CreateEnum
CREATE TYPE "CoverType" AS ENUM ('TELO', 'LAMELLE_ORIENTABILI', 'LAMELLE_IMPACCHETTAMENTO');

-- CreateEnum
CREATE TYPE "FinishKind" AS ENUM ('COLORE', 'TESSUTO');

-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mountType" "MountType" NOT NULL,
    "coverType" "CoverType" NOT NULL,
    "aiDescription" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "depthMm" INTEGER NOT NULL,
    "clearHeightMm" INTEGER NOT NULL,
    "totalHeightMm" INTEGER NOT NULL,
    "defaultColorId" TEXT,
    "defaultFabricId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReferenceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finish" (
    "id" TEXT NOT NULL,
    "kind" "FinishKind" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "swatchHex" TEXT,

    CONSTRAINT "Finish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFinish" (
    "productId" TEXT NOT NULL,
    "finishId" TEXT NOT NULL,

    CONSTRAINT "ProductFinish_pkey" PRIMARY KEY ("productId","finishId")
);

-- CreateTable
CREATE TABLE "Render" (
    "id" TEXT NOT NULL,
    "clientRef" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "photoWidth" INTEGER NOT NULL,
    "photoHeight" INTEGER NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "depthMm" INTEGER NOT NULL,
    "clearHeightMm" INTEGER NOT NULL,
    "totalHeightMm" INTEGER NOT NULL,
    "colorId" TEXT,
    "fabricId" TEXT,
    "polygon" JSONB,
    "positionText" TEXT NOT NULL,
    "scaleLine" JSONB,
    "prompt" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "variantsRequested" INTEGER NOT NULL,
    "disclaimer" BOOLEAN NOT NULL DEFAULT false,
    "chosenVariantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Render_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "renderId" TEXT NOT NULL,
    "status" "VariantStatus" NOT NULL DEFAULT 'PENDING',
    "imageUrl" TEXT,
    "protected" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "activeProviderId" TEXT NOT NULL,
    "activeModel" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "enabledProviders" TEXT[],
    "defaultVariants" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE INDEX "ReferenceImage_productId_idx" ON "ReferenceImage"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Finish_code_key" ON "Finish"("code");

-- CreateIndex
CREATE INDEX "Render_createdAt_idx" ON "Render"("createdAt");

-- CreateIndex
CREATE INDEX "Variant_renderId_idx" ON "Variant"("renderId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultColorId_fkey" FOREIGN KEY ("defaultColorId") REFERENCES "Finish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_defaultFabricId_fkey" FOREIGN KEY ("defaultFabricId") REFERENCES "Finish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceImage" ADD CONSTRAINT "ReferenceImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFinish" ADD CONSTRAINT "ProductFinish_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFinish" ADD CONSTRAINT "ProductFinish_finishId_fkey" FOREIGN KEY ("finishId") REFERENCES "Finish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "Finish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Render" ADD CONSTRAINT "Render_fabricId_fkey" FOREIGN KEY ("fabricId") REFERENCES "Finish"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_renderId_fkey" FOREIGN KEY ("renderId") REFERENCES "Render"("id") ON DELETE CASCADE ON UPDATE CASCADE;
