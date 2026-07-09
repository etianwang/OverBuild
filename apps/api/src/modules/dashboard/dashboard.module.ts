import { Module, forwardRef } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [NotificationModule, forwardRef(() => WorkflowModule)],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
