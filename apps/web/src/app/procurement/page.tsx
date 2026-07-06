'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button, Card, Input } from '@/components/ui/primitives';
import {
  createPurchaseOrder,
  createPurchaseRequest,
  createQuotation,
  createSupplier,
  exportPurchaseOrders,
  exportPurchaseRequests,
  exportSuppliers,
  hasPermission,
  listMaterials,
  listPurchaseOrders,
  listPurchaseRequests,
  listProjects,
  listQuotations,
  listSuppliers,
  MaterialItem,
  ProjectItem,
  PURCHASE_ORDER_STATUS_LABEL,
  PURCHASE_REQUEST_STATUS_LABEL,
  PurchaseOrderItem,
  PurchaseRequestItem,
  QuotationItem,
  receivePurchaseOrder,
  submitPurchaseRequest,
  SupplierItem,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type TabKey = 'requests' | 'orders' | 'suppliers' | 'quotations';

export default function ProcurementPage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabKey>('requests');
  const [requests, setRequests] = useState<PurchaseRequestItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [projectId, setProjectId] = useState('');

  const [requestForm, setRequestForm] = useState({
    code: '',
    projectId: '',
    materialId: '',
    quantity: '',
    unit: '',
    remark: '',
  });
  const [orderForm, setOrderForm] = useState({
    code: '',
    projectId: '',
    supplierId: '',
    requestId: '',
    materialId: '',
    quantity: '',
    unit: '',
    unitPrice: '',
    currency: 'CNY',
  });
  const [supplierForm, setSupplierForm] = useState({
    code: '',
    name: '',
    contact: '',
    phone: '',
  });
  const [quotationForm, setQuotationForm] = useState({
    code: '',
    supplierId: '',
    requestId: '',
    materialId: '',
    amount: '',
    currency: 'CNY',
  });

  const canReadRequest = hasPermission(user, 'procurement.request.read');
  const canCreateRequest = hasPermission(user, 'procurement.request.create');
  const canSubmitRequest = hasPermission(user, 'procurement.request.submit');
  const canExportRequest = hasPermission(user, 'procurement.request.export');
  const canReadOrder = hasPermission(user, 'procurement.order.read');
  const canCreateOrder = hasPermission(user, 'procurement.order.create');
  const canReceiveOrder = hasPermission(user, 'procurement.order.receive');
  const canExportOrder = hasPermission(user, 'procurement.order.export');
  const canReadSupplier = hasPermission(user, 'procurement.supplier.read');
  const canCreateSupplier = hasPermission(user, 'procurement.supplier.create');
  const canExportSupplier = hasPermission(user, 'procurement.supplier.export');
  const canReadQuotation = hasPermission(user, 'procurement.quotation.read');
  const canCreateQuotation = hasPermission(user, 'procurement.quotation.create');

  const canRead =
    canReadRequest || canReadOrder || canReadSupplier || canReadQuotation;

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'requests' && canReadRequest) {
        const res = await listPurchaseRequests({
          q: q || undefined,
          projectId: projectId || undefined,
        });
        setRequests(res.data.list);
        setTotal(res.data.total);
      } else if (tab === 'orders' && canReadOrder) {
        const res = await listPurchaseOrders({
          q: q || undefined,
          projectId: projectId || undefined,
        });
        setOrders(res.data.list);
        setTotal(res.data.total);
      } else if (tab === 'suppliers' && canReadSupplier) {
        const res = await listSuppliers({ q: q || undefined });
        setSuppliers(res.data.list);
        setTotal(res.data.total);
      } else if (tab === 'quotations' && canReadQuotation) {
        const res = await listQuotations();
        setQuotations(res.data.list);
        setTotal(res.data.total);
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
    void loadData();
    listProjects({ page: 1, pageSize: 100 })
      .then((res) => setProjects(res.data.list))
      .catch(() => undefined);
    listMaterials({ page: 1, pageSize: 200 })
      .then((res) => setMaterials(res.data.list))
      .catch(() => undefined);
    if (canReadSupplier || canCreateOrder || canCreateQuotation) {
      listSuppliers({ page: 1, pageSize: 100 })
        .then((res) => setSuppliers(res.data.list))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, tab]);

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    const material = materials.find((m) => m.id === requestForm.materialId);
    try {
      await createPurchaseRequest({
        code: requestForm.code,
        projectId: requestForm.projectId,
        remark: requestForm.remark || undefined,
        items: [
          {
            materialId: requestForm.materialId,
            quantity: Number(requestForm.quantity),
            unit: requestForm.unit || material?.unit || '个',
          },
        ],
      });
      setRequestForm({
        code: '',
        projectId: '',
        materialId: '',
        quantity: '',
        unit: '',
        remark: '',
      });
      setTab('requests');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建申请失败');
    }
  }

  async function handleSubmitRequest(id: string) {
    try {
      await submitPurchaseRequest(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交审批失败');
    }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    const material = materials.find((m) => m.id === orderForm.materialId);
    try {
      await createPurchaseOrder({
        code: orderForm.code,
        projectId: orderForm.projectId,
        supplierId: orderForm.supplierId,
        requestId: orderForm.requestId || undefined,
        items: [
          {
            materialId: orderForm.materialId,
            quantity: Number(orderForm.quantity),
            unit: orderForm.unit || material?.unit || '个',
            unitPrice: {
              amount: Number(orderForm.unitPrice),
              currency: orderForm.currency,
            },
          },
        ],
      });
      setOrderForm({
        code: '',
        projectId: '',
        supplierId: '',
        requestId: '',
        materialId: '',
        quantity: '',
        unit: '',
        unitPrice: '',
        currency: 'CNY',
      });
      setTab('orders');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建订单失败');
    }
  }

  async function handleReceiveOrder(id: string) {
    try {
      await receivePurchaseOrder(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '到货确认失败');
    }
  }

  async function handleCreateSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createSupplier(supplierForm);
      setSupplierForm({ code: '', name: '', contact: '', phone: '' });
      setTab('suppliers');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建供应商失败');
    }
  }

  async function handleCreateQuotation(e: React.FormEvent) {
    e.preventDefault();
    try {
      await createQuotation({
        code: quotationForm.code,
        supplierId: quotationForm.supplierId,
        requestId: quotationForm.requestId || undefined,
        materialId: quotationForm.materialId || undefined,
        price: {
          amount: Number(quotationForm.amount),
          currency: quotationForm.currency,
        },
      });
      setQuotationForm({
        code: '',
        supplierId: '',
        requestId: '',
        materialId: '',
        amount: '',
        currency: 'CNY',
      });
      setTab('quotations');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建询价失败');
    }
  }

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看采购模块</Card>
      </AppShell>
    );
  }

  const tabs: { key: TabKey; label: string; show: boolean }[] = [
    { key: 'requests', label: '采购申请', show: canReadRequest },
    { key: 'orders', label: '采购订单', show: canReadOrder },
    { key: 'suppliers', label: '供应商', show: canReadSupplier },
    { key: 'quotations', label: '询价', show: canReadQuotation },
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">材料采购</h1>
          <div className="flex flex-wrap gap-2">
            {tab === 'requests' && canExportRequest && (
              <Button variant="ghost" onClick={() => exportPurchaseRequests({ q, projectId })}>
                导出申请
              </Button>
            )}
            {tab === 'orders' && canExportOrder && (
              <Button variant="ghost" onClick={() => exportPurchaseOrders({ q, projectId })}>
                导出订单
              </Button>
            )}
            {tab === 'suppliers' && canExportSupplier && (
              <Button variant="ghost" onClick={() => exportSuppliers(q)}>
                导出供应商
              </Button>
            )}
          </div>
        </div>

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

        {(tab === 'requests' || tab === 'orders') && (
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="搜索单号、供应商、物料..."
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
        )}

        {loading ? (
          <Card className="p-6 text-muted-foreground">加载中...</Card>
        ) : (
          <>
            {tab === 'requests' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3 font-medium">
                    申请列表 ({total})
                  </div>
                  <div className="divide-y divide-border">
                    {requests.map((item) => (
                      <div key={item.id} className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.code}</span>
                          <span className="text-muted-foreground">
                            {PURCHASE_REQUEST_STATUS_LABEL[item.status] ?? item.status}
                          </span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {item.project?.name} · {item.requester?.name}
                        </div>
                        <div className="mt-1">
                          {item.items?.map((line) => (
                            <span key={line.id} className="mr-2">
                              {line.material?.name} × {line.quantity}
                              {line.unit}
                            </span>
                          ))}
                        </div>
                        {item.status === 'draft' && canSubmitRequest && (
                          <Button
                            className="mt-2"
                            onClick={() => void handleSubmitRequest(item.id)}
                          >
                            提交审批
                          </Button>
                        )}
                      </div>
                    ))}
                    {!requests.length && (
                      <div className="px-4 py-6 text-center text-muted-foreground">暂无数据</div>
                    )}
                  </div>
                </Card>

                {canCreateRequest && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">新建采购申请</h2>
                    <form onSubmit={handleCreateRequest} className="space-y-3">
                      <Input
                        placeholder="申请单号"
                        value={requestForm.code}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, code: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={requestForm.projectId}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, projectId: e.target.value })
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
                        value={requestForm.materialId}
                        onChange={(e) => {
                          const mat = materials.find((m) => m.id === e.target.value);
                          setRequestForm({
                            ...requestForm,
                            materialId: e.target.value,
                            unit: mat?.unit ?? requestForm.unit,
                          });
                        }}
                        required
                      >
                        <option value="">选择材料</option>
                        {materials
                          .filter(
                            (m) =>
                              !requestForm.projectId ||
                              m.projectId === requestForm.projectId,
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} - {m.name}
                            </option>
                          ))}
                      </select>
                      <div className="flex gap-2">
                        <Input
                          placeholder="数量"
                          type="number"
                          value={requestForm.quantity}
                          onChange={(e) =>
                            setRequestForm({ ...requestForm, quantity: e.target.value })
                          }
                          required
                        />
                        <Input
                          placeholder="单位"
                          value={requestForm.unit}
                          onChange={(e) =>
                            setRequestForm({ ...requestForm, unit: e.target.value })
                          }
                          required
                        />
                      </div>
                      <Input
                        placeholder="备注"
                        value={requestForm.remark}
                        onChange={(e) =>
                          setRequestForm({ ...requestForm, remark: e.target.value })
                        }
                      />
                      <Button type="submit">创建申请</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'orders' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3 font-medium">
                    订单列表 ({total})
                  </div>
                  <div className="divide-y divide-border">
                    {orders.map((item) => (
                      <div key={item.id} className="px-4 py-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.code}</span>
                          <span className="text-muted-foreground">
                            {PURCHASE_ORDER_STATUS_LABEL[item.status] ?? item.status}
                          </span>
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          {item.project?.name} · {item.supplier?.name}
                        </div>
                        <div className="mt-1">
                          {item.totalAmount.amount} {item.totalAmount.currency}
                        </div>
                        {item.status === 'confirmed' && canReceiveOrder && (
                          <Button
                            className="mt-2"
                            onClick={() => void handleReceiveOrder(item.id)}
                          >
                            到货确认
                          </Button>
                        )}
                      </div>
                    ))}
                    {!orders.length && (
                      <div className="px-4 py-6 text-center text-muted-foreground">暂无数据</div>
                    )}
                  </div>
                </Card>

                {canCreateOrder && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">新建采购订单</h2>
                    <form onSubmit={handleCreateOrder} className="space-y-3">
                      <Input
                        placeholder="订单号"
                        value={orderForm.code}
                        onChange={(e) =>
                          setOrderForm({ ...orderForm, code: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={orderForm.projectId}
                        onChange={(e) =>
                          setOrderForm({ ...orderForm, projectId: e.target.value })
                        }
                        required
                      >
                        <option value="">选择项目 *</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={orderForm.supplierId}
                        onChange={(e) =>
                          setOrderForm({ ...orderForm, supplierId: e.target.value })
                        }
                        required
                      >
                        <option value="">选择供应商 *</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={orderForm.requestId}
                        onChange={(e) =>
                          setOrderForm({ ...orderForm, requestId: e.target.value })
                        }
                      >
                        <option value="">来源申请（可选，须已批准）</option>
                        {requests
                          .filter((r) => r.status === 'approved')
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.code}
                            </option>
                          ))}
                      </select>
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={orderForm.materialId}
                        onChange={(e) => {
                          const mat = materials.find((m) => m.id === e.target.value);
                          setOrderForm({
                            ...orderForm,
                            materialId: e.target.value,
                            unit: mat?.unit ?? orderForm.unit,
                          });
                        }}
                        required
                      >
                        <option value="">选择材料</option>
                        {materials
                          .filter(
                            (m) =>
                              !orderForm.projectId || m.projectId === orderForm.projectId,
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} - {m.name}
                            </option>
                          ))}
                      </select>
                      <div className="flex gap-2">
                        <Input
                          placeholder="数量"
                          type="number"
                          value={orderForm.quantity}
                          onChange={(e) =>
                            setOrderForm({ ...orderForm, quantity: e.target.value })
                          }
                          required
                        />
                        <Input
                          placeholder="单价"
                          type="number"
                          value={orderForm.unitPrice}
                          onChange={(e) =>
                            setOrderForm({ ...orderForm, unitPrice: e.target.value })
                          }
                          required
                        />
                      </div>
                      <Button type="submit">创建订单</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'suppliers' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3 font-medium">
                    供应商 ({total})
                  </div>
                  <div className="divide-y divide-border">
                    {suppliers.map((item) => (
                      <div key={item.id} className="px-4 py-3 text-sm">
                        <div className="font-medium">
                          {item.code} · {item.name}
                        </div>
                        <div className="text-muted-foreground">
                          {item.contact} {item.phone}
                        </div>
                      </div>
                    ))}
                    {!suppliers.length && (
                      <div className="px-4 py-6 text-center text-muted-foreground">暂无数据</div>
                    )}
                  </div>
                </Card>

                {canCreateSupplier && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">新增供应商</h2>
                    <form onSubmit={handleCreateSupplier} className="space-y-3">
                      <Input
                        placeholder="供应商编号"
                        value={supplierForm.code}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, code: e.target.value })
                        }
                        required
                      />
                      <Input
                        placeholder="名称"
                        value={supplierForm.name}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, name: e.target.value })
                        }
                        required
                      />
                      <Input
                        placeholder="联系人"
                        value={supplierForm.contact}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, contact: e.target.value })
                        }
                      />
                      <Input
                        placeholder="电话"
                        value={supplierForm.phone}
                        onChange={(e) =>
                          setSupplierForm({ ...supplierForm, phone: e.target.value })
                        }
                      />
                      <Button type="submit">保存</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'quotations' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3 font-medium">
                    询价记录 ({total})
                  </div>
                  <div className="divide-y divide-border">
                    {quotations.map((item) => (
                      <div key={item.id} className="px-4 py-3 text-sm">
                        <div className="font-medium">{item.code}</div>
                        <div className="text-muted-foreground">
                          {item.supplier?.name} · {item.price.amount}{' '}
                          {item.price.currency}
                        </div>
                      </div>
                    ))}
                    {!quotations.length && (
                      <div className="px-4 py-6 text-center text-muted-foreground">暂无数据</div>
                    )}
                  </div>
                </Card>

                {canCreateQuotation && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">新建询价</h2>
                    <form onSubmit={handleCreateQuotation} className="space-y-3">
                      <Input
                        placeholder="询价单号"
                        value={quotationForm.code}
                        onChange={(e) =>
                          setQuotationForm({ ...quotationForm, code: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={quotationForm.supplierId}
                        onChange={(e) =>
                          setQuotationForm({
                            ...quotationForm,
                            supplierId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">供应商</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="报价金额"
                        type="number"
                        value={quotationForm.amount}
                        onChange={(e) =>
                          setQuotationForm({ ...quotationForm, amount: e.target.value })
                        }
                        required
                      />
                      <Button type="submit">保存询价</Button>
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
