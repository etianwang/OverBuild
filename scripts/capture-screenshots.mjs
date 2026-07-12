import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'assets', 'screenshots');

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:3020';
const API_URL = process.env.SCREENSHOT_API_URL ?? 'http://localhost:3021/api/v1';

const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'projects', path: '/projects' },
  { name: 'materials', path: '/materials' },
  { name: 'procurement', path: '/procurement' },
  { name: 'warehouse', path: '/warehouse' },
  { name: 'contracts', path: '/contracts' },
  { name: 'finance', path: '/finance' },
  { name: 'documents', path: '/documents' },
  { name: 'drawings', path: '/drawings' },
  { name: 'translation', path: '/translation' },
  { name: 'approvals', path: '/approvals' },
  { name: 'users', path: '/users' },
  { name: 'audit-logs', path: '/audit-logs' },
  { name: 'settings', path: '/settings' },
  { name: 'notifications', path: '/notifications' },
];

async function fetchProjectId() {
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginJson = await loginRes.json();
  const token = loginJson?.data?.accessToken;
  if (!token) throw new Error('API login failed');

  const projectsRes = await fetch(`${API_URL}/projects?page=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const projectsJson = await projectsRes.json();
  const projectId = projectsJson?.data?.list?.[0]?.id;
  if (!projectId) throw new Error('No demo project found');
  return projectId;
}

async function waitForPageReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function capture(page, filePath, fullPage = true) {
  await waitForPageReady(page);
  await page.screenshot({ path: filePath, fullPage });
}

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '登录' }).click();
  await page.waitForURL('**/dashboard', { timeout: 20000 });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const projectId = await fetchProjectId();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
  });
  const page = await context.newPage();

  const manifest = [];

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await capture(page, path.join(OUT_DIR, 'login-light.png'), false);
  manifest.push('login-light.png');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await capture(page, path.join(OUT_DIR, 'login-dark.png'), false);
  manifest.push('login-dark.png');
  await page.emulateMedia({ colorScheme: 'light' });

  await login(page);

  for (const item of PAGES) {
    await page.goto(`${BASE_URL}${item.path}`, { waitUntil: 'domcontentloaded' });
    const fileName = `${item.name}.png`;
    await capture(page, path.join(OUT_DIR, fileName));
    manifest.push(fileName);
    console.log(`Captured ${fileName}`);
  }

  await page.goto(`${BASE_URL}/projects/${projectId}`, { waitUntil: 'domcontentloaded' });
  await capture(page, path.join(OUT_DIR, 'project-detail.png'));
  manifest.push('project-detail.png');
  console.log('Captured project-detail.png');

  await page.goto(`${BASE_URL}/projects/${projectId}/schedule`, {
    waitUntil: 'domcontentloaded',
  });
  await capture(page, path.join(OUT_DIR, 'project-schedule.png'));
  manifest.push('project-schedule.png');
  console.log('Captured project-schedule.png');

  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await capture(page, path.join(OUT_DIR, 'dashboard-dark.png'));
  manifest.push('dashboard-dark.png');
  console.log('Captured dashboard-dark.png');

  await browser.close();

  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify({ baseUrl: BASE_URL, capturedAt: new Date().toISOString(), files: manifest }, null, 2),
  );

  console.log(`Done. ${manifest.length} screenshots saved to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
