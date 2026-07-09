'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createProject,
  hasPermission,
  listProjects,
  listUsers,
  ProjectItem,
  UserItem,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const STATUS_LABEL: Record<string, string> = {
  planning: '筹备中',
  active: '进行中',
  suspended: '暂停',
  completed: '已完成',
};

export default function ProjectsPage() {
  const user = useAuthStore((s) => s.user);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    location: '',
    status: 'planning',
    managerId: '',
  });

  const canRead = hasPermission(user, 'project.read');
  const canCreate = hasPermission(user, 'project.create');

  async function loadProjects(search = q) {
    setLoading(true);
    try {
      const res = await listProjects({ q: search || undefined });
      setProjects(res.data.list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      try {
        const res = await listProjects({ q: q || undefined });
        setProjects(res.data.list);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    })();
    if (canCreate) {
      listUsers(1, 100)
        .then((res) => setUsers(res.data.list))
        .catch(() => undefined);
    }
  }, [canRead, canCreate, q]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createProject(form);
      setForm({ code: '', name: '', location: '', status: 'planning', managerId: '' });
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看项目列表</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">项目管理</h1>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            loadProjects(q);
          }}
        >
          <Input
            placeholder="搜索编号/名称/地点"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button type="submit">搜索</Button>
        </form>
      </div>

      {canCreate && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-medium">新增项目</h2>
          <form
            onSubmit={handleCreate}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <Input
              placeholder="项目编号"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              required
            />
            <Input
              placeholder="项目名称"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              placeholder="项目地点"
              value={form.location}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
            />
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value }))
              }
            >
              <option value="planning">筹备中</option>
              <option value="active">进行中</option>
              <option value="suspended">暂停</option>
              <option value="completed">已完成</option>
            </select>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              value={form.managerId}
              onChange={(e) =>
                setForm((f) => ({ ...f, managerId: e.target.value }))
              }
              required
            >
              <option value="">选择项目经理</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
            <Button type="submit">创建项目</Button>
          </form>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">编号</th>
              <th className="px-4 py-3 text-left">名称</th>
              <th className="px-4 py-3 text-left">状态</th>
              <th className="px-4 py-3 text-left">项目经理</th>
              <th className="px-4 py-3 text-left">地点</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  暂无项目
                </td>
              </tr>
            ) : (
              projects.map((p) => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="text-primary hover:underline">
                      {p.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{p.name}</td>
                  <td className="px-4 py-3">{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="px-4 py-3">{p.manager?.name ?? '—'}</td>
                  <td className="px-4 py-3">{p.location ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
