import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DocumentCategoryController } from './document-category.controller';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

@Module({
  imports: [AuditLogModule],
  controllers: [DocumentController, DocumentCategoryController],
  providers: [DocumentService, DocumentRepository],
  exports: [DocumentService],
})
export class DocumentModule {}
