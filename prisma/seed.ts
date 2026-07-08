import { PrismaClient, Locale, UserStatus, ProjectStatus, MaterialDiscipline } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
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
  { code: 'procurement.request.read', name: '查看采购申请', module: 'procurement' },
  { code: 'procurement.request.create', name: '创建采购申请', module: 'procurement' },
  { code: 'procurement.request.update', name: '编辑采购申请', module: 'procurement' },
  { code: 'procurement.request.submit', name: '提交采购申请', module: 'procurement' },
  { code: 'procurement.request.export', name: '导出采购申请', module: 'procurement' },
  { code: 'procurement.order.read', name: '查看采购订单', module: 'procurement' },
  { code: 'procurement.order.create', name: '创建采购订单', module: 'procurement' },
  { code: 'procurement.order.update', name: '编辑采购订单', module: 'procurement' },
  { code: 'procurement.order.confirm', name: '确认采购订单', module: 'procurement' },
  { code: 'procurement.order.receive', name: '采购到货确认', module: 'procurement' },
  { code: 'procurement.order.export', name: '导出采购订单', module: 'procurement' },
  { code: 'procurement.supplier.read', name: '查看供应商', module: 'procurement' },
  { code: 'procurement.supplier.create', name: '新增供应商', module: 'procurement' },
  { code: 'procurement.supplier.update', name: '编辑供应商', module: 'procurement' },
  { code: 'procurement.supplier.delete', name: '删除供应商', module: 'procurement' },
  { code: 'procurement.supplier.export', name: '导出供应商', module: 'procurement' },
  { code: 'procurement.quotation.read', name: '查看询价', module: 'procurement' },
  { code: 'procurement.quotation.create', name: '创建询价', module: 'procurement' },
  { code: 'procurement.quotation.update', name: '更新询价', module: 'procurement' },
  { code: 'warehouse.read', name: '查看仓库', module: 'warehouse' },
  { code: 'warehouse.create', name: '新增仓库', module: 'warehouse' },
  { code: 'warehouse.update', name: '编辑仓库', module: 'warehouse' },
  { code: 'warehouse.delete', name: '停用仓库', module: 'warehouse' },
  { code: 'warehouse.inbound.read', name: '查看入库单', module: 'warehouse' },
  { code: 'warehouse.inbound.create', name: '创建入库单', module: 'warehouse' },
  { code: 'warehouse.inbound.update', name: '编辑入库单', module: 'warehouse' },
  { code: 'warehouse.inbound.confirm', name: '确认入库', module: 'warehouse' },
  { code: 'warehouse.inbound.export', name: '导出入库单', module: 'warehouse' },
  { code: 'warehouse.outbound.read', name: '查看出库单', module: 'warehouse' },
  { code: 'warehouse.outbound.create', name: '创建出库单', module: 'warehouse' },
  { code: 'warehouse.outbound.update', name: '编辑出库单', module: 'warehouse' },
  { code: 'warehouse.outbound.confirm', name: '确认出库', module: 'warehouse' },
  { code: 'warehouse.outbound.export', name: '导出出库单', module: 'warehouse' },
  { code: 'warehouse.stocktake.read', name: '查看盘点单', module: 'warehouse' },
  { code: 'warehouse.stocktake.create', name: '创建盘点', module: 'warehouse' },
  { code: 'warehouse.stocktake.confirm', name: '确认盘点', module: 'warehouse' },
  { code: 'warehouse.balance.read', name: '查看库存余额', module: 'warehouse' },
  { code: 'warehouse.balance.export', name: '导出库存报表', module: 'warehouse' },
  { code: 'warehouse.transaction.read', name: '查看库存流水', module: 'warehouse' },
  { code: 'contract.read', name: '查看合同', module: 'contract' },
  { code: 'contract.create', name: '创建合同', module: 'contract' },
  { code: 'contract.update', name: '编辑合同', module: 'contract' },
  { code: 'contract.delete', name: '删除合同', module: 'contract' },
  { code: 'contract.submit', name: '提交合同审批', module: 'contract' },
  { code: 'contract.revision.read', name: '查看合同变更', module: 'contract' },
  { code: 'contract.revision.create', name: '记录合同变更', module: 'contract' },
  { code: 'contract.collection.read', name: '查看合同回款', module: 'contract' },
  { code: 'contract.export', name: '导出合同', module: 'contract' },
  { code: 'finance.income.read', name: '查看收入', module: 'finance' },
  { code: 'finance.income.create', name: '登记收入', module: 'finance' },
  { code: 'finance.income.export', name: '导出收入', module: 'finance' },
  { code: 'finance.payment.read', name: '查看付款', module: 'finance' },
  { code: 'finance.payment.create', name: '创建付款', module: 'finance' },
  { code: 'finance.payment.update', name: '编辑付款', module: 'finance' },
  { code: 'finance.payment.submit', name: '提交付款审批', module: 'finance' },
  { code: 'finance.payment.execute', name: '执行付款', module: 'finance' },
  { code: 'finance.payment.export', name: '导出付款', module: 'finance' },
  { code: 'finance.collection.read', name: '查看回款', module: 'finance' },
  { code: 'finance.collection.create', name: '登记回款', module: 'finance' },
  { code: 'finance.collection.export', name: '导出回款', module: 'finance' },
  { code: 'finance.reimbursement.read', name: '查看报销', module: 'finance' },
  { code: 'finance.reimbursement.create', name: '创建报销', module: 'finance' },
  { code: 'finance.reimbursement.update', name: '编辑报销', module: 'finance' },
  { code: 'finance.reimbursement.submit', name: '提交报销', module: 'finance' },
  { code: 'finance.reimbursement.export', name: '导出报销', module: 'finance' },
  { code: 'finance.budget.read', name: '查看预算', module: 'finance' },
  { code: 'finance.budget.create', name: '编制预算', module: 'finance' },
  { code: 'finance.budget.update', name: '调整预算', module: 'finance' },
  { code: 'finance.budget.deactivate', name: '停用预算', module: 'finance' },
  { code: 'finance.cost.read', name: '查看成本', module: 'finance' },
  { code: 'finance.cost.create', name: '补录成本', module: 'finance' },
  { code: 'finance.invoice.read', name: '查看发票', module: 'finance' },
  { code: 'finance.invoice.create', name: '登记发票', module: 'finance' },
  { code: 'finance.invoice.update', name: '编辑发票', module: 'finance' },
  { code: 'finance.invoice.export', name: '导出发票', module: 'finance' },
  { code: 'finance.account.read', name: '查看账户', module: 'finance' },
  { code: 'finance.report.read', name: '查看报表', module: 'finance' },
  { code: 'finance.report.export', name: '导出报表', module: 'finance' },
  { code: 'finance.profit.read', name: '查看项目利润', module: 'finance' },
  { code: 'finance.currency.read', name: '查看币种', module: 'finance' },
  { code: 'finance.exchange_rate.read', name: '查看汇率', module: 'finance' },
  { code: 'finance.exchange_rate.create', name: '录入汇率', module: 'finance' },
  { code: 'document.read', name: '查看文档', module: 'document' },
  { code: 'document.create', name: '上传文档', module: 'document' },
  { code: 'document.update', name: '编辑文档', module: 'document' },
  { code: 'document.delete', name: '删除文档', module: 'document' },
  { code: 'document.version.read', name: '查看文档版本', module: 'document' },
  { code: 'document.version.create', name: '上传新版本', module: 'document' },
  { code: 'document.preview', name: '预览文档', module: 'document' },
  { code: 'document.download', name: '下载文档', module: 'document' },
  { code: 'document.translate', name: '提交文档翻译', module: 'document' },
  { code: 'document.export', name: '导出文档', module: 'document' },
  { code: 'document.category.read', name: '查看文档分类', module: 'document' },
  { code: 'document.category.create', name: '新增文档分类', module: 'document' },
  { code: 'document.category.update', name: '编辑文档分类', module: 'document' },
  { code: 'drawing.read', name: '查看图纸', module: 'drawing' },
  { code: 'drawing.create', name: '上传图纸', module: 'drawing' },
  { code: 'drawing.update', name: '编辑图纸', module: 'drawing' },
  { code: 'drawing.delete', name: '删除图纸', module: 'drawing' },
  { code: 'drawing.version.read', name: '查看图纸版本', module: 'drawing' },
  { code: 'drawing.version.create', name: '上传新版本', module: 'drawing' },
  { code: 'drawing.preview', name: '预览图纸', module: 'drawing' },
  { code: 'drawing.download', name: '下载图纸', module: 'drawing' },
  { code: 'drawing.submit_review', name: '提交图纸审阅', module: 'drawing' },
  { code: 'drawing.review', name: '审阅图纸', module: 'drawing' },
  { code: 'drawing.publish', name: '发布图纸', module: 'drawing' },
  { code: 'drawing.export', name: '导出图纸', module: 'drawing' },
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

  const procurementPerms = await prisma.permission.findMany({
    where: { module: 'procurement' },
  });
  const procurementFull = procurementPerms;
  const procurementReadExport = procurementPerms.filter((p) =>
    p.code.endsWith('.read') || p.code.endsWith('.export'),
  );
  const pmProcurement = procurementPerms.filter((p) =>
    [
      'procurement.request.read',
      'procurement.request.create',
      'procurement.request.export',
      'procurement.order.read',
      'procurement.order.export',
      'procurement.supplier.read',
      'procurement.quotation.read',
    ].includes(p.code),
  );

  await grantPerms(procurementRole.id, procurementFull);
  await grantPerms(pmRole.id, pmProcurement);
  await grantPerms(bossRole.id, procurementReadExport);
  await grantPerms(financeRole.id, procurementReadExport);

  const warehousePerms = await prisma.permission.findMany({
    where: { module: 'warehouse' },
  });
  const warehouseReadExport = warehousePerms.filter(
    (p) => p.code.endsWith('.read') || p.code.endsWith('.export'),
  );
  const procurementWarehouse = warehousePerms.filter((p) =>
    [
      'warehouse.read',
      'warehouse.inbound.read',
      'warehouse.inbound.export',
      'warehouse.balance.read',
      'warehouse.balance.export',
      'warehouse.transaction.read',
    ].includes(p.code),
  );
  const pmWarehouse = warehousePerms.filter((p) =>
    [
      'warehouse.read',
      'warehouse.inbound.read',
      'warehouse.outbound.read',
      'warehouse.stocktake.read',
      'warehouse.balance.read',
      'warehouse.balance.export',
      'warehouse.transaction.read',
      'warehouse.inbound.export',
      'warehouse.outbound.export',
    ].includes(p.code),
  );

  await grantPerms(warehouseRole.id, warehousePerms);
  await grantPerms(procurementRole.id, procurementWarehouse);
  await grantPerms(pmRole.id, pmWarehouse);
  await grantPerms(bossRole.id, warehouseReadExport);

  const contractPerms = await prisma.permission.findMany({
    where: { module: 'contract' },
  });
  const contractReadExport = contractPerms.filter(
    (p) => p.code.endsWith('.read') || p.code.endsWith('.export'),
  );
  const pmContract = contractPerms.filter((p) =>
    [
      'contract.read',
      'contract.create',
      'contract.submit',
      'contract.export',
      'contract.revision.read',
      'contract.collection.read',
    ].includes(p.code),
  );

  await grantPerms(financeRole.id, contractPerms);
  await grantPerms(pmRole.id, pmContract);
  await grantPerms(bossRole.id, contractReadExport);

  const financePerms = await prisma.permission.findMany({
    where: { module: 'finance' },
  });
  const financeReadExport = financePerms.filter(
    (p) => p.code.endsWith('.read') || p.code.endsWith('.export'),
  );
  const pmFinance = financePerms.filter((p) =>
    [
      'finance.reimbursement.read',
      'finance.reimbursement.create',
      'finance.reimbursement.submit',
      'finance.reimbursement.export',
      'finance.budget.read',
      'finance.cost.read',
      'finance.report.read',
      'finance.profit.read',
    ].includes(p.code),
  );

  await grantPerms(financeRole.id, financePerms);
  await grantPerms(pmRole.id, pmFinance);
  await grantPerms(bossRole.id, financeReadExport);

  const engineerRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'engineer' },
  });
  const translatorRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'translator' },
  });

  const documentPerms = await prisma.permission.findMany({
    where: { module: 'document' },
  });
  const documentReadExport = documentPerms.filter((p) =>
    [
      'document.read',
      'document.preview',
      'document.download',
      'document.export',
      'document.category.read',
    ].includes(p.code),
  );
  const engineerDocument = documentPerms.filter((p) =>
    [
      'document.read',
      'document.create',
      'document.update',
      'document.version.read',
      'document.version.create',
      'document.preview',
      'document.download',
      'document.translate',
      'document.export',
      'document.category.read',
    ].includes(p.code),
  );
  const pmDocument = documentPerms;
  const translatorDocument = documentPerms.filter((p) =>
    [
      'document.read',
      'document.preview',
      'document.download',
      'document.export',
      'document.category.read',
    ].includes(p.code),
  );

  await grantPerms(pmRole.id, pmDocument);
  await grantPerms(engineerRole.id, engineerDocument);
  await grantPerms(translatorRole.id, translatorDocument);
  await grantPerms(bossRole.id, documentReadExport);

  const drawingPerms = await prisma.permission.findMany({
    where: { module: 'drawing' },
  });
  const drawingReadExport = drawingPerms.filter((p) =>
    [
      'drawing.read',
      'drawing.preview',
      'drawing.download',
      'drawing.export',
    ].includes(p.code),
  );
  const engineerDrawing = drawingPerms.filter((p) =>
    [
      'drawing.read',
      'drawing.create',
      'drawing.update',
      'drawing.version.read',
      'drawing.version.create',
      'drawing.preview',
      'drawing.download',
      'drawing.submit_review',
      'drawing.export',
    ].includes(p.code),
  );
  const pmDrawing = drawingPerms.filter((p) =>
    [
      'drawing.read',
      'drawing.create',
      'drawing.update',
      'drawing.delete',
      'drawing.version.read',
      'drawing.version.create',
      'drawing.preview',
      'drawing.download',
      'drawing.review',
      'drawing.publish',
      'drawing.export',
    ].includes(p.code),
  );

  await grantPerms(engineerRole.id, engineerDrawing);
  await grantPerms(pmRole.id, pmDrawing);
  await grantPerms(bossRole.id, drawingReadExport);

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

  const procurementUser = await prisma.user.findUniqueOrThrow({
    where: { username: 'procurement' },
  });

  const demoSupplier = await prisma.supplier.upsert({
    where: { code: 'SUP-DEMO-001' },
    update: { name: '喀麦隆建材有限公司', contact: 'Jean', phone: '+237-600-0001' },
    create: {
      code: 'SUP-DEMO-001',
      name: '喀麦隆建材有限公司',
      contact: 'Jean',
      phone: '+237-600-0001',
      email: 'sales@demo-supplier.local',
      address: 'Douala, Cameroun',
    },
  });

  const pipeMaterial = await prisma.material.findFirstOrThrow({
    where: { projectId: demoProject.id, code: 'MAT-DEMO-001' },
  });

  const demoRequest = await prisma.purchaseRequest.upsert({
    where: { code: 'PR-DEMO-001' },
    update: {
      status: 'approved',
      projectId: demoProject.id,
      requesterId: procurementUser.id,
    },
    create: {
      code: 'PR-DEMO-001',
      projectId: demoProject.id,
      requesterId: procurementUser.id,
      status: 'approved',
      remark: '镀锌钢管补货申请（已审批）',
      items: {
        create: [
          {
            materialId: pipeMaterial.id,
            quantity: 500,
            unit: '米',
          },
        ],
      },
    },
    include: { items: true },
  });

  if (!demoRequest.items.length) {
    await prisma.purchaseRequestItem.create({
      data: {
        requestId: demoRequest.id,
        materialId: pipeMaterial.id,
        quantity: 500,
        unit: '米',
      },
    });
  }

  await prisma.purchaseOrder.upsert({
    where: { code: 'PO-DEMO-001' },
    update: {
      projectId: demoProject.id,
      supplierId: demoSupplier.id,
      requestId: demoRequest.id,
      totalAmount: 22750,
      totalCurrency: 'CNY',
      status: 'confirmed',
    },
    create: {
      code: 'PO-DEMO-001',
      projectId: demoProject.id,
      supplierId: demoSupplier.id,
      requestId: demoRequest.id,
      totalAmount: 22750,
      totalCurrency: 'CNY',
      status: 'confirmed',
      orderedAt: new Date(),
      items: {
        create: [
          {
            materialId: pipeMaterial.id,
            quantity: 500,
            unit: '米',
            unitPriceAmount: 45.5,
            unitPriceCurrency: 'CNY',
          },
        ],
      },
    },
  });

  const demoWarehouse = await prisma.warehouse.upsert({
    where: { code: 'WH-DEMO-DLA' },
    update: {
      name: '杜阿拉主仓',
      projectId: demoProject.id,
      address: 'Douala Industrial Zone',
      status: 'active',
    },
    create: {
      code: 'WH-DEMO-DLA',
      name: '杜阿拉主仓',
      projectId: demoProject.id,
      address: 'Douala Industrial Zone',
      status: 'active',
    },
  });

  const demoInbound = await prisma.stockInbound.upsert({
    where: { code: 'IN-DEMO-001' },
    update: {
      warehouseId: demoWarehouse.id,
      projectId: demoProject.id,
      type: 'purchase',
      status: 'confirmed',
      inboundAt: new Date(),
    },
    create: {
      code: 'IN-DEMO-001',
      warehouseId: demoWarehouse.id,
      projectId: demoProject.id,
      type: 'purchase',
      status: 'confirmed',
      inboundAt: new Date(),
      remark: '镀锌钢管采购入库',
      items: {
        create: [
          {
            materialId: pipeMaterial.id,
            quantity: 80,
            unit: '米',
          },
        ],
      },
    },
    include: { items: true },
  });

  await prisma.stockBalance.upsert({
    where: {
      warehouseId_materialId_projectId: {
        warehouseId: demoWarehouse.id,
        materialId: pipeMaterial.id,
        projectId: demoProject.id,
      },
    },
    update: { quantity: 80 },
    create: {
      warehouseId: demoWarehouse.id,
      materialId: pipeMaterial.id,
      projectId: demoProject.id,
      quantity: 80,
    },
  });

  if (!demoInbound.items.length) {
    await prisma.stockItem.create({
      data: {
        inboundId: demoInbound.id,
        materialId: pipeMaterial.id,
        quantity: 80,
        unit: '米',
      },
    });
  }

  await prisma.contract.upsert({
    where: { code: 'CTR-DEMO-001' },
    update: {
      name: '杜阿拉综合楼施工总包合同',
      nameFr: 'Contrat général Immeuble Douala',
      projectId: demoProject.id,
      partyA: '喀麦隆建设部',
      partyB: 'OverBuild 工程有限公司',
      amountAmount: 15000000,
      amountCurrency: 'CNY',
      type: 'construction',
      status: 'active',
      signedAt: new Date('2026-01-15'),
      startDate: new Date('2026-02-01'),
      endDate: new Date('2027-12-31'),
    },
    create: {
      code: 'CTR-DEMO-001',
      name: '杜阿拉综合楼施工总包合同',
      nameFr: 'Contrat général Immeuble Douala',
      projectId: demoProject.id,
      partyA: '喀麦隆建设部',
      partyB: 'OverBuild 工程有限公司',
      amountAmount: 15000000,
      amountCurrency: 'CNY',
      collectedAmountCurrency: 'CNY',
      type: 'construction',
      status: 'active',
      signedAt: new Date('2026-01-15'),
      startDate: new Date('2026-02-01'),
      endDate: new Date('2027-12-31'),
    },
  });

  const demoContract = await prisma.contract.findUniqueOrThrow({
    where: { code: 'CTR-DEMO-001' },
  });

  for (const currency of [
    { code: 'CNY', name: '人民币', symbol: '¥' },
    { code: 'USD', name: '美元', symbol: '$' },
    { code: 'EUR', name: '欧元', symbol: '€' },
    { code: 'XAF', name: '中非法郎', symbol: 'FCFA' },
  ]) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: { name: currency.name, symbol: currency.symbol },
      create: currency,
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.exchangeRate.upsert({
    where: {
      baseCurrency_quoteCurrency_rateDate: {
        baseCurrency: 'CNY',
        quoteCurrency: 'USD',
        rateDate: today,
      },
    },
    update: { rate: 0.138 },
    create: {
      baseCurrency: 'CNY',
      quoteCurrency: 'USD',
      rate: 0.138,
      rateDate: today,
    },
  });

  const cashAccount = await prisma.cashAccount.upsert({
    where: { code: 'CASH-001' },
    update: { name: '项目现金账户', balanceAmount: 500000, balanceCurrency: 'CNY' },
    create: {
      code: 'CASH-001',
      name: '项目现金账户',
      balanceAmount: 500000,
      balanceCurrency: 'CNY',
    },
  });

  const bankAccount = await prisma.bankAccount.upsert({
    where: { code: 'BANK-001' },
    update: {
      name: '杜阿拉项目主账户',
      bankName: '喀麦隆商业银行',
      accountNo: 'CM-88291001',
      balanceAmount: 2000000,
      balanceCurrency: 'CNY',
    },
    create: {
      code: 'BANK-001',
      name: '杜阿拉项目主账户',
      bankName: '喀麦隆商业银行',
      accountNo: 'CM-88291001',
      balanceAmount: 2000000,
      balanceCurrency: 'CNY',
    },
  });

  await prisma.budget.upsert({
    where: { id: '00000000-0000-4000-8000-000000000b01' },
    update: {
      projectId: demoProject.id,
      category: '土建工程',
      amountAmount: 8000000,
      amountCurrency: 'CNY',
      status: 'active',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000b01',
      projectId: demoProject.id,
      category: '土建工程',
      amountAmount: 8000000,
      amountCurrency: 'CNY',
    },
  });

  await prisma.income.upsert({
    where: { code: 'INC-DEMO-001' },
    update: {
      projectId: demoProject.id,
      contractId: demoContract.id,
      amountAmount: 500000,
      amountCurrency: 'CNY',
      receivedAt: new Date('2026-03-01'),
      summary: '首期进度款',
    },
    create: {
      code: 'INC-DEMO-001',
      projectId: demoProject.id,
      contractId: demoContract.id,
      amountAmount: 500000,
      amountCurrency: 'CNY',
      receivedAt: new Date('2026-03-01'),
      summary: '首期进度款',
    },
  });

  await prisma.collection.upsert({
    where: { code: 'COL-DEMO-001' },
    update: {
      contractId: demoContract.id,
      projectId: demoProject.id,
      amountAmount: 1000000,
      amountCurrency: 'CNY',
      collectedAt: new Date('2026-04-01'),
      accountType: 'bank',
      accountId: bankAccount.id,
      remark: '客户回款',
    },
    create: {
      code: 'COL-DEMO-001',
      contractId: demoContract.id,
      projectId: demoProject.id,
      amountAmount: 1000000,
      amountCurrency: 'CNY',
      collectedAt: new Date('2026-04-01'),
      accountType: 'bank',
      accountId: bankAccount.id,
      remark: '客户回款',
    },
  });

  await prisma.contract.update({
    where: { id: demoContract.id },
    data: {
      collectedAmountAmount: 1000000,
      collectedAmountCurrency: 'CNY',
    },
  });

  await prisma.cost.upsert({
    where: { id: '00000000-0000-4000-8000-000000000c01' },
    update: {
      projectId: demoProject.id,
      source: 'manual',
      category: '材料采购',
      amountAmount: 350000,
      amountCurrency: 'CNY',
      occurredAt: new Date('2026-05-01'),
      description: '钢材采购成本',
    },
    create: {
      id: '00000000-0000-4000-8000-000000000c01',
      projectId: demoProject.id,
      source: 'manual',
      category: '材料采购',
      amountAmount: 350000,
      amountCurrency: 'CNY',
      occurredAt: new Date('2026-05-01'),
      description: '钢材采购成本',
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNo: 'INV-DEMO-001' },
    update: {
      type: 'sales',
      amountAmount: 1000000,
      amountCurrency: 'CNY',
      taxRate: 0.13,
      issuedAt: new Date('2026-04-01'),
      contractId: demoContract.id,
      projectId: demoProject.id,
    },
    create: {
      invoiceNo: 'INV-DEMO-001',
      type: 'sales',
      amountAmount: 1000000,
      amountCurrency: 'CNY',
      taxRate: 0.13,
      issuedAt: new Date('2026-04-01'),
      contractId: demoContract.id,
      projectId: demoProject.id,
    },
  });

  const demoDocCategory = await prisma.documentCategory.upsert({
    where: { id: '00000000-0000-4000-8000-000000000d01' },
    update: {
      name: '施工方案',
      nameFr: 'Plan de construction',
      projectId: demoProject.id,
    },
    create: {
      id: '00000000-0000-4000-8000-000000000d01',
      name: '施工方案',
      nameFr: 'Plan de construction',
      projectId: demoProject.id,
    },
  });

  const demoDocId = '00000000-0000-4000-8000-000000000d02';
  const demoFileName = 'demo-plan.pdf';
  const demoFileUrl = `documents/${demoDocId}/1/${demoFileName}`;
  const demoFileDir = join(
    process.cwd(),
    'uploads',
    'documents',
    demoDocId,
    '1',
  );
  mkdirSync(demoFileDir, { recursive: true });
  writeFileSync(
    join(demoFileDir, demoFileName),
    '%PDF-1.4\n%Demo OverBuild document\n',
  );

  await prisma.document.upsert({
    where: { code: 'DOC-DEMO-001' },
    update: {
      title: '杜阿拉综合楼施工方案',
      titleFr: 'Plan Immeuble Douala',
      projectId: demoProject.id,
      categoryId: demoDocCategory.id,
      tags: ['施工', '方案'],
      searchText: '杜阿拉综合楼施工方案 plan immeuble douala 施工 方案',
      currentVersion: 1,
    },
    create: {
      id: demoDocId,
      code: 'DOC-DEMO-001',
      title: '杜阿拉综合楼施工方案',
      titleFr: 'Plan Immeuble Douala',
      projectId: demoProject.id,
      categoryId: demoDocCategory.id,
      tags: ['施工', '方案'],
      searchText: '杜阿拉综合楼施工方案 plan immeuble douala 施工 方案',
      currentVersion: 1,
      createdById: pmUser.id,
      versions: {
        create: {
          version: 1,
          fileUrl: demoFileUrl,
          fileName: demoFileName,
          fileType: 'pdf',
          fileSize: 48,
          uploadedById: pmUser.id,
        },
      },
    },
  });

  const demoDrawingId = '00000000-0000-4000-8000-000000000r01';
  const demoDrawingFile = 'demo-floor.pdf';
  const demoDrawingUrl = `drawings/${demoDrawingId}/1/${demoDrawingFile}`;
  const demoDrawingDir = join(
    process.cwd(),
    'uploads',
    'drawings',
    demoDrawingId,
    '1',
  );
  mkdirSync(demoDrawingDir, { recursive: true });
  writeFileSync(
    join(demoDrawingDir, demoDrawingFile),
    '%PDF-1.4\n%Demo OverBuild drawing\n',
  );

  await prisma.drawing.upsert({
    where: { drawingNo: 'A-DEMO-001' },
    update: {
      name: '杜阿拉综合楼平面图',
      nameFr: 'Plan RDC Douala',
      projectId: demoProject.id,
      discipline: 'arch',
      status: 'published',
      searchText: 'a-demo-001 杜阿拉综合楼平面图 plan rdc douala arch',
      currentVersion: 1,
    },
    create: {
      id: demoDrawingId,
      drawingNo: 'A-DEMO-001',
      name: '杜阿拉综合楼平面图',
      nameFr: 'Plan RDC Douala',
      projectId: demoProject.id,
      discipline: 'arch',
      status: 'published',
      searchText: 'a-demo-001 杜阿拉综合楼平面图 plan rdc douala arch',
      currentVersion: 1,
      createdById: pmUser.id,
      versions: {
        create: {
          version: 1,
          fileUrl: demoDrawingUrl,
          fileName: demoDrawingFile,
          fileType: 'pdf',
          fileSize: 48,
          uploadedById: pmUser.id,
        },
      },
    },
  });

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
