import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const settingsRepository = {
    findAllSystemSettings: vi.fn(),
    upsertSystemSetting: vi.fn(),
    findUserWithPassword: vi.fn(),
    updatePassword: vi.fn(),
    findUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
    findPreferences: vi.fn(),
    upsertPreferences: vi.fn(),
  };

  const auditLogService = {
    create: vi.fn(),
  };

  let service: SettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SettingsService(
      settingsRepository as never,
      auditLogService as never,
    );
  });

  it('rejects wrong old password', async () => {
    settingsRepository.findUserWithPassword.mockResolvedValue({
      id: '1',
      passwordHash: 'hash',
    });

    vi.mock('bcrypt', () => ({
      compare: vi.fn().mockResolvedValue(false),
    }));

    const bcrypt = await import('bcrypt');
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

    await expect(
      service.changePassword('1', {
        oldPassword: 'wrong',
        newPassword: 'newpass1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
