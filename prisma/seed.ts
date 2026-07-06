import { PrismaClient, Locale, UserStatus, ProjectStatus, MaterialDiscipline } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { fixTextContent } from './lib/fix-text-content';

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
  { code: 'project.read', name: '查看项目', module: 'project' },
  { code: 'project.create', name: '创建项目', module: 'project' },
  { code: 'project.update', name: '编辑项目', module: 'project' },
  { code: 'project.delete', name: '删除项目', module: 'project' },
  { code: 'project.export', name: '导出项目', module: 'project' },
  { code: 'project.zone.manage', name: '施工区域管理', module: 'project' },
  { code: 'project.member.manage', name: '项目成员管理', module: 'project' },
  { code: 'project.milestone.manage', name: '里程碑管理', module: 'project' },
  { code: 'project.task.manage', name: '施工内容管理', module: 'project' },
  { code: 'workflow.approve', name: '审批处理', module: 'workflow' },
  { code: 'workflow.template.manage', name: '审批模板管理', module: 'workflow' },
  { code: 'material.read', name: '查看材料', module: 'material' },
  { code: 'material.create', name: '新增材料', module: 'material' },
  { code: 'material.update', name: '编辑材料', module: 'material' },
  { code: 'material.delete', name: '删除材料', module: 'material' },
  { code: 'material.import', name: '导入材料', module: 'material' },
  { code: 'material.export', name: '导出材料', module: 'material' },
  { code: 'material.category.manage', name: '材料分类管理', module: 'material' },
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

  const bossRole = await prisma.role.findUniqueOrThrow({ where: { code: 'boss' } });
  const pmRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'project_manager' },
  });
  const financeRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'finance' },
  });
  const procurementRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'procurement' },
  });
  const warehouseRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'warehouse' },
  });

  const workflowApprove = await prisma.permission.findUniqueOrThrow({
    where: { code: 'workflow.approve' },
  });

  const projectRead = await prisma.permission.findUniqueOrThrow({
    where: { code: 'project.read' },
  });
  const projectExport = await prisma.permission.findUniqueOrThrow({
    where: { code: 'project.export' },
  });
  const pmPermissions = await prisma.permission.findMany({
    where: { module: 'project' },
  });

  for (const permission of [projectRead, projectExport]) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: bossRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: bossRole.id, permissionId: permission.id },
    });
  }

  for (const permission of pmPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: pmRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: { roleId: pmRole.id, permissionId: permission.id },
    });
  }

  for (const role of [bossRole, pmRole, financeRole]) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: workflowApprove.id,
        },
      },
      update: {},
      create: { roleId: role.id, permissionId: workflowApprove.id },
    });
  }

  const materialPerms = await prisma.permission.findMany({
    where: { module: 'material' },
  });
  const materialReadExport = materialPerms.filter((p) =>
    ['material.read', 'material.export'].includes(p.code),
  );
  const materialWrite = materialPerms.filter((p) =>
    ['material.read', 'material.create', 'material.update', 'material.import', 'material.export'].includes(
      p.code,
    ),
  );

  async function grantPerms(roleId: string, permissions: typeof materialPerms) {
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId: permission.id },
        },
        update: {},
        create: { roleId, permissionId: permission.id },
      });
    }
  }

  await grantPerms(procurementRole.id, materialWrite);
  await grantPerms(warehouseRole.id, materialPerms);
  for (const role of [bossRole, pmRole]) {
    await grantPerms(role.id, materialReadExport);
  }

  const passwordHashDemo = await bcrypt.hash('demo123', 10);
  const demoUsers = [
    { username: 'pm', name: '项目经理张三', role: pmRole },
    { username: 'finance', name: '财务李四', role: financeRole },
    { username: 'boss', name: '老板王五', role: bossRole },
    { username: 'procurement', name: '采购赵六', role: procurementRole },
    { username: 'warehouse', name: '仓管钱七', role: warehouseRole },
  ];

  for (const demo of demoUsers) {
    const user = await prisma.user.upsert({
      where: { username: demo.username },
      update: {},
      create: {
        username: demo.username,
        passwordHash: passwordHashDemo,
        name: demo.name,
        locale: Locale.zh,
        status: UserStatus.active,
      },
    });
    const existing = await prisma.userRole.findFirst({
      where: { userId: user.id, roleId: demo.role.id, projectId: null },
    });
    if (!existing) {
      await prisma.userRole.create({
        data: { userId: user.id, roleId: demo.role.id },
      });
    }
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

  for (const item of [
    { key: 'app.default_locale', value: 'zh', description: '默认语言' },
    { key: 'app.base_currency', value: 'CNY', description: '本位币' },
    { key: 'file.max_size_mb', value: 100, description: '上传限制 MB' },
    { key: 'exchange.auto_update', value: true, description: '汇率自动更新' },
  ]) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: {},
      create: item,
    });
  }

  const pmUser = await prisma.user.findUniqueOrThrow({ where: { username: 'pm' } });

  await prisma.project.upsert({
    where: { code: 'PRJ-DEMO-001' },
    update: {
      name: '杜阿拉综合楼',
      nameFr: 'Immeuble Douala',
      location: 'Douala, Cameroun',
      description: '示例项目：中法双语名称，用于验证 UTF-8 显示。',
      status: ProjectStatus.active,
      managerId: pmUser.id,
    },
    create: {
      code: 'PRJ-DEMO-001',
      name: '杜阿拉综合楼',
      nameFr: 'Immeuble Douala',
      location: 'Douala, Cameroun',
      description: '示例项目：中法双语名称，用于验证 UTF-8 显示。',
      status: ProjectStatus.active,
      managerId: pmUser.id,
    },
  });

  const approvalTemplates = [
    {
      type: 'purchase_request' as const,
      name: '采购申请审批',
      nodes: [{ node: 1, role: 'project_manager' }],
    },
    {
      type: 'payment' as const,
      name: '付款审批',
      nodes: [
        { node: 1, role: 'finance' },
        { node: 2, role: 'boss', condition: 'amount_over_limit' },
      ],
    },
    {
      type: 'reimbursement' as const,
      name: '报销审批',
      nodes: [
        { node: 1, role: 'project_manager' },
        { node: 2, role: 'finance' },
      ],
    },
    {
      type: 'contract' as const,
      name: '合同签订审批',
      nodes: [
        { node: 1, role: 'project_manager' },
        { node: 2, role: 'finance' },
        { node: 3, role: 'boss' },
      ],
    },
    {
      type: 'drawing' as const,
      name: '图纸发布审批',
      nodes: [
        { node: 1, role: 'engineer' },
        { node: 2, role: 'project_manager' },
      ],
    },
  ];

  for (const tpl of approvalTemplates) {
    const existing = await prisma.approvalTemplate.findFirst({
      where: { type: tpl.type, isActive: true },
    });
    if (!existing) {
      await prisma.approvalTemplate.create({
        data: {
          type: tpl.type,
          name: tpl.name,
          nodes: tpl.nodes,
          isActive: true,
        },
      });
    }
  }

  const pipeCategory = await prisma.materialCategory.upsert({
    where: { code: 'PIPE' },
    update: { name: '机电管材', discipline: MaterialDiscipline.mep },
    create: {
      code: 'PIPE',
      name: '机电管材',
      discipline: MaterialDiscipline.mep,
      description: '镀锌管、电缆、暖通管材等（机电团队）',
    },
  });

  const steelCategory = await prisma.materialCategory.upsert({
    where: { code: 'STEEL' },
    update: { name: '土建钢材', discipline: MaterialDiscipline.civil },
    create: {
      code: 'STEEL',
      name: '土建钢材',
      discipline: MaterialDiscipline.civil,
      description: '型钢、钢板、混凝土辅材等（土建团队）',
    },
  });

  const finishingCategory = await prisma.materialCategory.upsert({
    where: { code: 'FINISH' },
    update: { name: '精装饰面', discipline: MaterialDiscipline.finishing },
    create: {
      code: 'FINISH',
      name: '精装饰面',
      discipline: MaterialDiscipline.finishing,
      description: '涂料、瓷砖、洁具、门窗五金等（精装团队）',
    },
  });

  const demoProject = await prisma.project.findUniqueOrThrow({
    where: { code: 'PRJ-DEMO-001' },
  });

  const demoMaterials = [
    {
      code: 'MAT-DEMO-001',
      name: '镀锌钢管',
      spec: 'DN50',
      brand: '某某钢铁',
      unit: '米',
      categoryId: pipeCategory.id,
      storageLocation: '杜阿拉仓-B区-2号架',
      minStock: 100,
      amount: 45.5,
      stock: 80,
    },
    {
      code: 'MAT-DEMO-002',
      name: 'H型钢',
      spec: '200×200',
      unit: '吨',
      categoryId: steelCategory.id,
      storageLocation: '杜阿拉仓-A区-1号架',
      minStock: 5,
      amount: 5200,
      stock: 12,
    },
    {
      code: 'MAT-DEMO-003',
      name: '抛光瓷砖',
      spec: '600×600',
      unit: '箱',
      categoryId: finishingCategory.id,
      storageLocation: '杜阿拉仓-C区-5号架',
      minStock: 20,
      amount: 180,
      stock: 15,
    },
  ];

  for (const item of demoMaterials) {
    const material = await prisma.material.upsert({
      where: {
        projectId_code: {
          projectId: demoProject.id,
          code: item.code,
        },
      },
      update: {
        name: item.name,
        spec: item.spec,
        unit: item.unit,
        storageLocation: item.storageLocation,
        minStock: item.minStock,
        stock: item.stock,
        purchasePriceAmount: item.amount,
        purchasePriceCurrency: 'CNY',
      },
      create: {
        code: item.code,
        name: item.name,
        spec: item.spec,
        brand: item.brand,
        unit: item.unit,
        categoryId: item.categoryId,
        projectId: demoProject.id,
        storageLocation: item.storageLocation,
        minStock: item.minStock,
        stock: item.stock,
        purchasePriceAmount: item.amount,
        purchasePriceCurrency: 'CNY',
      },
    });

    const historyExists = await prisma.materialPriceHistory.findFirst({
      where: { materialId: material.id },
    });
    if (!historyExists) {
      await prisma.materialPriceHistory.create({
        data: {
          materialId: material.id,
          amount: item.amount,
          currency: 'CNY',
        },
      });
    }
  }

  const fixStats = await fixTextContent(prisma);
  const fixedCount = fixStats.reduce((sum, item) => sum + item.fixed, 0);
  if (fixedCount > 0) {
    console.log(`Repaired ${fixedCount} corrupted text field(s).`);
  }

  console.log(
    'Seed completed. Default admin: admin / admin123; demo users: pm/finance/boss / demo123',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
