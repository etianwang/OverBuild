'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AuditLogItem,
  exportAuditLogs,
  getAuditLog,
  hasPermission,
  listAuditLogs,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const ACTION_LABEL: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  export: '导出',
  approve: '通过',
  reject: '驳回',
  login: '登录',
  logout: '登出',
};

export default function AuditLogsPage() {
  const user = useAuthStore((s) => s.user);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLogItem | null>(null);
  const [filters, setFilters] = useState({
    q: '',
    module: '',
    action: '',
    startDate: '',
    endDate: '',
  });

  const canRead = hasPermission(user, 'audit.read');
  const pageSize = 20;

  async function loadLogs(nextPage = page) {
    setLoading(true);
    try {
      const res = await listAuditLogs({
        page: nextPage,
        pageSize,
        q: filters.q || undefined,
        module: filters.module || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      setLogs(res.data.list);
      setTotal(res.data.total);
      setPage(nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canRead) {
      void loadLogs(1);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  async function handleViewDetail(id: string) {
    try {
      const res = await getAuditLog(id);
      setSelected(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载详情失败');
    }
  }

  async function handleExport() {
    try {
      await exportAuditLogs({
        q: filters.q || undefined,
        module: filters.module || undefined,
        action: filters.action || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看审计日志</Card>
      </AppShell>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">审计日志</h1>
        <Button variant="ghost" onClick={handleExport}>
          导出 CSV
        </Button>
      </div>

      <Card className="mb-6 p-4">
        <form
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            void loadLogs(1);
          }}
        >
          <Input
            placeholder="关键词"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
          <Input
            placeholder="模块"
            value={filters.module}
            onChange={(e) =>
              setFilters((f) => ({ ...f, module: e.target.value }))
            }
          />
          <select
            className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
            value={filters.action}
            onChange={(e) =>
              setFilters((f) => ({ ...f, action: e.target.value }))
            }
          >
            <option value="">全部动作</option>
            {Object.entries(ACTION_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, startDate: e.target.value }))
            }
          />
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters((f) => ({ ...f, endDate: e.target.value }))
            }
          />
          <Button type="submit">筛选</Button>
        </form>
      </Card>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left">时间</th>
                <th className="px-4 py-3 text-left">操作人</th>
                <th className="px-4 py-3 text-left">动作</th>
                <th className="px-4 py-3 text-left">模块</th>
                <th className="px-4 py-3 text-left">资源</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    加载中...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    暂无日志
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="cursor-pointer border-b border-border hover:bg-muted/30"
                    onClick={() => handleViewDetail(log.id)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">{log.user?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      {ACTION_LABEL[log.action] ?? log.action}
                    </td>
                    <td className="px-4 py-3">{log.module}</td>
                    <td className="px-4 py-3">{log.resource}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-lg font-medium">日志详情</h2>
          {selected ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">时间：</span>
                {new Date(selected.createdAt).toLocaleString('zh-CN')}
              </p>
              <p>
                <span className="text-muted-foreground">操作人：</span>
                {selected.user?.name ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">动作：</span>
                {ACTION_LABEL[selected.action] ?? selected.action}
              </p>
              <p>
                <span className="text-muted-foreground">模块：</span>
                {selected.module}
              </p>
              <p>
                <span className="text-muted-foreground">资源：</span>
                {selected.resource}
              </p>
              <p>
                <span className="text-muted-foreground">资源 ID：</span>
                {selected.resourceId ?? '—'}
              </p>
              <p>
                <span className="text-muted-foreground">IP：</span>
                {selected.ip ?? '—'}
              </p>
              <div>
                <p className="mb-1 text-muted-foreground">Payload：</p>
                <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(selected.payload, null, 2) ?? '—'}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">点击左侧记录查看详情</p>
          )}
        </Card>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          共 {total} 条，第 {page} / {totalPages} 页
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={page <= 1 || loading}
            onClick={() => loadLogs(page - 1)}
          >
            上一页
          </Button>
          <Button
            variant="ghost"
            disabled={page >= totalPages || loading}
            onClick={() => loadLogs(page + 1)}
          >
            下一页
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
