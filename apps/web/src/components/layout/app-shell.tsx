'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Moon, Search, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { logout } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/primitives';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', permission: null },
  { href: '/projects', label: '项目', permission: 'project.read' },
  { href: '/materials', label: '材料', permission: 'material.read' },
  { href: '/procurement', label: '采购', permission: 'procurement.request.read' },
  { href: '/warehouse', label: '仓库', permission: 'warehouse.read' },
  { href: '/contracts', label: '合同', permission: 'contract.read' },
  { href: '/finance', label: '财务', permission: 'finance.income.read' },
  { href: '/approvals', label: '审批', permission: null },
  { href: '/users', label: '用户', permission: 'auth.user.read' },
  { href: '/audit-logs', label: '审计日志', permission: 'audit.read' },
  { href: '/settings', label: '设置', permission: null },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const visibleNav = NAV.filter(
    (item) =>
      !item.permission || user?.permissions?.includes(item.permission),
  );

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // ignore
    } finally {
      clearAuth();
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
          <div className="font-semibold text-primary">OverBuild</div>
          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="搜索项目、材料、合同..."
              className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="切换主题"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.name}
            </span>
            <Button variant="ghost" onClick={handleLogout}>
              退出
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-card p-4 lg:block">
          <nav className="space-y-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'block rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-accent font-medium text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
