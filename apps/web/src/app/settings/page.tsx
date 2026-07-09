'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  changePassword,
  getPreferences,
  getProfile,
  getSystemSettings,
  hasPermission,
  updatePreferences,
  updateProfile,
  updateSystemSettings,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '' });
  const [prefs, setPrefs] = useState({ locale: 'zh', theme: 'system' });
  const [appName, setAppName] = useState('OverBuild');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canManageSystem = hasPermission(user, 'settings.system');

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, prefsRes] = await Promise.all([
          getProfile(),
          getPreferences(),
        ]);
        setProfile({
          name: profileRes.data.name,
          email: profileRes.data.email ?? '',
          phone: profileRes.data.phone ?? '',
        });
        setPrefs({
          locale: prefsRes.data.locale,
          theme: prefsRes.data.theme,
        });
        if (canManageSystem) {
          const sysRes = await getSystemSettings();
          setAppName(String(sysRes.data['app.name'] ?? 'OverBuild'));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      }
    }
    load();
  }, [canManageSystem]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateProfile(profile);
      setMessage('个人信息已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    try {
      await changePassword(passwords.oldPassword, passwords.newPassword);
      setPasswords({ oldPassword: '', newPassword: '' });
      setMessage('密码已修改');
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改失败');
    }
  }

  async function savePreferences(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePreferences(prefs);
      if (prefs.theme !== 'system') {
        setTheme(prefs.theme);
      }
      setMessage('偏好已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function saveSystem(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateSystemSettings({ 'app.name': appName });
      setMessage('系统配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  return (
    <AppShell>
      <h1 className="mb-6 text-2xl font-semibold">系统设置</h1>
      {message && <p className="mb-4 text-sm text-green-600">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-medium">个人信息</h2>
          <form onSubmit={saveProfile} className="space-y-3">
            <Input
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
            />
            <Input
              value={profile.email}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
            />
            <Input
              value={profile.phone}
              onChange={(e) =>
                setProfile((p) => ({ ...p, phone: e.target.value }))
              }
            />
            <Button type="submit">保存</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-medium">修改密码</h2>
          <form onSubmit={savePassword} className="space-y-3">
            <Input
              type="password"
              placeholder="原密码"
              value={passwords.oldPassword}
              onChange={(e) =>
                setPasswords((p) => ({ ...p, oldPassword: e.target.value }))
              }
            />
            <Input
              type="password"
              placeholder="新密码"
              value={passwords.newPassword}
              onChange={(e) =>
                setPasswords((p) => ({ ...p, newPassword: e.target.value }))
              }
            />
            <Button type="submit">修改密码</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-medium">偏好设置</h2>
          <form onSubmit={savePreferences} className="space-y-3">
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              value={prefs.locale}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, locale: e.target.value }))
              }
            >
              <option value="zh">中文</option>
              <option value="fr">Français</option>
              <option value="en">English</option>
            </select>
            <select
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              value={prefs.theme}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, theme: e.target.value }))
              }
            >
              <option value="system">跟随系统</option>
              <option value="light">亮色</option>
              <option value="dark">深色</option>
            </select>
            <Button type="submit">保存偏好</Button>
          </form>
        </Card>

        {canManageSystem && (
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-medium">系统配置</h2>
            <form onSubmit={saveSystem} className="space-y-3">
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
              />
              <Button type="submit">保存系统配置</Button>
            </form>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
