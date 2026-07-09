'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  ApprovalItem,
  approvalStatusLabel,
  approvalTypeLabel,
  approveApproval,
  cancelApproval,
  exportApprovals,
  getApproval,
  hasPermission,
  listApprovalDone,
  listApprovalInitiated,
  listApprovalTodo,
  listApprovals,
  rejectApproval,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type TabKey = 'todo' | 'done' | 'initiated' | 'all';

const TABS: { key: TabKey; label: string; needsApprove?: boolean }[] = [
  { key: 'todo', label: '待办', needsApprove: true },
  { key: 'done', label: '已办', needsApprove: true },
  { key: 'initiated', label: '我发起的' },
  { key: 'all', label: '全部', needsApprove: true },
];

export default function ApprovalsPage() {
  const user = useAuthStore((s) => s.user);
  const canApprove = hasPermission(user, 'workflow.approve');

  const [tab, setTab] = useState<TabKey>('initiated');
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);

  const pageSize = 20;

  const loadList = useCallback(
    async (nextPage = page) => {
      setLoading(true);
      setError('');
      try {
        const params = { page: nextPage, pageSize, q: q || undefined };
        let res;
        if (tab === 'todo') {
          res = await listApprovalTodo(params);
        } else if (tab === 'done') {
          res = await listApprovalDone(params);
        } else if (tab === 'initiated') {
          res = await listApprovalInitiated(params);
        } else {
          res = await listApprovals(params);
        }
        setItems(res.data.list);
        setTotal(res.data.total);
        setPage(nextPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    },
    [page, pageSize, q, tab],
  );

  useEffect(() => {
    void loadList(1);
  }, [loadList, tab]);

  async function openDetail(id: string) {
    try {
      const res = await getApproval(id);
      setSelected(res.data);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载详情失败');
    }
  }

  async function handleApprove() {
    if (!selected) return;
    setActing(true);
    try {
      await approveApproval(selected.id, comment || undefined);
      setSelected(null);
      await loadList(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!selected) return;
    setActing(true);
    try {
      await rejectApproval(selected.id, comment || undefined);
      setSelected(null);
      await loadList(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    if (!selected) return;
    setActing(true);
    try {
      await cancelApproval(selected.id);
      setSelected(null);
      await loadList(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : '撤回失败');
    } finally {
      setActing(false);
    }
  }

  async function handleExport() {
    try {
      await exportApprovals({
        q: q || undefined,
        scope: tab === 'initiated' || !canApprove ? 'initiated' : 'all',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    }
  }

  const visibleTabs = TABS.filter((t) => !t.needsApprove || canApprove);
  const canActOnSelected =
    selected?.status === 'pending' &&
    canApprove &&
    selected.currentApproverId === user?.id;
  const canCancelSelected =
    selected?.status === 'pending' &&
    (user?.id === selected.initiatorId || user?.roles?.includes('admin'));

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">审批中心</h1>
            <p className="text-sm text-muted-foreground">
              待办、已办与我发起的审批事项
            </p>
          </div>
          <Button variant="ghost" onClick={() => void handleExport()}>
            导出 Excel
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((t) => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'default' : 'ghost'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <Card className="p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              placeholder="搜索单号、发起人、项目..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={() => void loadList(1)}>搜索</Button>
          </div>

          {error ? (
            <p className="mb-3 text-sm text-destructive">{error}</p>
          ) : null}

          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4">单号</th>
                    <th className="py-2 pr-4">类型</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2 pr-4">发起人</th>
                    <th className="py-2 pr-4">项目</th>
                    <th className="py-2 pr-4">时间</th>
                    <th className="py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{item.code}</td>
                      <td className="py-2 pr-4">
                        {approvalTypeLabel(item.type)}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-xs',
                            item.status === 'pending' &&
                              'bg-amber-500/15 text-amber-700 dark:text-amber-300',
                            item.status === 'approved' &&
                              'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                            item.status === 'rejected' &&
                              'bg-red-500/15 text-red-700 dark:text-red-300',
                            item.status === 'cancelled' &&
                              'bg-muted text-muted-foreground',
                          )}
                        >
                          {approvalStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{item.initiator?.name ?? '—'}</td>
                      <td className="py-2 pr-4">{item.project?.name ?? '—'}</td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2">
                        <Button
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => void openDetail(item.id)}
                        >
                          详情
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              共 {total} 条，第 {page} 页
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1}
                onClick={() => void loadList(page - 1)}
              >
                上一页
              </Button>
              <Button
                variant="ghost"
                disabled={page * pageSize >= total}
                onClick={() => void loadList(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </Card>

        {selected ? (
          <Card className="p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.code}</h2>
                <p className="text-sm text-muted-foreground">
                  {approvalTypeLabel(selected.type)} ·{' '}
                  {approvalStatusLabel(selected.status)} · 节点{' '}
                  {selected.currentNode}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                关闭
              </Button>
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">发起人</dt>
                <dd>{selected.initiator?.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">项目</dt>
                <dd>{selected.project?.name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">业务 ID</dt>
                <dd className="font-mono text-xs">{selected.businessId}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">创建时间</dt>
                <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
              </div>
            </dl>

            {selected.records && selected.records.length > 0 ? (
              <div className="mt-4">
                <h3 className="mb-2 text-sm font-medium">审批记录</h3>
                <ul className="space-y-2 text-sm">
                  {selected.records.map((record) => (
                    <li
                      key={record.id}
                      className="rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          节点 {record.node} · {record.approver.name}
                        </span>
                        <span
                          className={cn(
                            'text-xs',
                            record.action === 'approve'
                              ? 'text-emerald-600'
                              : 'text-red-600',
                          )}
                        >
                          {record.action === 'approve' ? '通过' : '驳回'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(record.actedAt).toLocaleString()}
                        </span>
                      </div>
                      {record.comment ? (
                        <p className="mt-1 text-muted-foreground">
                          {record.comment}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canActOnSelected || canCancelSelected ? (
              <div className="mt-4 space-y-3 border-t border-border pt-4">
                {canActOnSelected ? (
                  <Input
                    placeholder="审批意见（可选）"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {canActOnSelected ? (
                    <>
                      <Button disabled={acting} onClick={() => void handleApprove()}>
                        通过
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-destructive"
                        disabled={acting}
                        onClick={() => void handleReject()}
                      >
                        驳回
                      </Button>
                    </>
                  ) : null}
                  {canCancelSelected ? (
                    <Button
                      variant="ghost"
                      disabled={acting}
                      onClick={() => void handleCancel()}
                    >
                      撤回
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
