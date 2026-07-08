'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button, Card, Input } from '@/components/ui/primitives';
import {
  CONTRACT_STATUS_LABEL,
  CONTRACT_TYPE_LABEL,
  ContractItem,
  createContract,
  exportContracts,
  hasPermission,
  listContracts,
  listProjects,
  ProjectItem,
  submitContract,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function ContractsPage() {
  const user = useAuthStore((s) => s.user);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selected, setSelected] = useState<ContractItem | null>(null);

  const [form, setForm] = useState({
    code: '',
    name: '',
    nameFr: '',
    projectId: '',
    partyA: '',
    partyB: '',
    amount: '',
    currency: 'CNY',
    type: 'construction',
  });

  const canRead = hasPermission(user, 'contract.read');
  const canCreate = hasPermission(user, 'contract.create');
  const canSubmit = hasPermission(user, 'contract.submit');
  const canExport = hasPermission(user, 'contract.export');

  async function loadList() {
    setLoading(true);
    try {
      const res = await listContracts({
        q: q || undefined,
        projectId: projectId || undefined,
      });
      setContracts(res.data.list);
      setTotal(res.data.total);
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
    listProjects({ page: 1, pageSize: 100 })
      .then((res) => setProjects(res.data.list))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createContract({
        code: form.code,
        name: form.name,
        nameFr: form.nameFr || undefined,
        projectId: form.projectId,
        partyA: form.partyA,
        partyB: form.partyB,
        amount: { amount: Number(form.amount), currency: form.currency },
        type: form.type,
      });
      setForm({
        code: '',
        name: '',
        nameFr: '',
        projectId: '',
        partyA: '',
        partyB: '',
        amount: '',
        currency: 'CNY',
        type: 'construction',
      });
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  async function handleSubmit(id: string) {
    try {
      await submitContract(id);
      await loadList();
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交审批失败');
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看合同</Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">合同管理</h1>
          {canExport && (
            <Button
              variant="ghost"
              onClick={() => exportContracts({ q, projectId })}
            >
              导出
            </Button>
          )}
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="搜索编号、名称、甲乙方..."
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
          <Button variant="ghost" onClick={() => void loadList()}>
            搜索
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3 font-medium">
              合同列表 ({total})
            </div>
            {loading ? (
              <div className="p-6 text-muted-foreground">加载中...</div>
            ) : (
              <div className="divide-y divide-border">
                {contracts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full px-4 py-3 text-left text-sm hover:bg-muted/50"
                    onClick={() => setSelected(item)}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{item.code}</span>
                      <span className="text-muted-foreground">
                        {CONTRACT_STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </div>
                    <div>{item.name}</div>
                    <div className="text-muted-foreground">
                      {item.project?.name} · {CONTRACT_TYPE_LABEL[item.type]}
                    </div>
                    <div>
                      {item.amount.amount.toLocaleString()} {item.amount.currency}
                    </div>
                  </button>
                ))}
                {!contracts.length && (
                  <div className="px-4 py-6 text-center text-muted-foreground">
                    暂无合同
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            {selected && (
              <Card className="p-4 text-sm">
                <h2 className="mb-2 font-medium">{selected.name}</h2>
                <p>甲方：{selected.partyA}</p>
                <p>乙方：{selected.partyB}</p>
                <p>
                  合同额：{selected.amount.amount} {selected.amount.currency}
                </p>
                <p>
                  已回款：{selected.collectedAmount.amount}{' '}
                  {selected.collectedAmount.currency}
                </p>
                {selected.status === 'draft' && canSubmit && (
                  <Button className="mt-3" onClick={() => void handleSubmit(selected.id)}>
                    提交签订审批
                  </Button>
                )}
              </Card>
            )}

            {canCreate && (
              <Card className="p-4">
                <h2 className="mb-3 font-medium">新建合同</h2>
                <form onSubmit={handleCreate} className="space-y-3">
                  <Input
                    placeholder="合同编号"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="合同名称"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="法语名称（可选）"
                    value={form.nameFr}
                    onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                  />
                  <select
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    value={form.projectId}
                    onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                    required
                  >
                    <option value="">选择项目</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="甲方"
                    value={form.partyA}
                    onChange={(e) => setForm({ ...form, partyA: e.target.value })}
                    required
                  />
                  <Input
                    placeholder="乙方"
                    value={form.partyB}
                    onChange={(e) => setForm({ ...form, partyB: e.target.value })}
                    required
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="合同金额"
                      type="number"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      required
                    />
                    <Input
                      placeholder="币种"
                      value={form.currency}
                      onChange={(e) => setForm({ ...form, currency: e.target.value })}
                      className="w-24"
                    />
                  </div>
                  <select
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="construction">施工合同</option>
                    <option value="procurement">采购合同</option>
                    <option value="service">服务合同</option>
                    <option value="other">其他</option>
                  </select>
                  <Button type="submit">创建合同</Button>
                </form>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
