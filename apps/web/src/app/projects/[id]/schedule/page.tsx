'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import {
  DhtmlxGanttChart,
  type DhtmlxGanttChartHandle,
} from '@/components/project/dhtmlx-gantt-chart';
import { Button, Card } from '@/components/ui/primitives';
import {
  exportProjectTasks,
  getProject,
  getProjectGantt,
  hasPermission,
} from '@/lib/api';
import type { ProjectDetail, ProjectGanttOverview, ProjectTaskItem } from '@/lib/api';
import { flattenTaskTree } from '@/lib/task-tree';
import { useAuthStore } from '@/stores/auth-store';

export default function ProjectSchedulePage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [overview, setOverview] = useState<ProjectGanttOverview | null>(null);
  const [chartTasks, setChartTasks] = useState<ProjectTaskItem[]>([]);
  const [chartKey, setChartKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'csv' | 'msproject' | null>(null);
  const ganttChartRef = useRef<DhtmlxGanttChartHandle>(null);

  const canRead = hasPermission(user, 'project.read');
  const canManage = hasPermission(user, 'project.task.manage');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, ganttRes] = await Promise.all([
        getProject(params.id),
        getProjectGantt(params.id),
      ]);
      setProject(projectRes.data);
      setOverview(ganttRes.data.overview);
      setChartTasks(flattenTaskTree(ganttRes.data.tasks));
      setChartKey((key) => key + 1);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const syncOverviewOnly = useCallback(async () => {
    try {
      const ganttRes = await getProjectGantt(params.id);
      setOverview(ganttRes.data.overview);
    } catch {
      // 概览刷新失败不影响甘特图编辑
    }
  }, [params.id]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!canRead) {
      setLoading(false);
      return;
    }
    void load();
  }, [hasHydrated, canRead, load]);

  const treeTasks = chartTasks;

  async function handleExportCsv() {
    setExporting('csv');
    setError('');
    try {
      await exportProjectTasks(params.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出 CSV 失败');
    } finally {
      setExporting(null);
    }
  }

  async function handleExportMsProject() {
    setExporting('msproject');
    setError('');
    try {
      await ganttChartRef.current?.exportMsProject(project!.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出 MS Project 失败');
    } finally {
      setExporting(null);
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看施工进度</Card>
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

  if (!project || !overview) {
    return (
      <AppShell>
        <Card className="p-6">项目不存在</Card>
      </AppShell>
    );
  }

  const overviewStats = overview;

  return (
    <AppShell>
      <div className="mb-6">
        <Link
          href={`/projects/${params.id}`}
          className="text-sm text-primary hover:underline"
        >
          ← 返回项目详情
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          施工计划
          <span className="ml-3 text-base font-normal text-muted-foreground">
            {project.name}
          </span>
        </h1>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">施工项总数</p>
          <p className="text-2xl font-semibold">{overviewStats.totalTasks}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">已排期</p>
          <p className="text-2xl font-semibold">{overviewStats.scheduledTasks}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">平均进度</p>
          <p className="text-2xl font-semibold">{overviewStats.avgProgress}%</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">计划周期</p>
          <p className="text-lg font-medium">
            {overviewStats.startDate && overviewStats.endDate
              ? `${overviewStats.startDate} ~ ${overviewStats.endDate}`
              : '—'}
          </p>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {canManage
              ? '选中一行后升级/降级；Shift+←/→ 快捷键；点击 + 添加，双击编辑'
              : '只读模式'}
          </p>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="h-8 px-3 text-sm"
              disabled={!!exporting || !treeTasks.length}
              onClick={() => void handleExportCsv()}
            >
              {exporting === 'csv' ? '导出中…' : '导出 CSV'}
            </Button>
            <Button
              variant="ghost"
              className="h-8 px-3 text-sm"
              disabled={!!exporting}
              onClick={() => void handleExportMsProject()}
              title="导出 MS Project 兼容 XML，可用 Microsoft Project 打开并另存为 .mpp"
            >
              {exporting === 'msproject' ? '导出中…' : '导出 MS Project'}
            </Button>
          </div>
        </div>

        <DhtmlxGanttChart
          key={chartKey}
          ref={ganttChartRef}
          projectId={params.id}
          tasks={treeTasks}
          editable={canManage}
          onOverviewSync={syncOverviewOnly}
        />
      </Card>
    </AppShell>
  );
}
