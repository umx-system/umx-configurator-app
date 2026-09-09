-- CreateTable
CREATE TABLE "ModelDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "catalogCode" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "widthMm" REAL NOT NULL,
    "depthMm" REAL NOT NULL,
    "heightMm" REAL NOT NULL,
    "frontWidthMm" REAL,
    "gridWidth" INTEGER NOT NULL,
    "gridHeight" INTEGER NOT NULL,
    "placement" TEXT NOT NULL DEFAULT 'grid',
    "placementYOffsetMm" REAL NOT NULL DEFAULT 0,
    "supportsMarineBoardColor" BOOLEAN NOT NULL DEFAULT false,
    "previewTransform" TEXT NOT NULL DEFAULT 'scene',
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileSha256" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelDraft_fileKey_key" ON "ModelDraft"("fileKey");

-- CreateIndex
CREATE INDEX "ModelDraft_shop_updatedAt_idx" ON "ModelDraft"("shop", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModelDraft_shop_catalogCode_key" ON "ModelDraft"("shop", "catalogCode");

