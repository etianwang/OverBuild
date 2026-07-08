import { Module, forwardRef } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ContractController } from './contract.controller';
import { ContractRepository } from './contract.repository';
import { ContractService } from './contract.service';

@Module({
  imports: [AuditLogModule, forwardRef(() => WorkflowModule)],
  controllers: [ContractController],
  providers: [ContractService, ContractRepository],
  exports: [ContractService],
})
export class ContractModule {}
