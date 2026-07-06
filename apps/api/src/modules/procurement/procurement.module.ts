import { Module, forwardRef } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ProcurementController } from './procurement.controller';
import { ProcurementRepository } from './procurement.repository';
import { ProcurementService } from './procurement.service';

@Module({
  imports: [AuditLogModule, forwardRef(() => WorkflowModule)],
  controllers: [ProcurementController],
  providers: [ProcurementService, ProcurementRepository],
  exports: [ProcurementService],
})
export class ProcurementModule {}
