-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('purchase_request', 'payment', 'reimbursement', 'contract', 'drawing');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalRecordAction" AS ENUM ('approve', 'reject');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('approval', 'inventory', 'procurement', 'finance', 'system');

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "business_id" TEXT NOT NULL,
    "project_id" TEXT,
    "initiator_id" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "current_node" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "node" INTEGER NOT NULL,
    "approver_id" TEXT NOT NULL,
    "action" "ApprovalRecordAction" NOT NULL,
    "comment" TEXT,
    "acted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_templates" (
    "id" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "name" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_instances_code_key" ON "approval_instances"("code");

-- CreateIndex
CREATE INDEX "approval_instances_type_idx" ON "approval_instances"("type");

-- CreateIndex
CREATE INDEX "approval_instances_status_idx" ON "approval_instances"("status");

-- CreateIndex
CREATE INDEX "approval_instances_initiator_id_idx" ON "approval_instances"("initiator_id");

-- CreateIndex
CREATE INDEX "approval_instances_project_id_idx" ON "approval_instances"("project_id");

-- CreateIndex
CREATE INDEX "approval_instances_business_id_type_idx" ON "approval_instances"("business_id", "type");

-- CreateIndex
CREATE INDEX "approval_records_instance_id_idx" ON "approval_records"("instance_id");

-- CreateIndex
CREATE INDEX "approval_records_approver_id_idx" ON "approval_records"("approver_id");

-- CreateIndex
CREATE INDEX "approval_templates_type_is_active_idx" ON "approval_templates"("type", "is_active");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_initiator_id_fkey" FOREIGN KEY ("initiator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
