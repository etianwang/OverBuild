-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('draft', 'pending', 'approved', 'paid', 'rejected');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'bank');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('draft', 'pending', 'approved', 'rejected', 'paid');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('sales', 'purchase');

-- CreateEnum
CREATE TYPE "FinanceAccountType" AS ENUM ('cash', 'bank');

-- CreateEnum
CREATE TYPE "AccountTransactionType" AS ENUM ('income', 'payment', 'collection', 'reimbursement', 'adjustment');

-- CreateEnum
CREATE TYPE "CostSource" AS ENUM ('procurement', 'warehouse', 'manual', 'reimbursement');

-- AlterTable
ALTER TABLE "collections" ADD COLUMN "account_type" "FinanceAccountType" NOT NULL DEFAULT 'bank';
ALTER TABLE "collections" ADD COLUMN "account_id" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "incomes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "contract_id" TEXT,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "received_at" DATE NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "payee" TEXT NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL,
    "account_type" "FinanceAccountType" NOT NULL,
    "account_id" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'draft',
    "purchase_order_id" TEXT,
    "contract_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "description" TEXT,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'draft',
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_revisions" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT,
    "changed_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "costs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source" "CostSource" NOT NULL,
    "source_id" TEXT,
    "category" TEXT NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "occurred_at" DATE NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "tax_rate" DECIMAL(8,4),
    "issued_at" DATE NOT NULL,
    "contract_id" TEXT,
    "project_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "balance_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance_currency" CHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank_name" TEXT NOT NULL,
    "account_no" TEXT NOT NULL,
    "balance_amount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance_currency" CHAR(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_transactions" (
    "id" TEXT NOT NULL,
    "account_type" "FinanceAccountType" NOT NULL,
    "account_id" TEXT NOT NULL,
    "transaction_type" "AccountTransactionType" NOT NULL,
    "amount_amount" DECIMAL(18,4) NOT NULL,
    "amount_currency" CHAR(3) NOT NULL,
    "balance_after_amount" DECIMAL(18,4) NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "base_currency" CHAR(3) NOT NULL,
    "quote_currency" CHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "rate_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incomes_code_key" ON "incomes"("code");

-- CreateIndex
CREATE INDEX "incomes_project_id_idx" ON "incomes"("project_id");

-- CreateIndex
CREATE INDEX "incomes_contract_id_idx" ON "incomes"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_code_key" ON "payments"("code");

-- CreateIndex
CREATE INDEX "payments_project_id_idx" ON "payments"("project_id");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursements_code_key" ON "reimbursements"("code");

-- CreateIndex
CREATE INDEX "reimbursements_project_id_idx" ON "reimbursements"("project_id");

-- CreateIndex
CREATE INDEX "reimbursements_applicant_id_idx" ON "reimbursements"("applicant_id");

-- CreateIndex
CREATE INDEX "reimbursements_status_idx" ON "reimbursements"("status");

-- CreateIndex
CREATE INDEX "budgets_project_id_idx" ON "budgets"("project_id");

-- CreateIndex
CREATE INDEX "budgets_status_idx" ON "budgets"("status");

-- CreateIndex
CREATE INDEX "budget_revisions_budget_id_idx" ON "budget_revisions"("budget_id");

-- CreateIndex
CREATE INDEX "costs_project_id_idx" ON "costs"("project_id");

-- CreateIndex
CREATE INDEX "costs_source_idx" ON "costs"("source");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "invoices_type_idx" ON "invoices"("type");

-- CreateIndex
CREATE INDEX "invoices_project_id_idx" ON "invoices"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "cash_accounts_code_key" ON "cash_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_code_key" ON "bank_accounts"("code");

-- CreateIndex
CREATE INDEX "account_transactions_account_type_account_id_idx" ON "account_transactions"("account_type", "account_id");

-- CreateIndex
CREATE INDEX "account_transactions_occurred_at_idx" ON "account_transactions"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_currency_quote_currency_rate_date_key" ON "exchange_rates"("base_currency", "quote_currency", "rate_date");

-- CreateIndex
CREATE INDEX "exchange_rates_rate_date_idx" ON "exchange_rates"("rate_date");

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_revisions" ADD CONSTRAINT "budget_revisions_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "costs" ADD CONSTRAINT "costs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
