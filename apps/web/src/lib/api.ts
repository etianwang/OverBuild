const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const API_TIMEOUT_MS = 15_000;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok || !json.success) {
      throw new Error(json.message || '请求失败');
    }
    return json;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求超时，请确认 API 服务已启动（端口 3001）');
    }
    if (err instanceof TypeError) {
      throw new Error('无法连接 API，请确认服务已启动（npm run dev:api）');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  roles: string[];
  permissions: string[];
}

export interface Paginated<T> {
  list: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface UserItem {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  locale: string;
  status: string;
}

export async function login(username: string, password: string) {
  return apiFetch<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function logout() {
  return apiFetch<null>('/auth/logout', { method: 'POST' });
}

export async function getMe() {
  return apiFetch<AuthUser>('/auth/me');
}

export async function listUsers(page = 1, pageSize = 20, q?: string) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (q) params.set('q', q);
  return apiFetch<Paginated<UserItem>>(`/users?${params}`);
}

export async function createUser(data: {
  username: string;
  password: string;
  name: string;
  email?: string;
}) {
  return apiFetch<UserItem>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProfile() {
  return apiFetch<UserItem>('/settings/profile');
}

export async function updateProfile(data: {
  name?: string;
  email?: string;
  phone?: string;
}) {
  return apiFetch<UserItem>('/settings/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePassword(oldPassword: string, newPassword: string) {
  return apiFetch<null>('/settings/password', {
    method: 'PUT',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export async function getPreferences() {
  return apiFetch<{
    locale: string;
    theme: string;
    notificationPrefs?: Record<string, boolean>;
  }>('/settings/preferences');
}

export async function updatePreferences(data: {
  locale?: string;
  theme?: string;
  notificationPrefs?: Record<string, boolean>;
}) {
  return apiFetch('/settings/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getSystemSettings() {
  return apiFetch<Record<string, unknown>>('/settings/system');
}

export async function updateSystemSettings(settings: Record<string, unknown>) {
  return apiFetch<Record<string, unknown>>('/settings/system', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}

export function hasPermission(user: AuthUser | null, code: string) {
  return user?.permissions?.includes(code) ?? false;
}

export interface ProjectItem {
  id: string;
  code: string;
  name: string;
  nameFr?: string | null;
  location?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  managerId: string;
  manager?: { id: string; name: string; username: string };
  _count?: { zones: number; members: number; milestones: number };
}

export interface ProjectDetail extends ProjectItem {
  zones?: Array<{
    id: string;
    name: string;
    nameFr?: string | null;
    description?: string | null;
  }>;
  members?: Array<{
    id: string;
    role: string;
    user: { id: string; name: string; username: string; email?: string | null };
  }>;
  milestones?: Array<{
    id: string;
    name: string;
    dueDate?: string | null;
    status: string;
    completedAt?: string | null;
  }>;
}

export async function listProjects(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.status) search.set('status', params.status);
  if (params?.sortBy) search.set('sortBy', params.sortBy);
  if (params?.sortOrder) search.set('sortOrder', params.sortOrder);
  return apiFetch<Paginated<ProjectItem>>(`/projects?${search}`);
}

export async function getProject(id: string) {
  return apiFetch<ProjectDetail>(`/projects/${id}`);
}

export async function createProject(data: {
  code: string;
  name: string;
  nameFr?: string;
  location?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  managerId: string;
}) {
  return apiFetch<ProjectItem>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    nameFr: string;
    location: string;
    status: string;
    startDate: string;
    endDate: string;
    description: string;
    managerId: string;
  }>,
) {
  return apiFetch<ProjectItem>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string) {
  return apiFetch<null>(`/projects/${id}`, { method: 'DELETE' });
}

export async function createProjectZone(
  projectId: string,
  data: { name: string; nameFr?: string; description?: string },
) {
  return apiFetch(`/projects/${projectId}/zones`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function addProjectMember(
  projectId: string,
  data: { userId: string; role: string },
) {
  return apiFetch(`/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createProjectMilestone(
  projectId: string,
  data: { name: string; dueDate?: string },
) {
  return apiFetch(`/projects/${projectId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface ProjectTaskItem {
  id: string;
  code?: string | null;
  name: string;
  nameFr?: string | null;
  zoneId?: string | null;
  parentId?: string | null;
  predecessorId?: string | null;
  assigneeId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  laborCount?: number | null;
  durationDays?: number | string | null;
  prerequisites?: string | null;
  showInGantt?: boolean;
  progress: number;
  status: string;
  sortOrder: number;
  zone?: { id: string; name: string } | null;
  assignee?: { id: string; name: string; username?: string } | null;
  predecessor?: { id: string; name: string; code?: string | null } | null;
  parent?: { id: string; name: string } | null;
}

export interface ProjectGanttOverview {
  totalTasks: number;
  completedTasks: number;
  scheduledTasks: number;
  avgProgress: number;
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectGanttData {
  tasks: ProjectTaskItem[];
  overview: ProjectGanttOverview;
}

export async function getProjectGantt(projectId: string) {
  return apiFetch<ProjectGanttData>(`/projects/${projectId}/gantt`);
}

export async function listProjectTasks(projectId: string) {
  return apiFetch<ProjectTaskItem[]>(`/projects/${projectId}/tasks`);
}

export async function createProjectTask(
  projectId: string,
  data: {
    code?: string;
    name: string;
    nameFr?: string;
    zoneId?: string;
    parentId?: string;
    predecessorId?: string;
    assigneeId?: string;
    startDate?: string;
    endDate?: string;
    laborCount?: number;
    durationDays?: number;
    prerequisites?: string;
    progress?: number;
    status?: string;
    sortOrder?: number;
    showInGantt?: boolean;
  },
) {
  return apiFetch<ProjectTaskItem>(`/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProjectTask(
  projectId: string,
  taskId: string,
  data: Partial<{
    code: string | null;
    name: string;
    nameFr: string | null;
    zoneId: string | null;
    parentId: string | null;
    predecessorId: string | null;
    assigneeId: string | null;
    startDate: string | null;
    endDate: string | null;
    laborCount: number | null;
    durationDays: number | null;
    prerequisites: string | null;
    progress: number;
    status: string;
    sortOrder: number;
    showInGantt?: boolean;
  }>,
) {
  return apiFetch<ProjectTaskItem>(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function reorderProjectTasks(
  projectId: string,
  orderedIds: string[],
) {
  return apiFetch<ProjectTaskItem[]>(`/projects/${projectId}/tasks/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ orderedIds }),
  });
}

export async function deleteProjectTask(projectId: string, taskId: string) {
  return apiFetch<null>(`/projects/${projectId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export async function importProjectTasks(
  projectId: string,
  data: { content: string; replace?: boolean },
) {
  return apiFetch<{
    imported: number;
    errors: string[];
    taskIds: string[];
  }>(`/projects/${projectId}/tasks/import`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function exportProjectTasks(projectId: string) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const res = await fetch(`${API_URL}/projects/${projectId}/tasks/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error('导出失败');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="(.+)"/);
  const filename = match?.[1]
    ? decodeURIComponent(match[1])
    : `project-tasks-${Date.now()}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  module: string;
  resource: string;
  resourceId: string | null;
  payload: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    name: string;
    email?: string | null;
  } | null;
}

export async function listAuditLogs(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.module) search.set('module', params.module);
  if (params?.action) search.set('action', params.action);
  if (params?.startDate) search.set('startDate', params.startDate);
  if (params?.endDate) search.set('endDate', params.endDate);
  return apiFetch<Paginated<AuditLogItem>>(`/audit-logs?${search}`);
}

export async function getAuditLog(id: string) {
  return apiFetch<AuditLogItem>(`/audit-logs/${id}`);
}

export async function exportAuditLogs(params?: {
  q?: string;
  module?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.module) search.set('module', params.module);
  if (params?.action) search.set('action', params.action);
  if (params?.startDate) search.set('startDate', params.startDate);
  if (params?.endDate) search.set('endDate', params.endDate);

  const res = await fetch(`${API_URL}/audit-logs/export?${search}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error('导出失败');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="(.+)"/);
  const filename = match?.[1] ?? `audit-logs-${Date.now()}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
