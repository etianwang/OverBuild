import { Module, forwardRef } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { ContractModule } from '../contract/contract.module';
import { FinanceModule } from '../finance/finance.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [AuditLogModule, forwardRef(() => ProcurementModule), forwardRef(() => ContractModule), forwardRef(() => FinanceModule)],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowRepository],
  exports: [WorkflowService],
})
export class WorkflowModule {}
