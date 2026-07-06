import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkflowController } from './workflow.controller';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [AuditLogModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowRepository],
  exports: [WorkflowService],
})
export class WorkflowModule {}
