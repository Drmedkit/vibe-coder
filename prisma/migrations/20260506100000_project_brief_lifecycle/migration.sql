ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "phase" TEXT NOT NULL DEFAULT 'empty';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "brief" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "majorBuildCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "firstBuildAcceptedAt" TIMESTAMP(3);

UPDATE "Project"
SET "phase" = CASE
  WHEN COALESCE("htmlCode", '') <> ''
    OR COALESCE("cssCode", '') <> ''
    OR COALESCE("jsCode", '') <> ''
  THEN 'built'
  ELSE 'empty'
END
WHERE "phase" = 'empty';

UPDATE "Project"
SET "majorBuildCount" = 1
WHERE "majorBuildCount" = 0
  AND (
    COALESCE("htmlCode", '') <> ''
    OR COALESCE("cssCode", '') <> ''
    OR COALESCE("jsCode", '') <> ''
  );
