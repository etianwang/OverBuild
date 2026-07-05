import { Injectable } from '@nestjs/common';
import { Locale, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllSystemSettings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  upsertSystemSetting(
    key: string,
    value: Prisma.InputJsonValue,
    updatedBy: string,
    description?: string,
  ) {
    return this.prisma.systemSetting.upsert({
      where: { key },
      update: { value, updatedBy, description },
      create: { key, value, updatedBy, description },
    });
  }

  findUserProfile(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        locale: true,
        status: true,
      },
    });
  }

  updateUserProfile(userId: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        locale: true,
        status: true,
      },
    });
  }

  findUserWithPassword(userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
  }

  updatePassword(userId: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  findPreferences(userId: string) {
    return this.prisma.userPreference.findUnique({ where: { userId } });
  }

  upsertPreferences(
    userId: string,
    data: {
      locale?: Locale;
      theme?: string;
      notificationPrefs?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        locale: data.locale ?? Locale.zh,
        theme: data.theme ?? 'system',
        notificationPrefs: data.notificationPrefs,
      },
    });
  }
}
