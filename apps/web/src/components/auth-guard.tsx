'use client';

import { useAuthStore } from '@/stores/auth-store';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const PUBLIC_PATHS = ['/login'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setHasHydrated = useAuthStore((s) => s.setHasHydrated);

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthed = Boolean(accessToken);

  useEffect(() => {
    const finishHydration = () => setHasHydrated(true);

    if (useAuthStore.persist.hasHydrated()) {
      finishHydration();
      return;
    }

    return useAuthStore.persist.onFinishHydration(finishHydration);
  }, [setHasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isPublic && !isAuthed) {
      router.replace('/login');
    }
  }, [hasHydrated, isAuthed, isPublic, router]);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!isPublic && !isAuthed) {
    return null;
  }

  return <>{children}</>;
}
