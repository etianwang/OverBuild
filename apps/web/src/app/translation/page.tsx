'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createGlossaryTerm,
  deleteGlossaryTerm,
  GlossaryTermItem,
  hasPermission,
  listGlossaryTerms,
  listTranslationTasks,
  submitManualTranslation,
  TRANSLATION_STATUS_LABEL,
  TranslationTaskItem,
  triggerAutoTranslate,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function TranslationPage() {
  const user = useAuthStore((s) => s.user);
  const [tasks, setTasks] = useState<TranslationTaskItem[]>([]);
  const [glossary, setGlossary] = useState<GlossaryTermItem[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<TranslationTaskItem | null>(null);
  const [manualJson, setManualJson] = useState('{\n  "title": ""\n}');
  const [termForm, setTermForm] = useState({
    source: '',
    zh: '',
    fr: '',
    en: '',
    category: '',
  });

  const canReadTasks = hasPermission(user, 'translation.task.read');
  const canAuto = hasPermission(user, 'translation.auto');
  const canManual = hasPermission(user, 'translation.manual');
  const canGlossaryRead = hasPermission(user, 'translation.glossary.read');
  const canGlossaryManage = hasPermission(user, 'translation.glossary.manage');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const requests: Promise<void>[] = [];
      if (canReadTasks) {
        requests.push(
          listTranslationTasks({ q: q || undefined }).then((res) => {
            setTasks(res.data.list);
            setTaskTotal(res.data.total);
          }),
        );
      }
      if (canGlossaryRead) {
        requests.push(
          listGlossaryTerms({ q: q || undefined }).then((res) => {
            setGlossary(res.data.list);
          }),
        );
      }
      await Promise.all(requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canReadTasks && !canGlossaryRead) {
      setLoading(false);
      return;
    }
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canReadTasks, canGlossaryRead]);

  if (!canReadTasks && !canGlossaryRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看翻译</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">翻译管理</h1>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="搜索任务、术语..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <Button variant="ghost" onClick={() => void loadData()}>
            搜索
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {canReadTasks && (
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-3 font-medium">
                翻译任务 ({taskTotal})
              </div>
              {loading ? (
                <div className="p-6 text-muted-foreground">加载中...</div>
              ) : (
                <div className="divide-y divide-border">
                  {tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className="w-full px-4 py-3 text-left text-sm hover:bg-muted/50"
                      onClick={() => {
                        setSelected(task);
                        setManualJson(
                          JSON.stringify(
                            task.preferredContent ?? { title: '' },
                            null,
                            2,
                          ),
                        );
                      }}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{task.code}</span>
                        <span className="text-muted-foreground">
                          {TRANSLATION_STATUS_LABEL[task.status] ?? task.status}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        {task.sourceType} · {task.sourceLang} → {task.targetLang}
                      </div>
                      {task.preferredContent && (
                        <div className="truncate text-xs">
                          {Object.values(task.preferredContent).join(' / ')}
                        </div>
                      )}
                    </button>
                  ))}
                  {!tasks.length && (
                    <div className="px-4 py-6 text-center text-muted-foreground">
                      暂无任务
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          <div className="space-y-4">
            {selected && canReadTasks && (
              <Card className="space-y-3 p-4 text-sm">
                <h2 className="font-medium">{selected.code}</h2>
                <p>
                  来源：{selected.sourceType} / {selected.sourceId}
                </p>
                <p>
                  优先展示：
                  {selected.preferredSource === 'manual'
                    ? '人工译文'
                    : selected.preferredSource === 'auto'
                      ? '自动译文'
                      : '无'}
                </p>
                {selected.preferredContent && (
                  <pre className="overflow-auto rounded-lg bg-muted p-2 text-xs">
                    {JSON.stringify(selected.preferredContent, null, 2)}
                  </pre>
                )}
                <div className="flex flex-wrap gap-2">
                  {canAuto && selected.status !== 'completed' && (
                    <Button
                      variant="ghost"
                      onClick={async () => {
                        await triggerAutoTranslate(selected.id);
                        setTimeout(() => void loadData(), 800);
                      }}
                    >
                      自动翻译
                    </Button>
                  )}
                </div>
                {canManual && (
                  <form
                    className="space-y-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const content = JSON.parse(manualJson) as Record<
                        string,
                        string
                      >;
                      await submitManualTranslation(selected.id, content);
                      await loadData();
                    }}
                  >
                    <label className="text-xs text-muted-foreground">
                      人工译文 JSON
                    </label>
                    <textarea
                      className="min-h-28 w-full rounded-lg border border-border bg-background p-2 font-mono text-xs"
                      value={manualJson}
                      onChange={(e) => setManualJson(e.target.value)}
                    />
                    <Button type="submit">提交人工译文</Button>
                  </form>
                )}
              </Card>
            )}

            {canGlossaryRead && (
              <Card className="overflow-hidden">
                <div className="border-b border-border px-4 py-3 font-medium">
                  术语库
                </div>
                <div className="divide-y divide-border">
                  {glossary.map((term) => (
                    <div
                      key={term.id}
                      className="flex items-start justify-between gap-2 px-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{term.source}</div>
                        <div className="text-muted-foreground">
                          {term.zh} / {term.fr} / {term.en}
                        </div>
                      </div>
                      {canGlossaryManage && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            deleteGlossaryTerm(term.id).then(() => loadData())
                          }
                        >
                          删除
                        </Button>
                      )}
                    </div>
                  ))}
                  {!glossary.length && (
                    <div className="px-4 py-6 text-center text-muted-foreground">
                      暂无术语
                    </div>
                  )}
                </div>
              </Card>
            )}

            {canGlossaryManage && (
              <Card className="p-4">
                <h2 className="mb-3 font-medium">新增术语</h2>
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await createGlossaryTerm({
                      source: termForm.source,
                      zh: termForm.zh || undefined,
                      fr: termForm.fr || undefined,
                      en: termForm.en || undefined,
                      category: termForm.category || undefined,
                    });
                    setTermForm({
                      source: '',
                      zh: '',
                      fr: '',
                      en: '',
                      category: '',
                    });
                    await loadData();
                  }}
                >
                  <Input
                    placeholder="原文"
                    value={termForm.source}
                    onChange={(e) =>
                      setTermForm({ ...termForm, source: e.target.value })
                    }
                    required
                  />
                  <Input
                    placeholder="中文"
                    value={termForm.zh}
                    onChange={(e) =>
                      setTermForm({ ...termForm, zh: e.target.value })
                    }
                  />
                  <Input
                    placeholder="法语"
                    value={termForm.fr}
                    onChange={(e) =>
                      setTermForm({ ...termForm, fr: e.target.value })
                    }
                  />
                  <Input
                    placeholder="英语"
                    value={termForm.en}
                    onChange={(e) =>
                      setTermForm({ ...termForm, en: e.target.value })
                    }
                  />
                  <Button type="submit">添加</Button>
                </form>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
