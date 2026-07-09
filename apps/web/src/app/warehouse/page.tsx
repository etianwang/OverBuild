'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  confirmInbound,
  confirmOutbound,
  createInbound,
  createOutbound,
  createWarehouse,
  hasPermission,
  listInbounds,
  listMaterials,
  listOutbounds,
  listProjects,
  listStockBalances,
  listWarehouses,
  MaterialItem,
  ProjectItem,
  StockBalanceItem,
  StockDocumentItem,
  WarehouseItem,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type TabKey = 'warehouses' | 'inbound' | 'outbound' | 'balances';

const INBOUND_TYPE_LABEL: Record<string, string> = {
  purchase: '采购入库',
  return: '退库',
  adjustment: '调整',
};

const OUTBOUND_TYPE_LABEL: Record<string, string> = {
  usage: '领用出库',
  transfer: '调拨',
};

export default function WarehousePage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabKey>('balances');
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [inbounds, setInbounds] = useState<StockDocumentItem[]>([]);
  const [outbounds, setOutbounds] = useState<StockDocumentItem[]>([]);
  const [balances, setBalances] = useState<StockBalanceItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');

  const [warehouseForm, setWarehouseForm] = useState({
    code: '',
    name: '',
    projectId: '',
    address: '',
  });
  const [inboundForm, setInboundForm] = useState({
    code: '',
    warehouseId: '',
    projectId: '',
    materialId: '',
    quantity: '',
    unit: '',
    type: 'purchase',
  });
  const [outboundForm, setOutboundForm] = useState({
    code: '',
    warehouseId: '',
    projectId: '',
    materialId: '',
    quantity: '',
    unit: '',
    type: 'usage',
  });

  const canRead = hasPermission(user, 'warehouse.read');
  const canCreateWarehouse = hasPermission(user, 'warehouse.create');
  const canReadInbound = hasPermission(user, 'warehouse.inbound.read');
  const canCreateInbound = hasPermission(user, 'warehouse.inbound.create');
  const canConfirmInbound = hasPermission(user, 'warehouse.inbound.confirm');
  const canReadOutbound = hasPermission(user, 'warehouse.outbound.read');
  const canCreateOutbound = hasPermission(user, 'warehouse.outbound.create');
  const canConfirmOutbound = hasPermission(user, 'warehouse.outbound.confirm');
  const canReadBalance = hasPermission(user, 'warehouse.balance.read');

  const canAccess =
    canRead ||
    canReadInbound ||
    canReadOutbound ||
    canReadBalance;

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'warehouses' && canRead) {
        const res = await listWarehouses({ projectId: projectId || undefined });
        setWarehouses(res.data.list);
        setTotal(res.data.total);
      } else if (tab === 'inbound' && canReadInbound) {
        const res = await listInbounds({ projectId: projectId || undefined });
        setInbounds(res.data.list);
        setTotal(res.data.total);
      } else if (tab === 'outbound' && canReadOutbound) {
        const res = await listOutbounds({ projectId: projectId || undefined });
        setOutbounds(res.data.list);
        setTotal(res.data.total);
      } else if (tab === 'balances' && canReadBalance) {
        const res = await listStockBalances({ projectId: projectId || undefined });
        setBalances(res.data.list);
        setTotal(res.data.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return;
    }
    void loadData();
    listProjects({ page: 1, pageSize: 100 })
      .then((res) => setProjects(res.data.list))
      .catch(() => undefined);
    listWarehouses({ page: 1, pageSize: 100 })
      .then((res) => setWarehouses(res.data.list))
      .catch(() => undefined);
    listMaterials({ page: 1, pageSize: 200 })
      .then((res) => setMaterials(res.data.list))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, tab]);

  async function handleCreateWarehouse(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createWarehouse(warehouseForm);
      setWarehouseForm({ code: '', name: '', projectId: '', address: '' });
      setTab('warehouses');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建仓库失败');
    }
  }

  async function handleCreateInbound(e: React.FormEvent) {
    e.preventDefault();
    const material = materials.find((m) => m.id === inboundForm.materialId);
    try {
      await createInbound({
        code: inboundForm.code,
        warehouseId: inboundForm.warehouseId,
        projectId: inboundForm.projectId,
        type: inboundForm.type,
        items: [
          {
            materialId: inboundForm.materialId,
            quantity: Number(inboundForm.quantity),
            unit: inboundForm.unit || material?.unit || '个',
          },
        ],
      });
      setInboundForm({
        code: '',
        warehouseId: '',
        projectId: '',
        materialId: '',
        quantity: '',
        unit: '',
        type: 'purchase',
      });
      setTab('inbound');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建入库单失败');
    }
  }

  async function handleCreateOutbound(e: React.FormEvent) {
    e.preventDefault();
    const material = materials.find((m) => m.id === outboundForm.materialId);
    try {
      await createOutbound({
        code: outboundForm.code,
        warehouseId: outboundForm.warehouseId,
        projectId: outboundForm.projectId,
        type: outboundForm.type,
        items: [
          {
            materialId: outboundForm.materialId,
            quantity: Number(outboundForm.quantity),
            unit: outboundForm.unit || material?.unit || '个',
          },
        ],
      });
      setOutboundForm({
        code: '',
        warehouseId: '',
        projectId: '',
        materialId: '',
        quantity: '',
        unit: '',
        type: 'usage',
      });
      setTab('outbound');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建出库单失败');
    }
  }

  if (!canAccess) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看仓库模块</Card>
      </AppShell>
    );
  }

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'balances', label: '库存余额', show: canReadBalance },
    { key: 'inbound', label: '入库', show: canReadInbound },
    { key: 'outbound', label: '出库', show: canReadOutbound },
    { key: 'warehouses', label: '仓库', show: canRead },
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">仓库库存</h1>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </Card>
        )}

        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm',
                  tab === t.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {t.label}
              </button>
            ))}
        </div>

        <div className="flex flex-wrap gap-2">
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
            刷新
          </Button>
        </div>

        {loading ? (
          <Card className="p-6 text-muted-foreground">加载中...</Card>
        ) : (
          <>
            {tab === 'balances' && (
              <Card className="overflow-hidden">
                <div className="border-b border-border px-4 py-3 font-medium">
                  库存余额 ({total})
                </div>
                <div className="divide-y divide-border">
                  {balances.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm">
                      <div className="font-medium">
                        {item.material?.code} · {item.material?.name}
                      </div>
                      <div className="text-muted-foreground">
                        {item.warehouse?.name} · {item.project?.name}
                      </div>
                      <div>
                        {item.quantity} {item.material?.unit}
                      </div>
                    </div>
                  ))}
                  {!balances.length && (
                    <div className="px-4 py-6 text-center text-muted-foreground">暂无库存</div>
                  )}
                </div>
              </Card>
            )}

            {tab === 'inbound' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3 font-medium">
                    入库单 ({total})
                  </div>
                  <div className="divide-y divide-border">
                    {inbounds.map((item) => (
                      <div key={item.id} className="px-4 py-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.code}</span>
                          <span className="text-muted-foreground">{item.status}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {INBOUND_TYPE_LABEL[item.type] ?? item.type} · {item.warehouse?.name}
                        </div>
                        {item.status === 'draft' && canConfirmInbound && (
                          <Button
                            className="mt-2"
                            onClick={async () => {
                              await confirmInbound(item.id);
                              await loadData();
                            }}
                          >
                            确认入库
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                {canCreateInbound && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">新建入库单</h2>
                    <form onSubmit={handleCreateInbound} className="space-y-3">
                      <Input
                        placeholder="入库单号"
                        value={inboundForm.code}
                        onChange={(e) =>
                          setInboundForm({ ...inboundForm, code: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={inboundForm.warehouseId}
                        onChange={(e) =>
                          setInboundForm({ ...inboundForm, warehouseId: e.target.value })
                        }
                        required
                      >
                        <option value="">选择仓库</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={inboundForm.projectId}
                        onChange={(e) =>
                          setInboundForm({ ...inboundForm, projectId: e.target.value })
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
                        value={inboundForm.materialId}
                        onChange={(e) => {
                          const mat = materials.find((m) => m.id === e.target.value);
                          setInboundForm({
                            ...inboundForm,
                            materialId: e.target.value,
                            unit: mat?.unit ?? inboundForm.unit,
                          });
                        }}
                        required
                      >
                        <option value="">选择材料</option>
                        {materials
                          .filter(
                            (m) =>
                              !inboundForm.projectId ||
                              m.projectId === inboundForm.projectId,
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} - {m.name}
                            </option>
                          ))}
                      </select>
                      <Input
                        placeholder="数量"
                        type="number"
                        value={inboundForm.quantity}
                        onChange={(e) =>
                          setInboundForm({ ...inboundForm, quantity: e.target.value })
                        }
                        required
                      />
                      <Button type="submit">创建入库单</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'outbound' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3 font-medium">
                    出库单 ({total})
                  </div>
                  <div className="divide-y divide-border">
                    {outbounds.map((item) => (
                      <div key={item.id} className="px-4 py-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">{item.code}</span>
                          <span className="text-muted-foreground">{item.status}</span>
                        </div>
                        <div className="text-muted-foreground">
                          {OUTBOUND_TYPE_LABEL[item.type] ?? item.type} · {item.project?.name}
                        </div>
                        {item.status === 'draft' && canConfirmOutbound && (
                          <Button
                            className="mt-2"
                            onClick={async () => {
                              await confirmOutbound(item.id);
                              await loadData();
                            }}
                          >
                            确认出库
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>

                {canCreateOutbound && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">新建出库单</h2>
                    <form onSubmit={handleCreateOutbound} className="space-y-3">
                      <Input
                        placeholder="出库单号"
                        value={outboundForm.code}
                        onChange={(e) =>
                          setOutboundForm({ ...outboundForm, code: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={outboundForm.projectId}
                        onChange={(e) =>
                          setOutboundForm({ ...outboundForm, projectId: e.target.value })
                        }
                        required
                      >
                        <option value="">归属项目 *</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={outboundForm.warehouseId}
                        onChange={(e) =>
                          setOutboundForm({ ...outboundForm, warehouseId: e.target.value })
                        }
                        required
                      >
                        <option value="">选择仓库</option>
                        {warehouses.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={outboundForm.materialId}
                        onChange={(e) => {
                          const mat = materials.find((m) => m.id === e.target.value);
                          setOutboundForm({
                            ...outboundForm,
                            materialId: e.target.value,
                            unit: mat?.unit ?? outboundForm.unit,
                          });
                        }}
                        required
                      >
                        <option value="">选择材料</option>
                        {materials
                          .filter(
                            (m) =>
                              !outboundForm.projectId ||
                              m.projectId === outboundForm.projectId,
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} - {m.name}
                            </option>
                          ))}
                      </select>
                      <Input
                        placeholder="数量"
                        type="number"
                        value={outboundForm.quantity}
                        onChange={(e) =>
                          setOutboundForm({ ...outboundForm, quantity: e.target.value })
                        }
                        required
                      />
                      <Button type="submit">创建出库单</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'warehouses' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3 font-medium">
                    仓库列表 ({total})
                  </div>
                  <div className="divide-y divide-border">
                    {warehouses.map((item) => (
                      <div key={item.id} className="px-4 py-3 text-sm">
                        <div className="font-medium">
                          {item.code} · {item.name}
                        </div>
                        <div className="text-muted-foreground">{item.project?.name}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {canCreateWarehouse && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">新增仓库</h2>
                    <form onSubmit={handleCreateWarehouse} className="space-y-3">
                      <Input
                        placeholder="仓库编号"
                        value={warehouseForm.code}
                        onChange={(e) =>
                          setWarehouseForm({ ...warehouseForm, code: e.target.value })
                        }
                        required
                      />
                      <Input
                        placeholder="名称"
                        value={warehouseForm.name}
                        onChange={(e) =>
                          setWarehouseForm({ ...warehouseForm, name: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={warehouseForm.projectId}
                        onChange={(e) =>
                          setWarehouseForm({ ...warehouseForm, projectId: e.target.value })
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
                      <Input
                        placeholder="地址"
                        value={warehouseForm.address}
                        onChange={(e) =>
                          setWarehouseForm({ ...warehouseForm, address: e.target.value })
                        }
                      />
                      <Button type="submit">保存</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
