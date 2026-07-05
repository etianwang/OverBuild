-- AlterTable
ALTER TABLE "project_tasks" ADD COLUMN "labor_count" INTEGER;
ALTER TABLE "project_tasks" ADD COLUMN "duration_days" DECIMAL(10,2);
ALTER TABLE "project_tasks" ADD COLUMN "prerequisites" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN "predecessor_id" TEXT;
ALTER TABLE "project_tasks" ADD COLUMN "assignee_id" TEXT;

-- CreateIndex
CREATE INDEX "project_tasks_predecessor_id_idx" ON "project_tasks"("predecessor_id");
CREATE INDEX "project_tasks_assignee_id_idx" ON "project_tasks"("assignee_id");

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
