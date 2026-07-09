import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DeepLClient } from './deepl.client';
import { TranslationController } from './translation.controller';
import { TranslationRepository } from './translation.repository';
import { TranslationService } from './translation.service';

@Module({
  imports: [AuditLogModule],
  controllers: [TranslationController],
  providers: [TranslationRepository, TranslationService, DeepLClient],
  exports: [TranslationService],
})
export class TranslationModule {}
