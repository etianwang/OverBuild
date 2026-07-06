-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "StockDocumentStatus" AS ENUM ('draft', 'confirmed');

-- CreateEnum
CREATE TYPE "InboundType" AS ENUM ('purchase', 'return', 'adjustment');

-- CreateEnum
CREATE TYPE "OutboundType" AS ENUM ('usage', 'transfer');

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "address" TEXT,
    "status" "WarehouseStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_inbound" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "type" "InboundType" NOT NULL,
    "status" "StockDocumentStatus" NOT NULL DEFAULT 'draft',
    "inbound_at" TIMESTAMP(3),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_inbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_outbound" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "zone_id" TEXT,
    "type" "OutboundType" NOT NULL,
    "status" "StockDocumentStatus" NOT NULL DEFAULT 'draft',
    "outbound_at" TIMESTAMP(3),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_outbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "inbound_id" TEXT,
    "outbound_id" TEXT,
    "material_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktakes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "StockDocumentStatus" NOT NULL DEFAULT 'draft',
    "remark" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocktakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocktake_items" (
    "id" TEXT NOT NULL,
    "stocktake_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "book_quantity" DECIMAL(18,4) NOT NULL,
    "counted_quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL,

    CONSTRAINT "stocktake_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "warehouses_project_id_idx" ON "warehouses"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_inbound_code_key" ON "stock_inbound"("code");

-- CreateIndex
CREATE INDEX "stock_inbound_warehouse_id_idx" ON "stock_inbound"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_inbound_project_id_idx" ON "stock_inbound"("project_id");

-- CreateIndex
CREATE INDEX "stock_inbound_status_idx" ON "stock_inbound"("status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_outbound_code_key" ON "stock_outbound"("code");

-- CreateIndex
CREATE INDEX "stock_outbound_warehouse_id_idx" ON "stock_outbound"("warehouse_id");

-- CreateIndex
CREATE INDEX "stock_outbound_project_id_idx" ON "stock_outbound"("project_id");

-- CreateIndex
CREATE INDEX "stock_outbound_status_idx" ON "stock_outbound"("status");

-- CreateIndex
CREATE INDEX "stock_items_inbound_id_idx" ON "stock_items"("inbound_id");

-- CreateIndex
CREATE INDEX "stock_items_outbound_id_idx" ON "stock_items"("outbound_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_warehouse_id_material_id_project_id_key" ON "stock_balances"("warehouse_id", "material_id", "project_id");

-- CreateIndex
CREATE INDEX "stock_balances_project_id_idx" ON "stock_balances"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "stocktakes_code_key" ON "stocktakes"("code");

-- CreateIndex
CREATE INDEX "stocktakes_warehouse_id_idx" ON "stocktakes"("warehouse_id");

-- CreateIndex
CREATE INDEX "stocktakes_project_id_idx" ON "stocktakes"("project_id");

-- CreateIndex
CREATE INDEX "stocktake_items_stocktake_id_idx" ON "stocktake_items"("stocktake_id");

-- CreateIndex
CREATE INDEX "stock_transactions_warehouse_id_idx" ON "stock_transactions"("warehouse_id");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inbound" ADD CONSTRAINT "stock_inbound_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inbound" ADD CONSTRAINT "stock_inbound_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_inbound" ADD CONSTRAINT "stock_inbound_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_outbound" ADD CONSTRAINT "stock_outbound_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_outbound" ADD CONSTRAINT "stock_outbound_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_outbound" ADD CONSTRAINT "stock_outbound_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "project_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_inbound_id_fkey" FOREIGN KEY ("inbound_id") REFERENCES "stock_inbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_outbound_id_fkey" FOREIGN KEY ("outbound_id") REFERENCES "stock_outbound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktakes" ADD CONSTRAINT "stocktakes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "stocktakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocktake_items" ADD CONSTRAINT "stocktake_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
