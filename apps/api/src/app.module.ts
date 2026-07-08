import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ProjectModule } from './modules/project/project.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { MaterialModule } from './modules/material/material.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { ContractModule } from './modules/contract/contract.module';
import { FinanceModule } from './modules/finance/finance.module';
import { DocumentModule } from './modules/document/document.module';
import { DrawingModule } from './modules/drawing/drawing.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    SettingsModule,
    ProjectModule,
    WorkflowModule,
    MaterialModule,
    ProcurementModule,
    WarehouseModule,
    ContractModule,
    FinanceModule,
    DocumentModule,
    DrawingModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
