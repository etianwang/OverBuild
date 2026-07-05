import { PrismaClient, Locale, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLES = [
  { code: 'admin', name: '管理员' },
  { code: 'boss', name: '老板' },
  { code: 'project_manager', name: '项目经理' },
  { code: 'procurement', name: '采购' },
  { code: 'warehouse', name: '仓库管理员' },
  { code: 'finance', name: '财务' },
  { code: 'engineer', name: '工程师' },
  { code: 'translator', name: '翻译' },
];

const PERMISSIONS = [
  { code: 'auth.user.read', name: '查看用户', module: 'auth' },
  { code: 'auth.user.create', name: '创建用户', module: 'auth' },
  { code: 'auth.user.update', name: '编辑用户', module: 'auth' },
  { code: 'auth.user.delete', name: '停用用户', module: 'auth' },
  { code: 'auth.role.manage', name: '角色管理', module: 'auth' },
  { code: 'audit.read', name: '查看日志', module: 'audit' },
  { code: 'settings.system', name: '系统设置', module: 'settings' },
];

async function main() {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    });
  }

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module },
      create: perm,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'admin' },
  });

  const allPermissions = await prisma.permission.findMany();
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      name: '系统管理员',
      email: 'admin@overbuild.local',
      locale: Locale.zh,
      status: UserStatus.active,
    },
  });

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: adminUser.id, roleId: adminRole.id, projectId: null },
  });

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: 'app.name' },
    update: {},
    create: {
      key: 'app.name',
      value: 'OverBuild',
      description: '系统名称',
    },
  });

  console.log('Seed completed. Default admin: admin / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
