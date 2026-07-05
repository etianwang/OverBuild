-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "name_fr" TEXT,
    "zone_id" TEXT,
    "parent_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_tasks_project_id_idx" ON "project_tasks"("project_id");
CREATE INDEX "project_tasks_zone_id_idx" ON "project_tasks"("zone_id");
CREATE INDEX "project_tasks_parent_id_idx" ON "project_tasks"("parent_id");

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "project_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
