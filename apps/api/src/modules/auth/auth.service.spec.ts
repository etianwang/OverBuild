import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

vi.mock('bcrypt', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authRepository = {
    findUserByUsername: vi.fn(),
    findUserById: vi.fn(),
    findUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deactivateUser: vi.fn(),
    replaceUserRoles: vi.fn(),
    findRoles: vi.fn(),
  };

  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('token'),
    verifyAsync: vi.fn(),
  };

  const configService = {
    get: vi.fn((key: string) => {
      const map: Record<string, string> = {
        JWT_SECRET: 'secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
        JWT_EXPIRES_IN: '2h',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return map[key];
    }),
  };

  const auditLogService = {
    create: vi.fn().mockResolvedValue(undefined),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      authRepository as never,
      jwtService as never,
      configService as never,
      auditLogService as never,
    );
  });

  it('should reject invalid credentials', async () => {
    authRepository.findUserByUsername.mockResolvedValue(null);

    await expect(
      service.login({ username: 'admin', password: 'wrong1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should return tokens for valid login', async () => {
    authRepository.findUserByUsername.mockResolvedValue({
      id: '1',
      username: 'admin',
      passwordHash: 'hash',
      name: 'Admin',
      email: null,
      locale: 'zh',
      userRoles: [
        {
          role: {
            code: 'admin',
            rolePermissions: [
              { permission: { code: 'auth.user.read' } },
            ],
          },
        },
      ],
    });

    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const result = await service.login({
      username: 'admin',
      password: 'admin123',
    });

    expect(result.accessToken).toBe('token');
    expect(result.user.username).toBe('admin');
    expect(auditLogService.create).toHaveBeenCalled();
  });
});
