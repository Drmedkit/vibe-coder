CREATE TABLE IF NOT EXISTS "AiUsageEvent" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AiUsageEvent"
  ADD CONSTRAINT "AiUsageEvent_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AiUsageEvent_ownerId_createdAt_idx" ON "AiUsageEvent"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "AiUsageEvent_ownerId_intent_createdAt_idx" ON "AiUsageEvent"("ownerId", "intent", "createdAt");
