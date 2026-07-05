import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuthRepository } from './auth.repository';
import { AuthUser, JwtPayload } from './auth.types';
import { CreateUserDto, LoginDto, UpdateUserDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly loginAttempts = new Map<
    string,
    { count: number; lockedUntil?: number }
  >();

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private mapUser(user: NonNullable<Awaited<ReturnType<AuthRepository['findUserById']>>>): AuthUser {
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => rp.permission.code),
        ),
      ),
    ];

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      locale: user.locale,
      roles,
      permissions,
    };
  }

  private checkLoginLock(username: string) {
    const record = this.loginAttempts.get(username);
    if (record?.lockedUntil && record.lockedUntil > Date.now()) {
      throw new UnauthorizedException('账户已锁定，请稍后再试');
    }
  }

  private recordLoginFailure(username: string) {
    const record = this.loginAttempts.get(username) ?? { count: 0 };
    record.count += 1;
    if (record.count >= 5) {
      record.lockedUntil = Date.now() + 15 * 60 * 1000;
      record.count = 0;
    }
    this.loginAttempts.set(username, record);
  }

  private clearLoginAttempts(username: string) {
    this.loginAttempts.delete(username);
  }

  async login(dto: LoginDto, ip?: string) {
    this.checkLoginLock(dto.username);

    const user = await this.authRepository.findUserByUsername(dto.username);
    if (!user) {
      this.recordLoginFailure(dto.username);
      throw new UnauthorizedException('用户名或密码错误');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      this.recordLoginFailure(dto.username);
      await this.auditLogService.create({
        userId: user.id,
        action: 'login',
        module: 'auth',
        resource: 'session',
        ip,
        payload: { success: false },
      });
      throw new UnauthorizedException('用户名或密码错误');
    }

    this.clearLoginAttempts(dto.username);
    const authUser = this.mapUser(user);
    const tokens = await this.issueTokens(authUser);

    await this.auditLogService.create({
      userId: user.id,
      action: 'login',
      module: 'auth',
      resource: 'session',
      ip,
      payload: { success: true },
    });

    return { user: authUser, ...tokens };
  }

  async issueTokens(user: AuthUser) {
    const payload: JwtPayload = { sub: user.id, username: user.username };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '2h'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        refreshToken,
        { secret: this.configService.get<string>('JWT_REFRESH_SECRET') },
      );
      const user = await this.getMe(payload.sub);
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh Token 无效或已过期');
    }
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在或已停用');
    }
    return this.mapUser(user);
  }

  async listUsers(page = 1, pageSize = 20, q?: string) {
    const skip = (page - 1) * pageSize;
    const [list, total] = await this.authRepository.findUsers({
      skip,
      take: pageSize,
      q,
    });
    return { list, page, pageSize, total };
  }

  async createUser(dto: CreateUserDto, operatorId: string) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.authRepository.createUser({
      username: dto.username,
      passwordHash,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
    });

    await this.auditLogService.create({
      userId: operatorId,
      action: 'create',
      module: 'auth',
      resource: 'user',
      resourceId: user.id,
      payload: { after: user },
    });

    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto, operatorId: string) {
    const user = await this.authRepository.updateUser(id, dto);

    await this.auditLogService.create({
      userId: operatorId,
      action: 'update',
      module: 'auth',
      resource: 'user',
      resourceId: id,
      payload: { after: user },
    });

    return user;
  }

  async deactivateUser(id: string, operatorId: string) {
    await this.authRepository.deactivateUser(id);

    await this.auditLogService.create({
      userId: operatorId,
      action: 'delete',
      module: 'auth',
      resource: 'user',
      resourceId: id,
    });

    return null;
  }

  async assignRoles(userId: string, roleIds: string[], operatorId: string) {
    await this.authRepository.replaceUserRoles(userId, roleIds);

    await this.auditLogService.create({
      userId: operatorId,
      action: 'update',
      module: 'auth',
      resource: 'user_roles',
      resourceId: userId,
      payload: { roleIds },
    });

    return this.getMe(userId);
  }

  async listRoles() {
    return this.authRepository.findRoles();
  }

  async logout(userId: string, ip?: string) {
    await this.auditLogService.create({
      userId,
      action: 'logout',
      module: 'auth',
      resource: 'session',
      ip,
    });
    return null;
  }
}
