'use client';

import { AppShell } from '@/components/layout/app-shell';
import { Card } from '@/components/ui/primitives';
import { useAuthStore } from '@/stores/auth-store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          欢迎回来，{user?.name ?? '用户'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: '进行中项目', value: '—' },
          { label: '待办审批', value: '—' },
          { label: '库存预警', value: '—' },
          { label: '未读通知', value: '—' },
        ].map((item) => (
          <Card key={item.label} className="p-5">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
