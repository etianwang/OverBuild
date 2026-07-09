'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
} from 'recharts';
import {
  AlertCircle,
  Bell,
  ClipboardCheck,
  FolderKanban,
  Languages,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DashboardOverview,
  getDashboardCostTrend,
  getDashboardOverview,
  getDashboardProfitRanking,
  hasPermission,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const costChartConfig = {
  amount: {
    label: '成本',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })} ${currency}`;
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription>{title}</CardDescription>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
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

  const costChartData = costTrend.map((point) => ({
    month: point.month.slice(5),
    amount: point.amount,
  }));

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
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          欢迎回来，{user?.name ?? '用户'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle />
          <AlertTitle>加载失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {sections.has('projects') && (
              <StatCard
                title="进行中项目"
                value={overview?.projects?.active ?? 0}
                icon={FolderKanban}
              />
            )}
            {sections.has('approvals') && (
              <StatCard
                title="待办审批"
                value={overview?.todoApprovals ?? 0}
                icon={ClipboardCheck}
              />
            )}
            {sections.has('inventory') && (
              <StatCard
                title="库存预警"
                value={overview?.inventoryAlerts ?? 0}
                icon={Package}
              />
            )}
            {sections.has('notifications') && (
              <StatCard
                title="未读通知"
                value={overview?.unreadNotifications ?? 0}
                icon={Bell}
              />
            )}
            {sections.has('finance') && overview?.finance && (
              <StatCard
                title="利润汇总"
                value={formatMoney(
                  overview.finance.profit.amount,
                  overview.finance.profit.currency,
                )}
                icon={TrendingUp}
              />
            )}
            {sections.has('procurement') && overview?.procurement && (
              <StatCard
                title="待审采购"
                value={overview.procurement.pendingRequests}
                icon={ShoppingCart}
              />
            )}
            {sections.has('translation') && overview?.translation && (
              <StatCard
                title="待处理翻译"
                value={overview.translation.pending}
                icon={Languages}
              />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {sections.has('costTrend') && costChartData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>成本趋势</CardTitle>
                  <CardDescription>近 6 个月项目成本</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={costChartConfig}
                    className="aspect-auto h-[220px] w-full"
                  >
                    <BarChart data={costChartData} accessibilityLayer>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar
                        dataKey="amount"
                        fill="var(--color-amount)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}

            {sections.has('profitRanking') && profitRanking.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>项目利润排名</CardTitle>
                  <CardDescription>按利润金额 Top 5</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profitRanking.map((item, index) => (
                    <div key={item.projectName}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge variant="secondary">{index + 1}</Badge>
                          <span className="truncate">{item.projectName}</span>
                        </div>
                        <span className="shrink-0 font-medium text-primary">
                          {formatMoney(
                            item.profit.amount,
                            item.profit.currency,
                          )}
                        </span>
                      </div>
                      {index < profitRanking.length - 1 && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {sections.has('inventory') &&
              (overview?.inventoryAlertList?.length ?? 0) > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>库存预警明细</CardTitle>
                    <CardDescription>低于安全库存的材料</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {overview?.inventoryAlertList?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {item.code} {item.name}
                        </span>
                        <Badge variant="destructive">
                          {item.stock}/{item.minStock} {item.unit}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
          </div>

          {quickLinks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>快捷入口</CardTitle>
                <CardDescription>按权限显示的常用模块</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {quickLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <Button variant="outline" size="sm">
                      {link.label}
                    </Button>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
