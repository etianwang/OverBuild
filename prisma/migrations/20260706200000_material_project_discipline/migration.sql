-- CreateEnum
CREATE TYPE "MaterialDiscipline" AS ENUM ('civil', 'mep', 'finishing', 'general');

-- AlterTable material_categories
ALTER TABLE "material_categories" ADD COLUMN "discipline" "MaterialDiscipline" NOT NULL DEFAULT 'general';

-- AlterTable materials: add project and storage fields
ALTER TABLE "materials" ADD COLUMN "project_id" TEXT;
ALTER TABLE "materials" ADD COLUMN "storage_location" TEXT;
ALTER TABLE "materials" ADD COLUMN "warehouse_id" TEXT;

-- Backfill project_id from demo project for existing rows
UPDATE "materials" m
SET "project_id" = p.id
FROM "projects" p
WHERE m."project_id" IS NULL
  AND p."code" = 'PRJ-DEMO-001'
  AND p."deleted_at" IS NULL;

-- Fallback: first active project
UPDATE "materials" m
SET "project_id" = (
  SELECT id FROM "projects" WHERE "deleted_at" IS NULL ORDER BY "created_at" ASC LIMIT 1
)
WHERE m."project_id" IS NULL;

ALTER TABLE "materials" ALTER COLUMN "project_id" SET NOT NULL;

-- Drop global unique on code, add project-scoped unique
DROP INDEX IF EXISTS "materials_code_key";
CREATE UNIQUE INDEX "materials_project_id_code_key" ON "materials"("project_id", "code");
CREATE INDEX "materials_project_id_idx" ON "materials"("project_id");
CREATE INDEX "material_categories_discipline_idx" ON "material_categories"("discipline");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Update category disciplines for seed categories
UPDATE "material_categories" SET "discipline" = 'mep' WHERE "code" = 'PIPE';
UPDATE "material_categories" SET "discipline" = 'civil' WHERE "code" = 'STEEL';
