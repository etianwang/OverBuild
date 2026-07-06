import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { MaterialController } from './material.controller';
import { MaterialRepository } from './material.repository';
import { MaterialService } from './material.service';

@Module({
  imports: [AuditLogModule],
  controllers: [MaterialController],
  providers: [MaterialService, MaterialRepository],
  exports: [MaterialService],
})
export class MaterialModule {}
