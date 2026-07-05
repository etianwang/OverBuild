import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthUser } from '../auth/auth.types';
import {
  ChangePasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
  UpdateSystemSettingsDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('system')
  @Permissions('settings.system')
  @ApiOperation({ summary: '获取系统配置' })
  getSystem() {
    return this.settingsService.getSystemSettings();
  }

  @Put('system')
  @Permissions('settings.system')
  @ApiOperation({ summary: '更新系统配置' })
  updateSystem(
    @Body() dto: UpdateSystemSettingsDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.settingsService.updateSystemSettings(dto, req.user.id);
  }

  @Get('system/:key')
  @Permissions('settings.system')
  @ApiOperation({ summary: '获取单项配置' })
  getSystemItem(@Param('key') key: string) {
    return this.settingsService.getSystemSetting(key);
  }

  @Get('profile')
  @ApiOperation({ summary: '个人信息' })
  getProfile(@Req() req: Request & { user: AuthUser }) {
    return this.settingsService.getProfile(req.user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: '更新个人信息' })
  updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.settingsService.updateProfile(req.user.id, dto);
  }

  @Put('password')
  @ApiOperation({ summary: '修改密码' })
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.settingsService.changePassword(req.user.id, dto);
  }

  @Get('preferences')
  @ApiOperation({ summary: '用户偏好' })
  getPreferences(@Req() req: Request & { user: AuthUser }) {
    return this.settingsService.getPreferences(req.user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: '更新偏好' })
  updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.settingsService.updatePreferences(req.user.id, dto);
  }
}
