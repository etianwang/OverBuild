import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Permissions } from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.types';
import {
  AssignRolesDto,
  CreateUserDto,
  LoginDto,
  RefreshTokenDto,
  UpdateUserDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('auth/login')
  @ApiOperation({ summary: '登录' })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, req.ip);
  }

  @Public()
  @Post('auth/refresh')
  @ApiOperation({ summary: '刷新 Token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('auth/logout')
  @ApiOperation({ summary: '登出' })
  logout(@Req() req: Request & { user: AuthUser }) {
    return this.authService.logout(req.user.id, req.ip);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('auth/me')
  @ApiOperation({ summary: '当前用户' })
  me(@Req() req: Request & { user: AuthUser }) {
    return req.user;
  }
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @Permissions('auth.user.read')
  @ApiOperation({ summary: '用户列表' })
  list(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('q') q?: string,
  ) {
    return this.authService.listUsers(+page, +pageSize, q);
  }

  @Post()
  @Permissions('auth.user.create')
  @ApiOperation({ summary: '创建用户' })
  create(
    @Body() dto: CreateUserDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.authService.createUser(dto, req.user.id);
  }

  @Put(':id')
  @Permissions('auth.user.update')
  @ApiOperation({ summary: '编辑用户' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.authService.updateUser(id, dto, req.user.id);
  }

  @Delete(':id')
  @Permissions('auth.user.delete')
  @ApiOperation({ summary: '停用用户' })
  remove(
    @Param('id') id: string,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.authService.deactivateUser(id, req.user.id);
  }

  @Put(':id/roles')
  @Permissions('auth.user.update')
  @ApiOperation({ summary: '分配角色' })
  assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.authService.assignRoles(id, dto.roleIds, req.user.id);
  }
}

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @Permissions('auth.role.manage')
  @ApiOperation({ summary: '角色列表' })
  list() {
    return this.authService.listRoles();
  }
}
