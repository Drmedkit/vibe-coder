/*
  Warnings:

  - You are about to drop the column `description` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `isFeatured` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `isPublished` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `views` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Asset` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Classroom` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ClassroomProject` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Enrollment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Fork` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Like` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `passwordHash` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Asset" DROP CONSTRAINT "Asset_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Classroom" DROP CONSTRAINT "Classroom_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "ClassroomProject" DROP CONSTRAINT "ClassroomProject_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "ClassroomProject" DROP CONSTRAINT "ClassroomProject_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_classroomId_fkey";

-- DropForeignKey
ALTER TABLE "Enrollment" DROP CONSTRAINT "Enrollment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Fork" DROP CONSTRAINT "Fork_originalProjectId_fkey";

-- DropForeignKey
ALTER TABLE "Fork" DROP CONSTRAINT "Fork_userId_fkey";

-- DropForeignKey
ALTER TABLE "Like" DROP CONSTRAINT "Like_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Like" DROP CONSTRAINT "Like_userId_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "description",
DROP COLUMN "isFeatured",
DROP COLUMN "isPublished",
DROP COLUMN "views";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "email",
DROP COLUMN "name",
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "firstLogin" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "passwordHash" SET NOT NULL;

-- DropTable
DROP TABLE "Asset";

-- DropTable
DROP TABLE "Classroom";

-- DropTable
DROP TABLE "ClassroomProject";

-- DropTable
DROP TABLE "Enrollment";

-- DropTable
DROP TABLE "Fork";

-- DropTable
DROP TABLE "Like";

-- DropEnum
DROP TYPE "AssetType";

-- CreateTable
CREATE TABLE "ProjectVersion" (
    "id" TEXT NOT NULL,
    "htmlCode" TEXT NOT NULL,
    "cssCode" TEXT NOT NULL,
    "jsCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "ProjectVersion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
