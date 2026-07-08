'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button, Card, Input } from '@/components/ui/primitives';
import {
  createDocument,
  createDocumentCategory,
  DocumentCategoryItem,
  DocumentItem,
  hasPermission,
  listDocumentCategories,
  listDocuments,
  listProjects,
  openDocumentPreview,
  ProjectItem,
  submitDocumentTranslate,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function DocumentsPage() {
  const user = useAuthStore((s) => s.user);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selected, setSelected] = useState<DocumentItem | null>(null);

  const [uploadForm, setUploadForm] = useState({
    code: '',
    title: '',
    titleFr: '',
    projectId: '',
    categoryId: '',
    tags: '',
    file: null as File | null,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    nameFr: '',
    projectId: '',
  });

  const canRead = hasPermission(user, 'document.read');
  const canCreate = hasPermission(user, 'document.create');
  const canTranslate = hasPermission(user, 'document.translate');
  const canManageCategory = hasPermission(user, 'document.category.create');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [docRes, catRes, projRes] = await Promise.all([
        listDocuments({ q: q || undefined, projectId: projectId || undefined }),
        listDocumentCategories(projectId || undefined),
        listProjects({ page: 1, pageSize: 100 }),
      ]);
      setDocuments(docRes.data.list);
      setTotal(docRes.data.total);
      setCategories(catRes.data.list);
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
        <Card className="p-6">无权限查看文档</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">文档管理</h1>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="搜索编号、标题、标签..."
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
              文档列表 ({total})
            </div>
            {loading ? (
              <div className="p-6 text-muted-foreground">加载中...</div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-muted/50"
                    onClick={() => setSelected(item)}
                  >
                    <div className="font-medium">{item.code}</div>
                    <div>{item.title}</div>
                    <div className="text-muted-foreground">
                      {item.project?.name} · v{item.currentVersion}
                      {item.tags.length ? ` · ${item.tags.join(', ')}` : ''}
                    </div>
                  </button>
                ))}
                {!documents.length && (
                  <div className="px-4 py-6 text-center text-muted-foreground">
                    暂无文档
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            {selected && (
              <Card className="p-4 text-sm">
                <h2 className="mb-2 font-medium">{selected.title}</h2>
                <p>项目：{selected.project?.name}</p>
                <p>分类：{selected.category?.name ?? '未分类'}</p>
                <p>当前版本：v{selected.currentVersion}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    onClick={() =>
                      openDocumentPreview(
                        selected.id,
                        selected.currentVersion,
                      ).catch((err) =>
                        setError(err instanceof Error ? err.message : '预览失败'),
                      )
                    }
                  >
                    预览
                  </Button>
                  {canTranslate && (
                    <Button
                      variant="ghost"
                      onClick={() =>
                        submitDocumentTranslate(selected.id, {
                          sourceLang: 'zh',
                          targetLang: 'fr',
                        }).then(() => loadData())
                      }
                    >
                      提交法语翻译
                    </Button>
                  )}
                </div>
              </Card>
            )}

            {canCreate && (
              <Card className="p-4">
                <h2 className="mb-3 font-medium">上传文档</h2>
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!uploadForm.file) {
                      setError('请选择文件');
                      return;
                    }
                    await createDocument(
                      {
                        code: uploadForm.code,
                        title: uploadForm.title,
                        titleFr: uploadForm.titleFr || undefined,
                        projectId: uploadForm.projectId,
                        categoryId: uploadForm.categoryId || undefined,
                        tags: uploadForm.tags
                          ? uploadForm.tags.split(',').map((t) => t.trim())
                          : undefined,
                      },
                      uploadForm.file,
                    );
                    setUploadForm({
                      code: '',
                      title: '',
                      titleFr: '',
                      projectId: '',
                      categoryId: '',
                      tags: '',
                      file: null,
                    });
                    await loadData();
                  }}
                >
                  <Input
                    placeholder="文档编号"
                    value={uploadForm.code}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, code: e.target.value })
                    }
                    required
                  />
                  <Input
                    placeholder="标题"
                    value={uploadForm.title}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, title: e.target.value })
                    }
                    required
                  />
                  <select
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    value={uploadForm.projectId}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, projectId: e.target.value })
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
                    value={uploadForm.categoryId}
                    onChange={(e) =>
                      setUploadForm({
                        ...uploadForm,
                        categoryId: e.target.value,
                      })
                    }
                  >
                    <option value="">选择分类</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="file"
                    onChange={(e) =>
                      setUploadForm({
                        ...uploadForm,
                        file: e.target.files?.[0] ?? null,
                      })
                    }
                    required
                  />
                  <Button type="submit">上传</Button>
                </form>
              </Card>
            )}

            {canManageCategory && (
              <Card className="p-4">
                <h2 className="mb-3 font-medium">新增分类</h2>
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await createDocumentCategory({
                      name: categoryForm.name,
                      nameFr: categoryForm.nameFr || undefined,
                      projectId: categoryForm.projectId || undefined,
                    });
                    setCategoryForm({ name: '', nameFr: '', projectId: '' });
                    await loadData();
                  }}
                >
                  <Input
                    placeholder="分类名称"
                    value={categoryForm.name}
                    onChange={(e) =>
                      setCategoryForm({ ...categoryForm, name: e.target.value })
                    }
                    required
                  />
                  <Button type="submit">创建分类</Button>
                </form>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
