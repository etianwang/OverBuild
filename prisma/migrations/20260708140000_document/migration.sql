-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "DocumentFileType" AS ENUM ('pdf', 'dwg', 'image', 'office');

-- CreateEnum
CREATE TYPE "TranslationSourceType" AS ENUM ('document', 'drawing', 'entity');

-- CreateEnum
CREATE TYPE "TranslationTaskStatus" AS ENUM ('pending', 'auto', 'manual', 'completed');

-- CreateTable
CREATE TABLE "document_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_fr" TEXT,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_fr" TEXT,
    "project_id" TEXT NOT NULL,
    "category_id" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" "DocumentStatus" NOT NULL DEFAULT 'active',
    "search_text" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" "DocumentFileType" NOT NULL,
    "file_size" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translation_tasks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source_type" "TranslationSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_lang" "Locale" NOT NULL,
    "target_lang" "Locale" NOT NULL,
    "status" "TranslationTaskStatus" NOT NULL DEFAULT 'pending',
    "assignee_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_categories_project_id_idx" ON "document_categories"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_code_key" ON "documents"("code");

-- CreateIndex
CREATE INDEX "documents_project_id_idx" ON "documents"("project_id");

-- CreateIndex
CREATE INDEX "documents_category_id_idx" ON "documents"("category_id");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "document_versions_document_id_idx" ON "document_versions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_document_id_version_key" ON "document_versions"("document_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "translation_tasks_code_key" ON "translation_tasks"("code");

-- CreateIndex
CREATE INDEX "translation_tasks_source_type_source_id_idx" ON "translation_tasks"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "translation_tasks_status_idx" ON "translation_tasks"("status");

-- AddForeignKey
ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
