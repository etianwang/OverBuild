-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('construction', 'procurement', 'service', 'other');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'active', 'completed', 'terminated');

-- CreateEnum
CREATE TYPE "ContractChangeType" AS ENUM ('amount', 'period', 'terms', 'other');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_fr" TEXT,
    "project_id" TEXT NOT NULL,
    "party_a" TEXT NOT NULL,
    "party_b" TEXT NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "type" "ContractType" NOT NULL,
    "signed_at" DATE,
    "start_date" DATE,
    "end_date" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'draft',
    "collected_amount_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "collected_amount_currency" CHAR(3),
    "attachment_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_revisions" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "change_type" "ContractChangeType" NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "collected_at" DATE NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_code_key" ON "contracts"("code");

-- CreateIndex
CREATE INDEX "contracts_project_id_idx" ON "contracts"("project_id");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_type_idx" ON "contracts"("type");

-- CreateIndex
CREATE INDEX "contract_revisions_contract_id_idx" ON "contract_revisions"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "collections_code_key" ON "collections"("code");

-- CreateIndex
CREATE INDEX "collections_contract_id_idx" ON "collections"("contract_id");

-- CreateIndex
CREATE INDEX "collections_project_id_idx" ON "collections"("project_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_revisions" ADD CONSTRAINT "contract_revisions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_revisions" ADD CONSTRAINT "contract_revisions_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
