'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  BankAccountItem,
  BudgetItem,
  CashAccountItem,
  CollectionItem,
  ContractItem,
  createBudget,
  createCollection,
  createIncome,
  createPayment,
  getDailyReport,
  getProfitSummary,
  hasPermission,
  IncomeItem,
  listBankAccounts,
  listBudgets,
  listCashAccounts,
  listCollections,
  listContracts,
  listIncomes,
  listPayments,
  listProjects,
  PaymentItem,
  PAYMENT_STATUS_LABEL,
  ProfitItem,
  ProjectItem,
  submitPayment,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

type TabKey =
  | 'overview'
  | 'incomes'
  | 'payments'
  | 'collections'
  | 'budgets'
  | 'reports';

export default function FinancePage() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<TabKey>('overview');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccountItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [profits, setProfits] = useState<ProfitItem[]>([]);
  const [dailyReport, setDailyReport] = useState<{
    date: string;
    income: { count: number; amount: number };
    collection: { count: number; amount: number };
    payment: { count: number; amount: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('');

  const [incomeForm, setIncomeForm] = useState({
    code: '',
    projectId: '',
    amount: '',
    currency: 'CNY',
    receivedAt: '',
    summary: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    code: '',
    projectId: '',
    payee: '',
    amount: '',
    currency: 'CNY',
    paymentMethod: 'bank',
    accountId: '',
  });
  const [collectionForm, setCollectionForm] = useState({
    code: '',
    contractId: '',
    amount: '',
    currency: 'CNY',
    collectedAt: '',
    accountId: '',
  });
  const [budgetForm, setBudgetForm] = useState({
    projectId: '',
    category: '',
    amount: '',
    currency: 'CNY',
  });

  const canRead = hasPermission(user, 'finance.income.read');
  const canCreateIncome = hasPermission(user, 'finance.income.create');
  const canCreatePayment = hasPermission(user, 'finance.payment.create');
  const canSubmitPayment = hasPermission(user, 'finance.payment.submit');
  const canCreateCollection = hasPermission(user, 'finance.collection.create');
  const canCreateBudget = hasPermission(user, 'finance.budget.create');
  const canViewReport = hasPermission(user, 'finance.report.read');
  const canViewProfit = hasPermission(user, 'finance.profit.read');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [projRes, contractRes, cashRes, bankRes] = await Promise.all([
        listProjects({ page: 1, pageSize: 100 }),
        listContracts({ page: 1, pageSize: 100 }),
        listCashAccounts(),
        listBankAccounts(),
      ]);
      setProjects(projRes.data.list);
      setContracts(contractRes.data.list);
      setCashAccounts(cashRes.data.list);
      setBankAccounts(bankRes.data.list);

      const incomeRes = await listIncomes({ projectId: projectId || undefined });
      setIncomes(incomeRes.data.list);

      const paymentRes = await listPayments({ projectId: projectId || undefined });
      setPayments(paymentRes.data.list);

      const collectionRes = await listCollections({
        projectId: projectId || undefined,
      });
      setCollections(collectionRes.data.list);

      const budgetRes = await listBudgets({ projectId: projectId || undefined });
      setBudgets(budgetRes.data.list);

      if (canViewProfit) {
        const profitRes = await getProfitSummary();
        setProfits(profitRes.data.list);
      }

      if (canViewReport) {
        const reportRes = await getDailyReport();
        setDailyReport(reportRes.data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead, projectId]);

  if (!canRead) {
    return (
      <AppShell>
        <Card className="p-6">无权限查看财务</Card>
      </AppShell>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'overview', label: '概览' },
    { key: 'incomes', label: '收入' },
    { key: 'payments', label: '付款' },
    { key: 'collections', label: '回款' },
    { key: 'budgets', label: '预算' },
    { key: 'reports', label: '报表' },
  ];

  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">财务管理</h1>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </Card>
        )}

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

        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm',
                tab === item.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Card className="p-6 text-muted-foreground">加载中...</Card>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-4">
                  <h2 className="mb-2 font-medium">现金账户</h2>
                  {cashAccounts.map((a) => (
                    <p key={a.id} className="text-sm">
                      {a.name}: {a.balance.amount.toLocaleString()}{' '}
                      {a.balance.currency}
                    </p>
                  ))}
                </Card>
                <Card className="p-4">
                  <h2 className="mb-2 font-medium">银行账户</h2>
                  {bankAccounts.map((a) => (
                    <p key={a.id} className="text-sm">
                      {a.name}: {a.balance.amount.toLocaleString()}{' '}
                      {a.balance.currency}
                    </p>
                  ))}
                </Card>
                {canViewProfit && (
                  <Card className="p-4 md:col-span-2">
                    <h2 className="mb-2 font-medium">项目利润</h2>
                    {profits.map((p) => (
                      <div key={p.projectId} className="text-sm">
                        {p.projectName}: 收入 {p.income.toLocaleString()} · 成本{' '}
                        {p.cost.toLocaleString()} · 利润{' '}
                        <span className="font-medium text-primary">
                          {p.profit.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            )}

            {tab === 'incomes' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="divide-y divide-border">
                  {incomes.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm">
                      <div className="font-medium">{item.code}</div>
                      <div>{item.project?.name}</div>
                      <div>
                        {item.amount.amount} {item.amount.currency}
                      </div>
                    </div>
                  ))}
                </Card>
                {canCreateIncome && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">登记收入</h2>
                    <form
                      className="space-y-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await createIncome({
                          code: incomeForm.code,
                          projectId: incomeForm.projectId,
                          amount: {
                            amount: Number(incomeForm.amount),
                            currency: incomeForm.currency,
                          },
                          receivedAt: incomeForm.receivedAt,
                          summary: incomeForm.summary || undefined,
                        });
                        await loadData();
                      }}
                    >
                      <Input
                        placeholder="编号"
                        value={incomeForm.code}
                        onChange={(e) =>
                          setIncomeForm({ ...incomeForm, code: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={incomeForm.projectId}
                        onChange={(e) =>
                          setIncomeForm({
                            ...incomeForm,
                            projectId: e.target.value,
                          })
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
                        type="number"
                        placeholder="金额"
                        value={incomeForm.amount}
                        onChange={(e) =>
                          setIncomeForm({ ...incomeForm, amount: e.target.value })
                        }
                        required
                      />
                      <Input
                        type="date"
                        value={incomeForm.receivedAt}
                        onChange={(e) =>
                          setIncomeForm({
                            ...incomeForm,
                            receivedAt: e.target.value,
                          })
                        }
                        required
                      />
                      <Button type="submit">登记</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'payments' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="divide-y divide-border">
                  {payments.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{item.code}</span>
                        <span>
                          {PAYMENT_STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </div>
                      <div>
                        {item.payee} · {item.amount.amount}{' '}
                        {item.amount.currency}
                      </div>
                      {item.status === 'draft' && canSubmitPayment && (
                        <Button
                          className="mt-2"
                          variant="ghost"
                          onClick={() =>
                            submitPayment(item.id).then(() => loadData())
                          }
                        >
                          提交审批
                        </Button>
                      )}
                    </div>
                  ))}
                </Card>
                {canCreatePayment && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">创建付款单</h2>
                    <form
                      className="space-y-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await createPayment({
                          code: paymentForm.code,
                          projectId: paymentForm.projectId,
                          payee: paymentForm.payee,
                          amount: {
                            amount: Number(paymentForm.amount),
                            currency: paymentForm.currency,
                          },
                          paymentMethod: paymentForm.paymentMethod,
                          accountType: 'bank',
                          accountId: paymentForm.accountId,
                        });
                        await loadData();
                      }}
                    >
                      <Input
                        placeholder="付款单号"
                        value={paymentForm.code}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, code: e.target.value })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={paymentForm.projectId}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            projectId: e.target.value,
                          })
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
                        placeholder="收款方"
                        value={paymentForm.payee}
                        onChange={(e) =>
                          setPaymentForm({ ...paymentForm, payee: e.target.value })
                        }
                        required
                      />
                      <Input
                        type="number"
                        placeholder="金额"
                        value={paymentForm.amount}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            amount: e.target.value,
                          })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={paymentForm.accountId}
                        onChange={(e) =>
                          setPaymentForm({
                            ...paymentForm,
                            accountId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">付款账户</option>
                        {bankAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit">创建</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'collections' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="divide-y divide-border">
                  {collections.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm">
                      <div className="font-medium">{item.code}</div>
                      <div>
                        {item.contract?.name} · {item.amount.amount}{' '}
                        {item.amount.currency}
                      </div>
                    </div>
                  ))}
                </Card>
                {canCreateCollection && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">登记回款</h2>
                    <form
                      className="space-y-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await createCollection({
                          code: collectionForm.code,
                          contractId: collectionForm.contractId,
                          amount: {
                            amount: Number(collectionForm.amount),
                            currency: collectionForm.currency,
                          },
                          collectedAt: collectionForm.collectedAt,
                          accountType: 'bank',
                          accountId: collectionForm.accountId,
                        });
                        await loadData();
                      }}
                    >
                      <Input
                        placeholder="回款编号"
                        value={collectionForm.code}
                        onChange={(e) =>
                          setCollectionForm({
                            ...collectionForm,
                            code: e.target.value,
                          })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={collectionForm.contractId}
                        onChange={(e) =>
                          setCollectionForm({
                            ...collectionForm,
                            contractId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">选择合同（必填）</option>
                        {contracts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} - {c.name}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        placeholder="金额"
                        value={collectionForm.amount}
                        onChange={(e) =>
                          setCollectionForm({
                            ...collectionForm,
                            amount: e.target.value,
                          })
                        }
                        required
                      />
                      <Input
                        type="date"
                        value={collectionForm.collectedAt}
                        onChange={(e) =>
                          setCollectionForm({
                            ...collectionForm,
                            collectedAt: e.target.value,
                          })
                        }
                        required
                      />
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={collectionForm.accountId}
                        onChange={(e) =>
                          setCollectionForm({
                            ...collectionForm,
                            accountId: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="">收款账户</option>
                        {bankAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <Button type="submit">登记回款</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'budgets' && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="divide-y divide-border">
                  {budgets.map((item) => (
                    <div key={item.id} className="px-4 py-3 text-sm">
                      <div className="font-medium">{item.category}</div>
                      <div>{item.project?.name}</div>
                      <div>
                        {item.amount.amount} {item.amount.currency}
                      </div>
                    </div>
                  ))}
                </Card>
                {canCreateBudget && (
                  <Card className="p-4">
                    <h2 className="mb-3 font-medium">编制预算</h2>
                    <form
                      className="space-y-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await createBudget({
                          projectId: budgetForm.projectId,
                          category: budgetForm.category,
                          amount: {
                            amount: Number(budgetForm.amount),
                            currency: budgetForm.currency,
                          },
                        });
                        await loadData();
                      }}
                    >
                      <select
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                        value={budgetForm.projectId}
                        onChange={(e) =>
                          setBudgetForm({
                            ...budgetForm,
                            projectId: e.target.value,
                          })
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
                        placeholder="预算科目"
                        value={budgetForm.category}
                        onChange={(e) =>
                          setBudgetForm({
                            ...budgetForm,
                            category: e.target.value,
                          })
                        }
                        required
                      />
                      <Input
                        type="number"
                        placeholder="预算金额"
                        value={budgetForm.amount}
                        onChange={(e) =>
                          setBudgetForm({
                            ...budgetForm,
                            amount: e.target.value,
                          })
                        }
                        required
                      />
                      <Button type="submit">创建预算</Button>
                    </form>
                  </Card>
                )}
              </div>
            )}

            {tab === 'reports' && canViewReport && dailyReport && (
              <Card className="p-4 text-sm">
                <h2 className="mb-3 font-medium">日报 {dailyReport.date}</h2>
                <p>收入: {dailyReport.income.count} 笔 / {dailyReport.income.amount}</p>
                <p>
                  回款: {dailyReport.collection.count} 笔 /{' '}
                  {dailyReport.collection.amount}
                </p>
                <p>
                  付款: {dailyReport.payment.count} 笔 /{' '}
                  {dailyReport.payment.amount}
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
