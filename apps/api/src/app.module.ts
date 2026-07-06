import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ProjectModule } from './modules/project/project.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { MaterialModule } from './modules/material/material.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditLogModule,
    AuthModule,
    SettingsModule,
    ProjectModule,
    WorkflowModule,
    MaterialModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
