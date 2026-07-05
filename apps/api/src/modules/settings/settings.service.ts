import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  ChangePasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateSystemSettingsDto,
} from './dto/settings.dto';
import { SettingsRepository } from './settings.repository';

@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getSystemSettings() {
    const items = await this.settingsRepository.findAllSystemSettings();
    return items.reduce<Record<string, unknown>>((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
  }

  async getSystemSetting(key: string) {
    const items = await this.settingsRepository.findAllSystemSettings();
    const item = items.find((i) => i.key === key);
    if (!item) {
      throw new NotFoundException('配置项不存在');
    }
    return item;
  }

  async updateSystemSettings(dto: UpdateSystemSettingsDto, operatorId: string) {
    for (const [key, value] of Object.entries(dto.settings)) {
      await this.settingsRepository.upsertSystemSetting(
        key,
        value as object,
        operatorId,
      );
    }

    await this.auditLogService.create({
      userId: operatorId,
      action: 'update',
      module: 'settings',
      resource: 'system_settings',
      payload: { keys: Object.keys(dto.settings) },
    });

    return this.getSystemSettings();
  }

  async getProfile(userId: string) {
    const profile = await this.settingsRepository.findUserProfile(userId);
    if (!profile) {
      throw new NotFoundException('用户不存在');
    }
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.settingsRepository.updateUserProfile(userId, dto);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.settingsRepository.findUserWithPassword(userId);
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const valid = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('原密码错误');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.settingsRepository.updatePassword(userId, passwordHash);

    await this.auditLogService.create({
      userId,
      action: 'update',
      module: 'settings',
      resource: 'password',
      resourceId: userId,
    });

    return null;
  }

  async getPreferences(userId: string) {
    const prefs = await this.settingsRepository.findPreferences(userId);
    return (
      prefs ?? {
        userId,
        locale: 'zh',
        theme: 'system',
        notificationPrefs: {},
      }
    );
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.settingsRepository.upsertPreferences(userId, dto);
  }
}
