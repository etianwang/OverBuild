-- CreateEnum
CREATE TYPE "TranslationVersionSource" AS ENUM ('auto', 'manual');

-- AlterTable
ALTER TABLE "translation_tasks" ADD COLUMN "search_text" TEXT,
ADD COLUMN "created_by_id" TEXT;

-- CreateTable
CREATE TABLE "translation_versions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "source" "TranslationVersionSource" NOT NULL,
    "content" JSONB NOT NULL,
    "translated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glossary_terms" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "zh" TEXT,
    "fr" TEXT,
    "en" TEXT,
    "category" TEXT,
    "search_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity_translations" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "entity_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "translation_versions_task_id_idx" ON "translation_versions"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "translation_versions_task_id_source_key" ON "translation_versions"("task_id", "source");

-- CreateIndex
CREATE INDEX "glossary_terms_source_idx" ON "glossary_terms"("source");

-- CreateIndex
CREATE INDEX "entity_translations_entity_type_entity_id_idx" ON "entity_translations"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_translations_entity_type_entity_id_locale_field_key" ON "entity_translations"("entity_type", "entity_id", "locale", "field");

-- AddForeignKey
ALTER TABLE "translation_tasks" ADD CONSTRAINT "translation_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_tasks" ADD CONSTRAINT "translation_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_versions" ADD CONSTRAINT "translation_versions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "translation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translation_versions" ADD CONSTRAINT "translation_versions_translated_by_id_fkey" FOREIGN KEY ("translated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
