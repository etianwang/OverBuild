import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByUsername(username: string) {
    return this.prisma.user.findFirst({
      where: { username, deletedAt: null, status: UserStatus.active },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null, status: UserStatus.active },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });
  }

  findUsers(params: {
    skip: number;
    take: number;
    q?: string;
  }) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.q
        ? {
            OR: [
              { username: { contains: params.q, mode: 'insensitive' } },
              { name: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          phone: true,
          locale: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        locale: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        phone: true,
        locale: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  deactivateUser(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.inactive },
    });
  }

  replaceUserRoles(userId: string, roleIds: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } });
      if (roleIds.length) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId, roleId })),
        });
      }
    });
  }

  findRoles() {
    return this.prisma.role.findMany({ orderBy: { code: 'asc' } });
  }
}
