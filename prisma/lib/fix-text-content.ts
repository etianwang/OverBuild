import { PrismaClient } from '@prisma/client';
import {
  isCorruptedText,
  repairMilestoneName,
  repairProjectName,
  repairProjectNameFr,
  repairTaskName,
  repairZoneName,
} from './text-encoding';

type FixStat = { table: string; fixed: number };

export async function fixTextContent(prisma: PrismaClient): Promise<FixStat[]> {
  const stats: FixStat[] = [];

  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  let projectFixed = 0;
  for (const project of projects) {
    const updates: {
      name?: string;
      nameFr?: string | null;
      location?: string | null;
      description?: string | null;
    } = {};

    if (
      isCorruptedText(project.name) ||
      (project.code.startsWith('PRJ-ACPT-') && /^Acceptance/i.test(project.name))
    ) {
      updates.name = repairProjectName(project.code, project.status);
      projectFixed += 1;
    }
    if (isCorruptedText(project.nameFr)) {
      updates.nameFr = repairProjectNameFr(project.code);
      projectFixed += 1;
    }
    if (isCorruptedText(project.location)) {
      updates.location = '杜阿拉';
      projectFixed += 1;
    }
    if (isCorruptedText(project.description)) {
      updates.description = null;
      projectFixed += 1;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.project.update({
        where: { id: project.id },
        data: updates,
      });
    }
  }
  stats.push({ table: 'projects', fixed: projectFixed });

  const zones = await prisma.projectZone.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  let zoneFixed = 0;
  for (const [index, zone] of zones.entries()) {
    const updates: { name?: string; nameFr?: string | null; description?: string | null } =
      {};
    if (isCorruptedText(zone.name) || /^Zone\b/i.test(zone.name)) {
      updates.name = repairZoneName(index);
      zoneFixed += 1;
    }
    if (isCorruptedText(zone.nameFr)) {
      updates.nameFr = `Zone ${String.fromCharCode(65 + (index % 26))}`;
      zoneFixed += 1;
    }
    if (isCorruptedText(zone.description)) {
      updates.description = null;
      zoneFixed += 1;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.projectZone.update({ where: { id: zone.id }, data: updates });
    }
  }
  stats.push({ table: 'project_zones', fixed: zoneFixed });

  const milestones = await prisma.projectMilestone.findMany({
    orderBy: { createdAt: 'asc' },
  });
  let milestoneFixed = 0;
  for (const [index, milestone] of milestones.entries()) {
    if (
      isCorruptedText(milestone.name) ||
      /^Foundation$/i.test(milestone.name)
    ) {
      await prisma.projectMilestone.update({
        where: { id: milestone.id },
        data: { name: repairMilestoneName(index) },
      });
      milestoneFixed += 1;
    }
  }
  stats.push({ table: 'project_milestones', fixed: milestoneFixed });

  const tasks = await prisma.projectTask.findMany({
    where: { deletedAt: null },
    orderBy: { sortOrder: 'asc' },
  });
  let taskFixed = 0;
  for (const task of tasks) {
    const updates: {
      name?: string;
      nameFr?: string | null;
      prerequisites?: string | null;
    } = {};
    const repairedName = repairTaskName(task.name, task.sortOrder);
    if (repairedName !== task.name) {
      updates.name = repairedName;
      taskFixed += 1;
    }
    if (isCorruptedText(task.nameFr)) {
      updates.nameFr = null;
      taskFixed += 1;
    }
    if (isCorruptedText(task.prerequisites)) {
      updates.prerequisites = null;
      taskFixed += 1;
    }
    if (Object.keys(updates).length > 0) {
      await prisma.projectTask.update({ where: { id: task.id }, data: updates });
    }
  }
  stats.push({ table: 'project_tasks', fixed: taskFixed });

  const roles = await prisma.role.findMany();
  let roleFixed = 0;
  for (const role of roles) {
    if (isCorruptedText(role.name)) {
      await prisma.role.update({
        where: { id: role.id },
        data: { name: role.code },
      });
      roleFixed += 1;
    }
  }
  stats.push({ table: 'roles', fixed: roleFixed });

  const permissions = await prisma.permission.findMany();
  let permissionFixed = 0;
  for (const permission of permissions) {
    if (isCorruptedText(permission.name)) {
      await prisma.permission.update({
        where: { id: permission.id },
        data: { name: permission.code },
      });
      permissionFixed += 1;
    }
  }
  stats.push({ table: 'permissions', fixed: permissionFixed });

  const users = await prisma.user.findMany();
  let userFixed = 0;
  for (const user of users) {
    if (isCorruptedText(user.name)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: user.username === 'admin' ? '系统管理员' : user.username },
      });
      userFixed += 1;
    }
  }
  stats.push({ table: 'users', fixed: userFixed });

  return stats;
}
