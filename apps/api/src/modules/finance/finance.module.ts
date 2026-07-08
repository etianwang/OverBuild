import { Module, forwardRef } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { FinanceController } from './finance.controller';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';

@Module({
  imports: [AuditLogModule, forwardRef(() => WorkflowModule)],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceRepository],
  exports: [FinanceService],
})
export class FinanceModule {}
