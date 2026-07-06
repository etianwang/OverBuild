'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button, Card, Input } from '@/components/ui/primitives';
import {
  createMaterial,
  createMaterialCategory,
  deleteMaterial,
  exportMaterials,
  getMaterialQrcode,
  hasPermission,
  importMaterials,
  listMaterialAlerts,
  listMaterialCategories,
  listMaterials,
  listProjects,
  MATERIAL_DISCIPLINE_LABEL,
  MaterialAlertItem,
  MaterialCategoryItem,
  MaterialItem,
  ProjectItem,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type TabKey = 'list' | 'alerts' | 'categories';

export default function MaterialsPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabKey>('list');
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [alerts, setAlerts] = useState<MaterialAlertItem[]>([]);
  const [categories, setCategories] = useState<MaterialCategoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [importText, setImportText] = useState('');
  const [qrInfo, setQrInfo] = useState<string>('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    spec: '',
    unit: '',
    categoryId: '',
    projectId: '',
    storageLocation: '',
    minStock: '',
    priceAmount: '',
    priceCurrency: 'CNY',
  });
  const [categoryForm, setCategoryForm] = useState({
    code: '',
    name: '',
    discipline: 'general',
    description: '',
  });

  const canRead = hasPermission(user, 'material.read');
  const canCreate = hasPermission(user, 'material.create');
  const canDelete = hasPermission(user, 'material.delete');
  const canImport = hasPermission(user, 'material.import');
  const canExport = hasPermission(user, 'material.export');
  const canManageCategory = hasPermission(user, 'material.category.manage');

  async function loadCategories() {
    const res = await listMaterialCategories();
    setCategories(res.data);
  }

  async function loadList() {
    setLoading(true);
    try {
      if (tab === 'alerts') {
        const res = await listMaterialAlerts({ page: 1, pageSize: 50 });
        setAlerts(res.data.list);
        setTotal(res.data.total);
      } else if (tab === 'list') {
        const res = await listMaterials({
          q: q || undefined,
          categoryId: categoryId || undefined,
          projectId: projectId || undefined,
          discipline: discipline || undefined,
        });
        setMaterials(res.data.list);
        setTotal(res.data.total);
      } else {
        await loadCategories();
      }
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
    void loadList();
    void loadCategories();
    listProjects({ page: 1, pageSize: 100 })
      .then((res) => setProjects(res.data.list))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, tab]);

  async function handleCreateMaterial(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createMaterial({
        code: form.code,
        name: form.name,
        spec: form.spec || undefined,
        unit: form.unit,
        categoryId: form.categoryId,
        projectId: form.projectId,
        storageLocation: form.storageLocation || undefined,
        minStock: form.minStock ? Number(form.minStock) : undefined,
        purchasePrice: form.priceAmount
          ? {
              amount: Number(form.priceAmount),
              currency: form.priceCurrency,
            }
          : undefined,
      });
      setForm({
        code: '',
        name: '',
        spec: '',
        unit: '',
        categoryId: '',
        projectId: '',
        storageLocation: '',
        minStock: '',
        priceAmount: '',
        priceCurrency: 'CNY',
      });
      setTab('list');
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createMaterialCategory(categoryForm);
      setCategoryForm({ code: '', name: '', discipline: 'general', description: '' });
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建分类失败');
    }
  }

  async function handleImport() {
    try {
      const res = await importMaterials(importText);
      setImportText('');
      setError(
        res.data.errors.length
          ? `导入 ${res.data.imported} 条，${res.data.errors.length} 条失败`
          : `成功导入 ${res.data.imported} 条`,
      );
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除该材料？')) return;
    try {
      await deleteMaterial(id);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  async function handleQrcode(id: string) {
    try {
      const res = await getMaterialQrcode(id);
      setQrInfo(`${res.data.code}: ${res.data.qrcodeUrl}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '二维码获取失败');
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看材料</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">材料管理</h1>
            <p className="text-sm text-muted-foreground">
              材料主数据、分类、库存预警与导入导出
            </p>
          </div>
          <div className="flex gap-2">
            {canExport ? (
              <Button variant="ghost" onClick={() => void exportMaterials({ q })}>
                导出
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ['list', '材料列表'],
              ['alerts', '库存预警'],
              ['categories', '分类管理'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={tab === key ? 'primary' : 'ghost'}
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {qrInfo ? (
          <Card className="p-3 text-sm text-muted-foreground">{qrInfo}</Card>
        ) : null}

        {tab === 'list' ? (
          <Card className="p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              <Input
                placeholder="搜索编号/名称/规格/储存位置"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="max-w-xs"
              />
              <select
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
              >
                <option value="">全部专业</option>
                {Object.entries(MATERIAL_DISCIPLINE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
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
              <select
                className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">全部分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => void loadList()}>搜索</Button>
            </div>

            {canCreate ? (
              <form
                className="mb-6 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2"
                onSubmit={handleCreateMaterial}
              >
                <h2 className="md:col-span-2 text-sm font-medium">新增材料</h2>
                <Input
                  placeholder="编号"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  required
                />
                <Input
                  placeholder="名称"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="规格"
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                />
                <Input
                  placeholder="单位"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  required
                />
                <select
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                  value={form.projectId}
                  onChange={(e) =>
                    setForm({ ...form, projectId: e.target.value })
                  }
                  required
                >
                  <option value="">归属项目</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="储存位置（如 杜阿拉仓-A区-3号架）"
                  value={form.storageLocation}
                  onChange={(e) =>
                    setForm({ ...form, storageLocation: e.target.value })
                  }
                />
                <select
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                  value={form.categoryId}
                  onChange={(e) =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                  required
                >
                  <option value="">选择分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}（
                      {MATERIAL_DISCIPLINE_LABEL[c.discipline] ?? c.discipline}
                      ）
                    </option>
                  ))}
                </select>
                <Input
                  placeholder="最低库存"
                  type="number"
                  value={form.minStock}
                  onChange={(e) =>
                    setForm({ ...form, minStock: e.target.value })
                  }
                />
                <Input
                  placeholder="采购价"
                  type="number"
                  value={form.priceAmount}
                  onChange={(e) =>
                    setForm({ ...form, priceAmount: e.target.value })
                  }
                />
                <Button type="submit">保存</Button>
              </form>
            ) : null}

            {canImport ? (
              <div className="mb-6 space-y-2">
                <h2 className="text-sm font-medium">CSV 导入</h2>
                <textarea
                  className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm"
                  placeholder="code,name,unit,categoryCode,projectCode,storageLocation..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <Button variant="ghost" onClick={() => void handleImport()}>
                  导入
                </Button>
              </div>
            ) : null}

            {loading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3">编号</th>
                      <th className="py-2 pr-3">名称</th>
                      <th className="py-2 pr-3">项目</th>
                      <th className="py-2 pr-3">专业</th>
                      <th className="py-2 pr-3">储存位置</th>
                      <th className="py-2 pr-3">分类</th>
                      <th className="py-2 pr-3">库存</th>
                      <th className="py-2 pr-3">最低价</th>
                      <th className="py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((item) => (
                      <tr key={item.id} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-medium">{item.code}</td>
                        <td className="py-2 pr-3">{item.name}</td>
                        <td className="py-2 pr-3">{item.project?.name ?? '—'}</td>
                        <td className="py-2 pr-3">
                          {item.category?.discipline
                            ? MATERIAL_DISCIPLINE_LABEL[item.category.discipline] ??
                              item.category.discipline
                            : '—'}
                        </td>
                        <td className="py-2 pr-3">
                          {item.storageLocation ?? '—'}
                        </td>
                        <td className="py-2 pr-3">{item.category?.name ?? '—'}</td>
                        <td className="py-2 pr-3">
                          {item.stock} {item.unit}
                        </td>
                        <td className="py-2 pr-3">
                          {item.latestPrice
                            ? `${item.latestPrice.amount} ${item.latestPrice.currency}`
                            : '—'}
                        </td>
                        <td className="py-2">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              className="h-8 px-2"
                              onClick={() => void handleQrcode(item.id)}
                            >
                              二维码
                            </Button>
                            {canDelete ? (
                              <Button
                                variant="ghost"
                                className="h-8 px-2 text-destructive"
                                onClick={() => void handleDelete(item.id)}
                              >
                                删除
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-sm text-muted-foreground">共 {total} 条</p>
              </div>
            )}
          </Card>
        ) : null}

        {tab === 'alerts' ? (
          <Card className="p-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无库存预警</p>
            ) : (
              <ul className="space-y-2">
                {alerts.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      'rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm',
                    )}
                  >
                    <span className="font-medium">{item.code}</span> {item.name}
                    <span className="ml-2 text-muted-foreground">
                      库存 {item.stock}/{item.minStock} {item.unit}（缺{' '}
                      {item.gap}）
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {tab === 'categories' ? (
          <Card className="p-4">
            {canManageCategory ? (
              <form
                className="mb-4 grid gap-2 md:grid-cols-4"
                onSubmit={handleCreateCategory}
              >
                <Input
                  placeholder="分类编号"
                  value={categoryForm.code}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, code: e.target.value })
                  }
                  required
                />
                <Input
                  placeholder="分类名称"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  required
                />
                <select
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                  value={categoryForm.discipline}
                  onChange={(e) =>
                    setCategoryForm({
                      ...categoryForm,
                      discipline: e.target.value,
                    })
                  }
                  required
                >
                  {Object.entries(MATERIAL_DISCIPLINE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}团队
                    </option>
                  ))}
                </select>
                <Button type="submit">新增分类</Button>
              </form>
            ) : null}
            <ul className="space-y-2 text-sm">
              {categories.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-border px-3 py-2"
                >
                  <span className="font-medium">{c.code}</span> — {c.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {MATERIAL_DISCIPLINE_LABEL[c.discipline] ?? c.discipline}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
