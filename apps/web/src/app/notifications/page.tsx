'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
} from '@/lib/api';

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const res = await listNotifications({
        isRead: filter === 'unread' ? false : undefined,
      });
      setItems(res.data.list);
      setTotal(res.data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">通知中心</h1>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              onClick={() => setFilter('all')}
            >
              全部
            </Button>
            <Button
              variant={filter === 'unread' ? 'default' : 'ghost'}
              onClick={() => setFilter('unread')}
            >
              未读
            </Button>
            <Button
              variant="ghost"
              onClick={() => markAllNotificationsRead().then(() => loadData())}
            >
              全部已读
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </Card>
        )}

        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
            共 {total} 条
          </div>
          {loading ? (
            <div className="p-6 text-muted-foreground">加载中...</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`px-4 py-3 text-sm ${item.isRead ? 'opacity-75' : 'bg-accent/30'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          {item.typeLabel}
                        </span>
                        {!item.isRead && (
                          <span className="text-xs text-primary">未读</span>
                        )}
                      </div>
                      <div className="mt-1 font-medium">{item.title}</div>
                      <div className="text-muted-foreground">{item.content}</div>
                      {item.link && (
                        <Link
                          href={item.link}
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                        >
                          查看详情
                        </Link>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {!item.isRead && (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            markNotificationRead(item.id).then(() => loadData())
                          }
                        >
                          已读
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        onClick={() =>
                          deleteNotification(item.id).then(() => loadData())
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {!items.length && (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  暂无通知
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
