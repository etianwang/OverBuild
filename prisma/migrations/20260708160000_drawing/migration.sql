-- CreateEnum
CREATE TYPE "DrawingDiscipline" AS ENUM ('arch', 'struct', 'mep', 'civil', 'other');

-- CreateEnum
CREATE TYPE "DrawingStatus" AS ENUM ('draft', 'reviewing', 'approved', 'published');

-- CreateEnum
CREATE TYPE "DrawingFileType" AS ENUM ('dwg', 'pdf', 'image');

-- CreateEnum
CREATE TYPE "DrawingReviewResult" AS ENUM ('approved', 'rejected');

-- CreateTable
CREATE TABLE "drawings" (
    "id" TEXT NOT NULL,
    "drawing_no" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_fr" TEXT,
    "project_id" TEXT NOT NULL,
    "discipline" "DrawingDiscipline" NOT NULL,
    "zone_id" TEXT,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" "DrawingStatus" NOT NULL DEFAULT 'draft',
    "search_text" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_versions" (
    "id" TEXT NOT NULL,
    "drawing_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" "DrawingFileType" NOT NULL,
    "file_size" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_reviews" (
    "id" TEXT NOT NULL,
    "drawing_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "comment" TEXT,
    "result" "DrawingReviewResult" NOT NULL,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drawings_drawing_no_key" ON "drawings"("drawing_no");

-- CreateIndex
CREATE INDEX "drawings_project_id_idx" ON "drawings"("project_id");

-- CreateIndex
CREATE INDEX "drawings_discipline_idx" ON "drawings"("discipline");

-- CreateIndex
CREATE INDEX "drawings_status_idx" ON "drawings"("status");

-- CreateIndex
CREATE INDEX "drawing_versions_drawing_id_idx" ON "drawing_versions"("drawing_id");

-- CreateIndex
CREATE UNIQUE INDEX "drawing_versions_drawing_id_version_key" ON "drawing_versions"("drawing_id", "version");

-- CreateIndex
CREATE INDEX "drawing_reviews_drawing_id_idx" ON "drawing_reviews"("drawing_id");

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "project_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawings" ADD CONSTRAINT "drawings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_versions" ADD CONSTRAINT "drawing_versions_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_versions" ADD CONSTRAINT "drawing_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_reviews" ADD CONSTRAINT "drawing_reviews_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_reviews" ADD CONSTRAINT "drawing_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
