'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createDrawing,
  DRAWING_DISCIPLINE_LABEL,
  DRAWING_STATUS_LABEL,
  DrawingItem,
  hasPermission,
  listDrawings,
  listProjects,
  openDrawingPreview,
  ProjectItem,
  publishDrawing,
  reviewDrawing,
  submitDrawingReview,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function DrawingsPage() {
  const user = useAuthStore((s) => s.user);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selected, setSelected] = useState<DrawingItem | null>(null);

  const [form, setForm] = useState({
    drawingNo: '',
    name: '',
    nameFr: '',
    projectId: '',
    discipline: 'arch',
    file: null as File | null,
  });

  const canRead = hasPermission(user, 'drawing.read');
  const canCreate = hasPermission(user, 'drawing.create');
  const canSubmitReview = hasPermission(user, 'drawing.submit_review');
  const canReview = hasPermission(user, 'drawing.review');
  const canPublish = hasPermission(user, 'drawing.publish');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [drawRes, projRes] = await Promise.all([
        listDrawings({ q: q || undefined, projectId: projectId || undefined }),
        listProjects({ page: 1, pageSize: 100 }),
      ]);
      setDrawings(drawRes.data.list);
      setTotal(drawRes.data.total);
      setProjects(projRes.data.list);
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
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, projectId]);

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看图纸</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">图纸管理</h1>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="搜索图号、名称、专业..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button variant="ghost" onClick={() => void loadData()}>
            搜索
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3 font-medium">
              图纸列表 ({total})
            </div>
            {loading ? (
              <div className="p-6 text-muted-foreground">加载中...</div>
            ) : (
              <div className="divide-y divide-border">
                {drawings.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-muted/50"
                    onClick={() => setSelected(item)}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{item.drawingNo}</span>
                      <span className="text-muted-foreground">
                        {DRAWING_STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </div>
                    <div>{item.name}</div>
                    <div className="text-muted-foreground">
                      {item.project?.name} ·{' '}
                      {DRAWING_DISCIPLINE_LABEL[item.discipline]} · v
                      {item.currentVersion}
                    </div>
                  </button>
                ))}
                {!drawings.length && (
                  <div className="px-4 py-6 text-center text-muted-foreground">
                    暂无图纸
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            {selected && (
              <Card className="p-4 text-sm">
                <h2 className="mb-2 font-medium">{selected.name}</h2>
                <p>图号：{selected.drawingNo}</p>
                <p>专业：{DRAWING_DISCIPLINE_LABEL[selected.discipline]}</p>
                <p>版本：v{selected.currentVersion}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      openDrawingPreview(
                        selected.id,
                        selected.currentVersion,
                      ).catch((err) =>
                        setError(err instanceof Error ? err.message : '预览失败'),
                      )
                    }
                  >
                    预览
                  </Button>
                  {selected.status === 'draft' && canSubmitReview && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        submitDrawingReview(selected.id).then(() => loadData())
                      }
                    >
                      提交审阅
                    </Button>
                  )}
                  {selected.status === 'reviewing' && canReview && (
                    <>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          reviewDrawing(selected.id, {
                            result: 'approved',
                          }).then(() => loadData())
                        }
                      >
                        批准
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          reviewDrawing(selected.id, {
                            result: 'rejected',
                          }).then(() => loadData())
                        }
                      >
                        驳回
                      </Button>
                    </>
                  )}
                  {selected.status === 'approved' && canPublish && (
                    <Button
                      onClick={() =>
                        publishDrawing(selected.id).then(() => loadData())
                      }
                    >
                      发布
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {canCreate && (
              <Card className="p-4">
                <h2 className="mb-3 font-medium">上传图纸</h2>
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!form.file) {
                      setError('请选择文件');
                      return;
                    }
                    await createDrawing(
                      {
                        drawingNo: form.drawingNo,
                        name: form.name,
                        nameFr: form.nameFr || undefined,
                        projectId: form.projectId,
                        discipline: form.discipline,
                      },
                      form.file,
                    );
                    setForm({
                      drawingNo: '',
                      name: '',
                      nameFr: '',
                      projectId: '',
                      discipline: 'arch',
                      file: null,
                    });
                    await loadData();
                  }}
                >
                  <Input
                    placeholder="图号"
                    value={form.drawingNo}
                    onChange={(e) =>
                      setForm({ ...form, drawingNo: e.target.value })
                    }
                    required
                  />
                  <Input
                    placeholder="图纸名称"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <select
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    value={form.projectId}
                    onChange={(e) =>
                      setForm({ ...form, projectId: e.target.value })
                    }
                    required
                  >
                    <option value="">选择项目</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    value={form.discipline}
                    onChange={(e) =>
                      setForm({ ...form, discipline: e.target.value })
                    }
                  >
                    <option value="arch">建筑</option>
                    <option value="struct">结构</option>
                    <option value="mep">机电</option>
                    <option value="civil">土建</option>
                    <option value="other">其他</option>
                  </select>
                  <Input
                    type="file"
                    accept=".dwg,.pdf,.png,.jpg,.jpeg,.webp"
                    onChange={(e) =>
                      setForm({ ...form, file: e.target.files?.[0] ?? null })
                    }
                    required
                  />
                  <Button type="submit">上传</Button>
                </form>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
