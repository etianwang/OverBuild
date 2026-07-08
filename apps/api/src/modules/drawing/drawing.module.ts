import { Module, forwardRef } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { DrawingController } from './drawing.controller';
import { DrawingRepository } from './drawing.repository';
import { DrawingService } from './drawing.service';

@Module({
  imports: [AuditLogModule, forwardRef(() => WorkflowModule)],
  controllers: [DrawingController],
  providers: [DrawingService, DrawingRepository],
  exports: [DrawingService],
})
export class DrawingModule {}
