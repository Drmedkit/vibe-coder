CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
