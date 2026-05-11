-- Add simple student accounts and sessions.
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "passwordSalt" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" TIMESTAMP(3),
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing shared classroom data to a legacy owner.
INSERT INTO "User" ("id", "username", "passwordHash", "passwordSalt")
VALUES ('legacy-classroom-user', 'legacy-classroom', 'legacy', 'legacy')
ON CONFLICT ("username") DO NOTHING;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
UPDATE "Project" SET "ownerId" = 'legacy-classroom-user' WHERE "ownerId" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Project_ownerId_updatedAt_idx" ON "Project"("ownerId", "updatedAt");

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
UPDATE "Asset" SET "ownerId" = 'legacy-classroom-user' WHERE "ownerId" IS NULL;
ALTER TABLE "Asset" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Asset_ownerId_createdAt_idx" ON "Asset"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Asset_projectId_idx" ON "Asset"("projectId");

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
