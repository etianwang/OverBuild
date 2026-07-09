'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { createUser, hasPermission, listUsers, UserItem } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function UsersPage() {
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
  });

  const canRead = hasPermission(user, 'auth.user.read');
  const canCreate = hasPermission(user, 'auth.user.create');

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await listUsers();
      setUsers(res.data.list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canRead) loadUsers();
    else setLoading(false);
  }, [canRead]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createUser(form);
      setForm({ username: '', password: '', name: '', email: '' });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看用户列表</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">用户管理</h1>
      </div>

      {canCreate && (
        <Card className="mb-6 p-6">
          <h2 className="mb-4 text-lg font-medium">新增用户</h2>
          <form
            onSubmit={handleCreate}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            <Input
              placeholder="用户名"
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              required
            />
            <Input
              placeholder="密码"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              required
            />
            <Input
              placeholder="姓名"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              placeholder="邮箱"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <Button type="submit">创建</Button>
          </form>
        </Card>
      )}

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">用户名</th>
              <th className="px-4 py-3 text-left">姓名</th>
              <th className="px-4 py-3 text-left">邮箱</th>
              <th className="px-4 py-3 text-left">状态</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  加载中...
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="border-b border-border">
                  <td className="px-4 py-3">{u.username}</td>
                  <td className="px-4 py-3">{u.name}</td>
                  <td className="px-4 py-3">{u.email ?? '—'}</td>
                  <td className="px-4 py-3">{u.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}
