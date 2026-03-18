-- Drop ProjectVersion first (foreign key to Project)
DROP TABLE IF EXISTS "ProjectVersion";

-- Remove userId foreign key constraint and column from Project
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_userId_fkey";
ALTER TABLE "Project" DROP COLUMN IF EXISTS "userId";

-- Drop User table
DROP TABLE IF EXISTS "User";

-- Drop UserRole enum
DROP TYPE IF EXISTS "UserRole";
