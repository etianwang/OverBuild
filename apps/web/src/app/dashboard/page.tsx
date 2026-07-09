'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Card } from '@/components/ui/primitives';
import {
  DashboardOverview,
  getDashboardCostTrend,
  getDashboardOverview,
  getDashboardProfitRanking,
  hasPermission,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} ${currency}`;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [costTrend, setCostTrend] = useState<
    Array<{ month: string; amount: number }>
  >([]);
  const [profitRanking, setProfitRanking] = useState<
    Array<{ projectName: string; profit: { amount: number; currency: string } }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sections = new Set(overview?.sections ?? []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await getDashboardOverview();
        setOverview(res.data);
        const secs = new Set(res.data.sections);
        const tasks: Promise<void>[] = [];
        if (secs.has('costTrend')) {
          tasks.push(
            getDashboardCostTrend({ months: 6 }).then((trend) => {
              setCostTrend(trend.data.points);
            }),
          );
        }
        if (secs.has('profitRanking')) {
          tasks.push(
            getDashboardProfitRanking(5).then((rank) => {
              setProfitRanking(rank.data.list);
            }),
          );
        }
        await Promise.all(tasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const maxCost = Math.max(...costTrend.map((p) => p.amount), 1);

  const quickLinks = [
    { href: '/projects', label: '项目', show: hasPermission(user, 'project.read') },
    { href: '/approvals', label: '审批', show: user?.permissions?.includes('workflow.approve') },
    { href: '/materials', label: '材料', show: hasPermission(user, 'material.read') },
    { href: '/finance', label: '财务', show: hasPermission(user, 'finance.income.read') },
    { href: '/documents', label: '文档', show: hasPermission(user, 'document.read') },
    { href: '/translation', label: '翻译', show: hasPermission(user, 'translation.task.read') },
  ].filter((item) => item.show);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          欢迎回来，{user?.name ?? '用户'}
        </p>
      </div>

      {error && (
        <Card className="mb-4 border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}

      {loading ? (
        <div className="text-muted-foreground">加载中...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sections.has('projects') && (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">进行中项目</p>
                <p className="mt-2 text-2xl font-semibold">
                  {overview?.projects?.active ?? 0}
                </p>
              </Card>
            )}
            {sections.has('approvals') && (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">待办审批</p>
                <p className="mt-2 text-2xl font-semibold">
                  {overview?.todoApprovals ?? 0}
                </p>
              </Card>
            )}
            {sections.has('inventory') && (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">库存预警</p>
                <p className="mt-2 text-2xl font-semibold">
                  {overview?.inventoryAlerts ?? 0}
                </p>
              </Card>
            )}
            {sections.has('notifications') && (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">未读通知</p>
                <p className="mt-2 text-2xl font-semibold">
                  {overview?.unreadNotifications ?? 0}
                </p>
              </Card>
            )}
            {sections.has('finance') && overview?.finance && (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">利润汇总</p>
                <p className="mt-2 text-2xl font-semibold">
                  {formatMoney(
                    overview.finance.profit.amount,
                    overview.finance.profit.currency,
                  )}
                </p>
              </Card>
            )}
            {sections.has('procurement') && overview?.procurement && (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">待审采购</p>
                <p className="mt-2 text-2xl font-semibold">
                  {overview.procurement.pendingRequests}
                </p>
              </Card>
            )}
            {sections.has('translation') && overview?.translation && (
              <Card className="p-5">
                <p className="text-sm text-muted-foreground">待处理翻译</p>
                <p className="mt-2 text-2xl font-semibold">
                  {overview.translation.pending}
                </p>
              </Card>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sections.has('costTrend') && costTrend.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-4 font-medium">成本趋势（近 6 月）</h2>
                <div className="flex h-40 items-end gap-2">
                  {costTrend.map((point) => (
                    <div
                      key={point.month}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-t bg-primary/80 dark:bg-primary/60"
                        style={{
                          height: `${Math.max(8, (point.amount / maxCost) * 100)}%`,
                        }}
                        title={`${point.month}: ${point.amount}`}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {point.month.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {sections.has('profitRanking') && profitRanking.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-4 font-medium">项目利润排名</h2>
                <div className="space-y-3">
                  {profitRanking.map((item, index) => (
                    <div
                      key={item.projectName}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {index + 1}. {item.projectName}
                      </span>
                      <span className="font-medium text-primary">
                        {formatMoney(item.profit.amount, item.profit.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {sections.has('inventory') &&
              (overview?.inventoryAlertList?.length ?? 0) > 0 && (
                <Card className="p-5">
                  <h2 className="mb-4 font-medium">库存预警明细</h2>
                  <div className="space-y-2 text-sm">
                    {overview?.inventoryAlertList?.map((item) => (
                      <div key={item.id} className="flex justify-between">
                        <span>
                          {item.code} {item.name}
                        </span>
                        <span className="text-destructive">
                          {item.stock}/{item.minStock} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
          </div>

          {quickLinks.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 font-medium">快捷入口</h2>
              <div className="flex flex-wrap gap-2">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
