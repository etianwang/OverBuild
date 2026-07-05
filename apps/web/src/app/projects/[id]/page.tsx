'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { DhtmlxGanttChart } from '@/components/project/dhtmlx-gantt-chart';
import { Button, Card, Input } from '@/components/ui/primitives';
import {
  addProjectMember,
  createProjectMilestone,
  createProjectZone,
  getProject,
  getProjectGantt,
  hasPermission,
  listUsers,
  ProjectDetail,
  ProjectGanttData,
  UserItem,
} from '@/lib/api';
import { flattenTaskTree } from '@/lib/task-tree';
import { useAuthStore } from '@/stores/auth-store';

const STATUS_LABEL: Record<string, string> = {
  planning: '筹备中',
  active: '进行中',
  suspended: '暂停',
  completed: '已完成',
  pending: '待完成',
  overdue: '已逾期',
};

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [gantt, setGantt] = useState<ProjectGanttData | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [memberForm, setMemberForm] = useState({ userId: '', role: 'engineer' });
  const [milestoneForm, setMilestoneForm] = useState({ name: '', dueDate: '' });

  const canRead = hasPermission(user, 'project.read');
  const canManageZone = hasPermission(user, 'project.zone.manage');
  const canManageMember = hasPermission(user, 'project.member.manage');
  const canManageMilestone = hasPermission(user, 'project.milestone.manage');

  async function load() {
    setLoading(true);
    try {
      const [projectRes, ganttRes] = await Promise.all([
        getProject(params.id),
        getProjectGantt(params.id),
      ]);
      setProject(projectRes.data);
      setGantt(ganttRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasHydrated) return;
    if (!canRead) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const [projectRes, ganttRes] = await Promise.all([
          getProject(params.id),
          getProjectGantt(params.id),
        ]);
        setProject(projectRes.data);
        setGantt(ganttRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    })();
    if (canManageMember) {
      listUsers(1, 100)
        .then((res) => setUsers(res.data.list))
        .catch(() => undefined);
    }
  }, [hasHydrated, canRead, canManageMember, params.id]);

  async function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createProjectZone(params.id, { name: zoneName });
      setZoneName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加区域失败');
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addProjectMember(params.id, memberForm);
      setMemberForm({ userId: '', role: 'engineer' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加成员失败');
    }
  }

  async function handleAddMilestone(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createProjectMilestone(params.id, {
        name: milestoneForm.name,
        dueDate: milestoneForm.dueDate || undefined,
      });
      setMilestoneForm({ name: '', dueDate: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加里程碑失败');
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看项目详情</Card>
      </AppShell>
    );
  }

  if (!hasHydrated || loading) {
    return (
      <AppShell>
        <Card className="p-6">加载中...</Card>
      </AppShell>
    );
  }

  if (!project) {
    return (
      <AppShell>
        <Card className="p-6">项目不存在</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-primary hover:underline">
          ← 返回项目列表
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {project.name}
          <span className="ml-3 text-base font-normal text-muted-foreground">
            {project.code}
          </span>
        </h1>
        <div className="mt-3">
          <Link href={`/projects/${params.id}/schedule`}>
            <Button variant="ghost">施工计划与甘特图 →</Button>
          </Link>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">状态</p>
          <p className="text-lg font-medium">
            {STATUS_LABEL[project.status] ?? project.status}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">项目经理</p>
          <p className="text-lg font-medium">{project.manager?.name ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">地点</p>
          <p className="text-lg font-medium">{project.location ?? '—'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">利润（待财务模块）</p>
          <p className="text-lg font-medium">—</p>
        </Card>
      </div>

      <Card className="mb-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">进度总览</h2>
            {gantt && (
              <p className="mt-1 text-sm text-muted-foreground">
                {gantt.overview.totalTasks} 项施工内容 · 平均进度{' '}
                {gantt.overview.avgProgress}% · 已完成{' '}
                {gantt.overview.completedTasks} 项
              </p>
            )}
          </div>
          <Link href={`/projects/${params.id}/schedule`}>
            <Button variant="ghost">管理施工内容</Button>
          </Link>
        </div>
        {gantt && (
          <DhtmlxGanttChart
            tasks={flattenTaskTree(gantt.tasks)
              .filter((t) => t.showInGantt !== false)
              .map((t) => ({
              ...t,
              assignee: t.assignee ?? undefined,
            }))}
            compact
            readOnly
          />
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-medium">施工区域</h2>
          <ul className="mb-4 space-y-2 text-sm">
            {project.zones?.length ? (
              project.zones.map((z) => (
                <li key={z.id} className="rounded-lg border border-border px-3 py-2">
                  {z.name}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">暂无区域</li>
            )}
          </ul>
          {canManageZone && (
            <form onSubmit={handleAddZone} className="flex gap-2">
              <Input
                placeholder="区域名称"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                required
              />
              <Button type="submit">添加</Button>
            </form>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-medium">项目成员</h2>
          <ul className="mb-4 space-y-2 text-sm">
            {project.members?.length ? (
              project.members.map((m) => (
                <li key={m.id} className="rounded-lg border border-border px-3 py-2">
                  {m.user.name} · {m.role}
                </li>
              ))
            ) : (
              <li className="text-muted-foreground">暂无成员</li>
            )}
          </ul>
          {canManageMember && (
            <form onSubmit={handleAddMember} className="flex flex-wrap gap-2">
              <select
                className="flex h-10 min-w-[160px] rounded-lg border border-border bg-card px-3 text-sm"
                value={memberForm.userId}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, userId: e.target.value }))
                }
                required
              >
                <option value="">选择用户</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="角色"
                value={memberForm.role}
                onChange={(e) =>
                  setMemberForm((f) => ({ ...f, role: e.target.value }))
                }
                required
              />
              <Button type="submit">添加</Button>
            </form>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 text-lg font-medium">里程碑</h2>
          <table className="mb-4 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="py-2">名称</th>
                <th className="py-2">计划日期</th>
                <th className="py-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {project.milestones?.length ? (
                project.milestones.map((m) => (
                  <tr key={m.id} className="border-b border-border">
                    <td className="py-2">{m.name}</td>
                    <td className="py-2">
                      {m.dueDate ? String(m.dueDate).slice(0, 10) : '—'}
                    </td>
                    <td className="py-2">
                      {STATUS_LABEL[m.status] ?? m.status}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-4 text-muted-foreground">
                    暂无里程碑
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {canManageMilestone && (
            <form onSubmit={handleAddMilestone} className="flex flex-wrap gap-2">
              <Input
                placeholder="里程碑名称"
                value={milestoneForm.name}
                onChange={(e) =>
                  setMilestoneForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
              <Input
                type="date"
                value={milestoneForm.dueDate}
                onChange={(e) =>
                  setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
              <Button type="submit">添加</Button>
            </form>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
