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
import { NotificationType } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../auth/auth.types';
import { BroadcastNotificationDto } from './dto/notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('unread-count')
  @ApiOperation({ summary: '未读通知数量' })
  unreadCount(@Req() req: Request & { user: AuthUser }) {
    return this.notificationService.unreadCount(req.user);
  }

  @Put('read-all')
  @ApiOperation({ summary: '全部标记已读' })
  markAllRead(@Req() req: Request & { user: AuthUser }) {
    return this.notificationService.markAllRead(req.user);
  }

  @Get()
  @ApiOperation({ summary: '通知列表' })
  list(
    @Req() req: Request & { user: AuthUser },
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
    @Query('type') type?: NotificationType,
    @Query('isRead') isRead?: string,
  ) {
    const readFilter =
      isRead === 'true' ? true : isRead === 'false' ? false : undefined;
    return this.notificationService.list(
      req.user,
      +page,
      +pageSize,
      type,
      readFilter,
    );
  }

  @Post('broadcast')
  @ApiOperation({ summary: '管理员发送系统公告' })
  broadcast(
    @Req() req: Request & { user: AuthUser },
    @Body() dto: BroadcastNotificationDto,
  ) {
    return this.notificationService.broadcast(req.user, dto);
  }

  @Put(':id/read')
  @ApiOperation({ summary: '标记已读' })
  markRead(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.notificationService.markRead(req.user, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除通知' })
  remove(@Req() req: Request & { user: AuthUser }, @Param('id') id: string) {
    return this.notificationService.remove(req.user, id);
  }
}
