import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { AuthGuard } from '@/components/auth-guard';
import './globals.css';

export const metadata: Metadata = {
  title: 'OverBuild',
  description: '驻外工程项目管理平台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <Providers>
          <AuthGuard>{children}</AuthGuard>
        </Providers>
      </body>
    </html>
  );
}
