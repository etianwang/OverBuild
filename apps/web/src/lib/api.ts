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

export interface ApprovalItem {
  id: string;
  code: string;
  type: string;
  businessId: string;
  projectId?: string | null;
  initiatorId: string;
  status: string;
  currentNode: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  currentApproverId?: string | null;
  initiator?: { id: string; name: string; username: string; email?: string | null };
  project?: { id: string; code: string; name: string } | null;
  records?: Array<{
    id: string;
    node: number;
    action: string;
    comment?: string | null;
    actedAt: string;
    approver: { id: string; name: string; username: string };
  }>;
}

const APPROVAL_TYPE_LABEL: Record<string, string> = {
  purchase_request: '采购申请',
  payment: '付款',
  reimbursement: '报销',
  contract: '合同签订',
  drawing: '图纸发布',
};

export function approvalTypeLabel(type: string) {
  return APPROVAL_TYPE_LABEL[type] ?? type;
}

const APPROVAL_STATUS_LABEL: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已撤回',
};

export function approvalStatusLabel(status: string) {
  return APPROVAL_STATUS_LABEL[status] ?? status;
}

export async function listApprovals(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: string;
  status?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.type) search.set('type', params.type);
  if (params?.status) search.set('status', params.status);
  return apiFetch<Paginated<ApprovalItem>>(`/workflow/approvals?${search}`);
}

export async function listApprovalTodo(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  return apiFetch<Paginated<ApprovalItem>>(`/workflow/approvals/todo?${search}`);
}

export async function listApprovalDone(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  return apiFetch<Paginated<ApprovalItem>>(`/workflow/approvals/done?${search}`);
}

export async function listApprovalInitiated(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  type?: string;
  status?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.type) search.set('type', params.type);
  if (params?.status) search.set('status', params.status);
  return apiFetch<Paginated<ApprovalItem>>(`/workflow/approvals/initiated?${search}`);
}

export async function getApproval(id: string) {
  return apiFetch<ApprovalItem>(`/workflow/approvals/${id}`);
}

export async function createApproval(data: {
  type: string;
  businessId: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}) {
  return apiFetch<ApprovalItem>('/workflow/approvals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approveApproval(id: string, comment?: string) {
  return apiFetch<ApprovalItem>(`/workflow/approvals/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function rejectApproval(id: string, comment?: string) {
  return apiFetch<ApprovalItem>(`/workflow/approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export async function cancelApproval(id: string) {
  return apiFetch<ApprovalItem>(`/workflow/approvals/${id}/cancel`, {
    method: 'POST',
  });
}

export async function exportApprovals(params?: {
  q?: string;
  type?: string;
  status?: string;
  scope?: 'all' | 'initiated';
}) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.type) search.set('type', params.type);
  if (params?.status) search.set('status', params.status);
  if (params?.scope) search.set('scope', params.scope);

  const res = await fetch(`${API_URL}/workflow/approvals/export?${search}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error('导出失败');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="(.+)"/);
  const filename = match?.[1] ?? `approvals-${Date.now()}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface MoneyValue {
  amount: number;
  currency: string;
}

export interface MaterialCategoryItem {
  id: string;
  code: string;
  name: string;
  discipline: string;
  description?: string | null;
}

export interface MaterialItem {
  id: string;
  code: string;
  name: string;
  spec?: string | null;
  brand?: string | null;
  model?: string | null;
  unit: string;
  categoryId: string;
  projectId: string;
  storageLocation?: string | null;
  warehouseId?: string | null;
  stock: number;
  minStock?: number | null;
  purchasePrice?: MoneyValue | null;
  latestPrice?: MoneyValue | null;
  imageUrl?: string | null;
  supplierId?: string | null;
  category?: { id: string; code: string; name: string; discipline?: string };
  project?: { id: string; code: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface MaterialAlertItem {
  id: string;
  code: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  gap: number;
  category?: MaterialCategoryItem | null;
}

export const MATERIAL_DISCIPLINE_LABEL: Record<string, string> = {
  civil: '土建',
  mep: '机电',
  finishing: '精装',
  general: '通用',
};

export async function listMaterials(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  categoryId?: string;
  projectId?: string;
  discipline?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.sort) search.set('sort', params.sort);
  if (params?.order) search.set('order', params.order);
  if (params?.categoryId) search.set('categoryId', params.categoryId);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.discipline) search.set('discipline', params.discipline);
  return apiFetch<Paginated<MaterialItem>>(`/materials?${search}`);
}

export async function listMaterialAlerts(params?: {
  page?: number;
  pageSize?: number;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  return apiFetch<Paginated<MaterialAlertItem>>(`/materials/alerts?${search}`);
}

export async function listMaterialCategories() {
  return apiFetch<MaterialCategoryItem[]>('/materials/categories');
}

export async function createMaterialCategory(data: {
  code: string;
  name: string;
  discipline: string;
  description?: string;
}) {
  return apiFetch<MaterialCategoryItem>('/materials/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createMaterial(data: {
  code: string;
  name: string;
  spec?: string;
  brand?: string;
  model?: string;
  unit: string;
  categoryId: string;
  projectId: string;
  storageLocation?: string;
  warehouseId?: string;
  minStock?: number;
  purchasePrice?: MoneyValue;
  imageUrl?: string;
  supplierId?: string;
}) {
  return apiFetch<MaterialItem>('/materials', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateMaterial(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    spec: string | null;
    brand: string | null;
    model: string | null;
    unit: string;
    categoryId: string;
    minStock: number | null;
    purchasePrice: MoneyValue | null;
    imageUrl: string | null;
    supplierId: string | null;
  }>,
) {
  return apiFetch<MaterialItem>(`/materials/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteMaterial(id: string) {
  return apiFetch<null>(`/materials/${id}`, { method: 'DELETE' });
}

export async function importMaterials(content: string) {
  return apiFetch<{ imported: number; errors: string[]; total: number }>(
    '/materials/import',
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
  );
}

export async function exportMaterials(params?: {
  q?: string;
  categoryId?: string;
  projectId?: string;
  discipline?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.categoryId) search.set('categoryId', params.categoryId);
  if (params?.sort) search.set('sort', params.sort);
  if (params?.order) search.set('order', params.order);

  const res = await fetch(`${API_URL}/materials/export?${search}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error('导出失败');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="(.+)"/);
  const filename = match?.[1] ?? `materials-${Date.now()}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function getMaterialQrcode(id: string) {
  return apiFetch<{
    materialId: string;
    code: string;
    payload: string;
    qrcodeUrl: string;
  }>(`/materials/${id}/qrcode`);
}

// ── Procurement ──

export const PURCHASE_REQUEST_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending: '审批中',
  approved: '已批准',
  rejected: '已驳回',
  ordered: '已下单',
};

export const PURCHASE_ORDER_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  confirmed: '已确认',
  partial: '部分到货',
  received: '已到货',
  cancelled: '已取消',
};

export interface SupplierItem {
  id: string;
  code: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export interface PurchaseRequestItem {
  id: string;
  code: string;
  projectId: string;
  requesterId: string;
  status: string;
  remark?: string | null;
  project?: { id: string; code: string; name: string };
  requester?: { id: string; name: string };
  items?: Array<{
    id: string;
    materialId: string;
    quantity: number;
    unit: string;
    material?: { id: string; code: string; name: string; unit: string };
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  code: string;
  projectId: string;
  supplierId: string;
  requestId?: string | null;
  totalAmount: MoneyValue;
  status: string;
  orderedAt?: string | null;
  project?: { id: string; code: string; name: string };
  supplier?: { id: string; code: string; name: string };
  request?: { id: string; code: string; status: string } | null;
  items?: Array<{
    id: string;
    materialId: string;
    quantity: number;
    unit: string;
    unitPrice: MoneyValue;
    material?: { id: string; code: string; name: string; unit: string };
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationItem {
  id: string;
  code: string;
  supplierId: string;
  requestId?: string | null;
  materialId?: string | null;
  status: string;
  remark?: string | null;
  price: MoneyValue;
  supplier?: { id: string; code: string; name: string };
  request?: { id: string; code: string } | null;
  material?: { id: string; code: string; name: string } | null;
  quotedAt?: string | null;
  createdAt: string;
}

export async function listPurchaseRequests(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
  status?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.status) search.set('status', params.status);
  return apiFetch<Paginated<PurchaseRequestItem>>(
    `/procurement/purchase-requests?${search}`,
  );
}

export async function createPurchaseRequest(data: {
  code: string;
  projectId: string;
  remark?: string;
  items: Array<{ materialId: string; quantity: number; unit: string }>;
}) {
  return apiFetch<PurchaseRequestItem>('/procurement/purchase-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitPurchaseRequest(id: string) {
  return apiFetch<PurchaseRequestItem>(
    `/procurement/purchase-requests/${id}/submit`,
    { method: 'POST' },
  );
}

export async function listPurchaseOrders(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
  status?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.status) search.set('status', params.status);
  return apiFetch<Paginated<PurchaseOrderItem>>(
    `/procurement/purchase-orders?${search}`,
  );
}

export async function createPurchaseOrder(data: {
  code: string;
  projectId: string;
  supplierId: string;
  requestId?: string;
  items: Array<{
    materialId: string;
    quantity: number;
    unit: string;
    unitPrice: MoneyValue;
  }>;
}) {
  return apiFetch<PurchaseOrderItem>('/procurement/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function receivePurchaseOrder(id: string) {
  return apiFetch<PurchaseOrderItem>(`/procurement/purchase-orders/${id}/receive`, {
    method: 'PUT',
  });
}

export async function listSuppliers(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  return apiFetch<Paginated<SupplierItem>>(`/procurement/suppliers?${search}`);
}

export async function createSupplier(data: {
  code: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
}) {
  return apiFetch<SupplierItem>('/procurement/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listQuotations(params?: {
  page?: number;
  pageSize?: number;
  requestId?: string;
  supplierId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.requestId) search.set('requestId', params.requestId);
  if (params?.supplierId) search.set('supplierId', params.supplierId);
  return apiFetch<Paginated<QuotationItem>>(`/procurement/quotations?${search}`);
}

export async function createQuotation(data: {
  code: string;
  supplierId: string;
  requestId?: string;
  materialId?: string;
  price: MoneyValue;
  remark?: string;
}) {
  return apiFetch<QuotationItem>('/procurement/quotations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async function exportProcurementCsv(path: string, filenamePrefix: string) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('导出失败');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="(.+)"/);
  const filename = match?.[1] ?? `${filenamePrefix}-${Date.now()}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportPurchaseRequests(params?: {
  q?: string;
  projectId?: string;
  status?: string;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.status) search.set('status', params.status);
  await exportProcurementCsv(
    `/procurement/purchase-requests/export?${search}`,
    'purchase-requests',
  );
}

export async function exportPurchaseOrders(params?: {
  q?: string;
  projectId?: string;
  status?: string;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.status) search.set('status', params.status);
  await exportProcurementCsv(
    `/procurement/purchase-orders/export?${search}`,
    'purchase-orders',
  );
}

export async function exportSuppliers(q?: string) {
  const search = new URLSearchParams();
  if (q) search.set('q', q);
  await exportProcurementCsv(
    `/procurement/suppliers/export?${search}`,
    'suppliers',
  );
}

// ── Warehouse ──

export interface WarehouseItem {
  id: string;
  code: string;
  name: string;
  projectId: string;
  address?: string | null;
  status: string;
  project?: { id: string; code: string; name: string };
}

export interface StockDocumentItem {
  id: string;
  code: string;
  warehouseId: string;
  projectId: string;
  type: string;
  status: string;
  remark?: string | null;
  inboundAt?: string | null;
  outboundAt?: string | null;
  warehouse?: { id: string; code: string; name: string };
  project?: { id: string; code: string; name: string };
  items?: Array<{
    id: string;
    materialId: string;
    quantity: number;
    unit: string;
    material?: { id: string; code: string; name: string; unit: string };
  }>;
}

export interface StockBalanceItem {
  id: string;
  warehouseId: string;
  materialId: string;
  projectId: string;
  quantity: number;
  warehouse?: { id: string; code: string; name: string };
  material?: { id: string; code: string; name: string; unit: string };
  project?: { id: string; code: string; name: string };
}

export async function listWarehouses(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  return apiFetch<Paginated<WarehouseItem>>(`/warehouse/warehouses?${search}`);
}

export async function createWarehouse(data: {
  code: string;
  name: string;
  projectId: string;
  address?: string;
}) {
  return apiFetch<WarehouseItem>('/warehouse/warehouses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listInbounds(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  return apiFetch<Paginated<StockDocumentItem>>(`/warehouse/inbound?${search}`);
}

export async function createInbound(data: {
  code: string;
  warehouseId: string;
  projectId: string;
  type: string;
  remark?: string;
  items: Array<{ materialId: string; quantity: number; unit: string }>;
}) {
  return apiFetch<StockDocumentItem>('/warehouse/inbound', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function confirmInbound(id: string) {
  return apiFetch<StockDocumentItem>(`/warehouse/inbound/${id}/confirm`, {
    method: 'POST',
  });
}

export async function listOutbounds(params?: {
  page?: number;
  pageSize?: number;
  projectId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.projectId) search.set('projectId', params.projectId);
  return apiFetch<Paginated<StockDocumentItem>>(`/warehouse/outbound?${search}`);
}

export async function createOutbound(data: {
  code: string;
  warehouseId: string;
  projectId: string;
  type: string;
  items: Array<{ materialId: string; quantity: number; unit: string }>;
}) {
  return apiFetch<StockDocumentItem>('/warehouse/outbound', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function confirmOutbound(id: string) {
  return apiFetch<StockDocumentItem>(`/warehouse/outbound/${id}/confirm`, {
    method: 'POST',
  });
}

export async function listStockBalances(params?: {
  page?: number;
  pageSize?: number;
  projectId?: string;
  warehouseId?: string;
  q?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.warehouseId) search.set('warehouseId', params.warehouseId);
  if (params?.q) search.set('q', params.q);
  return apiFetch<Paginated<StockBalanceItem>>(`/warehouse/stock-balances?${search}`);
}

// ── Contract ──

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  construction: '施工合同',
  procurement: '采购合同',
  service: '服务合同',
  other: '其他',
};

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  active: '生效',
  completed: '已完成',
  terminated: '已终止',
};

export interface ContractItem {
  id: string;
  code: string;
  name: string;
  nameFr?: string | null;
  projectId: string;
  partyA: string;
  partyB: string;
  amount: MoneyValue;
  type: string;
  status: string;
  signedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  collectedAmount: MoneyValue;
  attachmentUrl?: string | null;
  project?: { id: string; code: string; name: string };
  approval?: { id: string; status: string; code: string } | null;
  createdAt: string;
  updatedAt: string;
}

export async function listContracts(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
  status?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.status) search.set('status', params.status);
  return apiFetch<Paginated<ContractItem>>(`/contracts?${search}`);
}

export async function getContract(id: string) {
  return apiFetch<ContractItem>(`/contracts/${id}`);
}

export async function createContract(data: {
  code: string;
  name: string;
  nameFr?: string;
  projectId: string;
  partyA: string;
  partyB: string;
  amount: MoneyValue;
  type: string;
  signedAt?: string;
  startDate?: string;
  endDate?: string;
}) {
  return apiFetch<ContractItem>('/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitContract(id: string) {
  return apiFetch<ContractItem>(`/contracts/${id}/submit`, { method: 'POST' });
}

export async function exportContracts(params?: { q?: string; projectId?: string }) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  const res = await fetch(`${API_URL}/contracts/export?${search}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('导出失败');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const match = disposition?.match(/filename="(.+)"/);
  const filename = match?.[1] ?? `contracts-${Date.now()}.csv`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Finance ──

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  pending: '待审批',
  approved: '已审批',
  paid: '已付款',
  rejected: '已驳回',
};

export interface FinanceMoney {
  amount: number;
  currency: string;
}

export interface IncomeItem {
  id: string;
  code: string;
  projectId: string;
  contractId?: string | null;
  amount: FinanceMoney;
  receivedAt: string;
  summary?: string | null;
  project?: { id: string; code: string; name: string };
}

export interface PaymentItem {
  id: string;
  code: string;
  projectId: string;
  payee: string;
  amount: FinanceMoney;
  paymentMethod: string;
  accountType: string;
  accountId: string;
  status: string;
  project?: { id: string; code: string; name: string };
}

export interface CollectionItem {
  id: string;
  code: string;
  contractId: string;
  projectId: string;
  amount: FinanceMoney;
  collectedAt: string;
  contract?: { id: string; code: string; name: string };
  project?: { id: string; code: string; name: string };
}

export interface BudgetItem {
  id: string;
  projectId: string;
  category: string;
  amount: FinanceMoney;
  status: string;
  project?: { id: string; code: string; name: string };
}

export interface ProfitItem {
  projectId: string;
  projectCode: string;
  projectName: string;
  income: number;
  cost: number;
  profit: number;
  profitRate: number;
}

export interface CashAccountItem {
  id: string;
  code: string;
  name: string;
  balance: FinanceMoney;
}

export interface BankAccountItem {
  id: string;
  code: string;
  name: string;
  bankName: string;
  accountNo: string;
  balance: FinanceMoney;
}

export async function listIncomes(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  return apiFetch<Paginated<IncomeItem>>(`/finance/incomes?${search}`);
}

export async function createIncome(data: {
  code: string;
  projectId: string;
  contractId?: string;
  amount: FinanceMoney;
  receivedAt: string;
  summary?: string;
}) {
  return apiFetch<IncomeItem>('/finance/incomes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listPayments(params?: {
  page?: number;
  pageSize?: number;
  projectId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.projectId) search.set('projectId', params.projectId);
  return apiFetch<Paginated<PaymentItem>>(`/finance/payments?${search}`);
}

export async function createPayment(data: {
  code: string;
  projectId: string;
  payee: string;
  amount: FinanceMoney;
  paymentMethod: string;
  accountType: string;
  accountId: string;
}) {
  return apiFetch<PaymentItem>('/finance/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function submitPayment(id: string) {
  return apiFetch<PaymentItem>(`/finance/payments/${id}/submit`, {
    method: 'POST',
  });
}

export async function listCollections(params?: {
  page?: number;
  pageSize?: number;
  projectId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.projectId) search.set('projectId', params.projectId);
  return apiFetch<Paginated<CollectionItem>>(`/finance/collections?${search}`);
}

export async function createCollection(data: {
  code: string;
  contractId: string;
  amount: FinanceMoney;
  collectedAt: string;
  accountType: string;
  accountId: string;
  remark?: string;
}) {
  return apiFetch<CollectionItem>('/finance/collections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listBudgets(params?: { projectId?: string }) {
  const search = new URLSearchParams({ page: '1', pageSize: '50' });
  if (params?.projectId) search.set('projectId', params.projectId);
  return apiFetch<Paginated<BudgetItem>>(`/finance/budgets?${search}`);
}

export async function createBudget(data: {
  projectId: string;
  category: string;
  amount: FinanceMoney;
}) {
  return apiFetch<BudgetItem>('/finance/budgets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getProfitSummary() {
  return apiFetch<{ list: ProfitItem[]; total: number }>(
    '/finance/projects/profit-summary',
  );
}

export async function getDailyReport(date?: string) {
  const search = date ? `?date=${date}` : '';
  return apiFetch<{
    date: string;
    income: { count: number; amount: number };
    collection: { count: number; amount: number };
    payment: { count: number; amount: number };
  }>(`/finance/reports/daily${search}`);
}

export async function listCashAccounts() {
  return apiFetch<{ list: CashAccountItem[]; total: number }>(
    '/finance/cash-accounts',
  );
}

export async function listBankAccounts() {
  return apiFetch<{ list: BankAccountItem[]; total: number }>(
    '/finance/bank-accounts',
  );
}

// ── Document ──

export interface DocumentCategoryItem {
  id: string;
  name: string;
  nameFr?: string | null;
  projectId?: string | null;
  project?: { id: string; code: string; name: string };
}

export interface DocumentVersionItem {
  id: string;
  version: number;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  uploadedAt: string;
  uploadedBy?: { id: string; name: string };
}

export interface DocumentItem {
  id: string;
  code: string;
  title: string;
  titleFr?: string | null;
  projectId: string;
  categoryId?: string | null;
  tags: string[];
  currentVersion: number;
  status: string;
  project?: { id: string; code: string; name: string };
  category?: { id: string; name: string; nameFr?: string | null } | null;
  createdBy?: { id: string; name: string };
  versions?: DocumentVersionItem[];
  createdAt: string;
  updatedAt: string;
}

export async function listDocuments(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
  categoryId?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.categoryId) search.set('categoryId', params.categoryId);
  return apiFetch<Paginated<DocumentItem>>(`/documents?${search}`);
}

export async function listDocumentCategories(projectId?: string) {
  const search = projectId ? `?projectId=${projectId}` : '';
  return apiFetch<{ list: DocumentCategoryItem[]; total: number }>(
    `/document-categories${search}`,
  );
}

export async function createDocumentCategory(data: {
  name: string;
  nameFr?: string;
  projectId?: string;
}) {
  return apiFetch<DocumentCategoryItem>('/document-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createDocument(
  data: {
    code: string;
    title: string;
    titleFr?: string;
    projectId: string;
    categoryId?: string;
    tags?: string[];
  },
  file: File,
) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const form = new FormData();
  form.append('file', file);
  form.append('code', data.code);
  form.append('title', data.title);
  if (data.titleFr) form.append('titleFr', data.titleFr);
  form.append('projectId', data.projectId);
  if (data.categoryId) form.append('categoryId', data.categoryId);
  if (data.tags?.length) form.append('tags', JSON.stringify(data.tags));

  const res = await fetch(`${API_URL}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '上传失败');
  }
  return json as { success: boolean; data: DocumentItem };
}

export function getDocumentPreviewUrl(id: string, version: number) {
  return `${API_URL}/documents/${id}/versions/${version}/preview`;
}

export async function openDocumentPreview(id: string, version: number) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(getDocumentPreviewUrl(id, version), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('预览失败');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export async function submitDocumentTranslate(
  id: string,
  data: { sourceLang: string; targetLang: string },
) {
  return apiFetch<{ id: string; code: string; status: string }>(
    `/documents/${id}/translate`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

// ── Drawing ──

export const DRAWING_DISCIPLINE_LABEL: Record<string, string> = {
  arch: '建筑',
  struct: '结构',
  mep: '机电',
  civil: '土建',
  other: '其他',
};

export const DRAWING_STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  reviewing: '审阅中',
  approved: '已批准',
  published: '已发布',
};

export interface DrawingVersionItem {
  id: string;
  version: number;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  uploadedAt: string;
  uploadedBy?: { id: string; name: string };
}

export interface DrawingItem {
  id: string;
  drawingNo: string;
  name: string;
  nameFr?: string | null;
  projectId: string;
  discipline: string;
  zoneId?: string | null;
  currentVersion: number;
  status: string;
  project?: { id: string; code: string; name: string };
  zone?: { id: string; name: string; nameFr?: string | null } | null;
  createdBy?: { id: string; name: string };
  versions?: DrawingVersionItem[];
  createdAt: string;
  updatedAt: string;
}

export async function listDrawings(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  projectId?: string;
  discipline?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.projectId) search.set('projectId', params.projectId);
  if (params?.discipline) search.set('discipline', params.discipline);
  return apiFetch<Paginated<DrawingItem>>(`/drawings?${search}`);
}

export async function createDrawing(
  data: {
    drawingNo: string;
    name: string;
    nameFr?: string;
    projectId: string;
    discipline: string;
    zoneId?: string;
  },
  file: File,
) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const form = new FormData();
  form.append('file', file);
  form.append('drawingNo', data.drawingNo);
  form.append('name', data.name);
  if (data.nameFr) form.append('nameFr', data.nameFr);
  form.append('projectId', data.projectId);
  form.append('discipline', data.discipline);
  if (data.zoneId) form.append('zoneId', data.zoneId);

  const res = await fetch(`${API_URL}/drawings`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '上传失败');
  }
  return json as { success: boolean; data: DrawingItem };
}

export function getDrawingPreviewUrl(id: string, version: number) {
  return `${API_URL}/drawings/${id}/versions/${version}/preview`;
}

export async function openDrawingPreview(id: string, version: number) {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(getDrawingPreviewUrl(id, version), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('预览失败');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export async function submitDrawingReview(id: string) {
  return apiFetch<DrawingItem>(`/drawings/${id}/submit-review`, {
    method: 'POST',
  });
}

export async function reviewDrawing(
  id: string,
  data: { result: 'approved' | 'rejected'; comment?: string },
) {
  return apiFetch<DrawingItem>(`/drawings/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function publishDrawing(id: string) {
  return apiFetch<DrawingItem>(`/drawings/${id}/publish`, { method: 'POST' });
}

// ── Translation ──

export const TRANSLATION_STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  auto: '自动译文',
  manual: '人工译文',
  completed: '已完成',
};

export interface TranslationVersionItem {
  id: string;
  source: 'auto' | 'manual';
  content: Record<string, string>;
  translatedBy?: { id: string; name: string };
  createdAt: string;
}

export interface TranslationTaskItem {
  id: string;
  code: string;
  sourceType: string;
  sourceId: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  statusLabel: string;
  assignee?: { id: string; name: string };
  versions?: TranslationVersionItem[];
  preferredContent?: Record<string, string> | null;
  preferredSource?: 'auto' | 'manual' | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlossaryTermItem {
  id: string;
  source: string;
  zh?: string | null;
  fr?: string | null;
  en?: string | null;
  category?: string | null;
}

export async function listTranslationTasks(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 20),
  });
  if (params?.q) search.set('q', params.q);
  if (params?.status) search.set('status', params.status);
  return apiFetch<Paginated<TranslationTaskItem>>(
    `/translation/tasks?${search}`,
  );
}

export async function getTranslationTask(id: string) {
  return apiFetch<TranslationTaskItem>(`/translation/tasks/${id}`);
}

export async function createTranslationTask(data: {
  sourceType: string;
  sourceId: string;
  sourceLang: string;
  targetLang: string;
  assigneeId?: string;
}) {
  return apiFetch<TranslationTaskItem>('/translation/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function triggerAutoTranslate(id: string) {
  return apiFetch<{ id: string; status: string; message: string }>(
    `/translation/tasks/${id}/auto-translate`,
    { method: 'POST' },
  );
}

export async function submitManualTranslation(
  id: string,
  content: Record<string, string>,
) {
  return apiFetch<TranslationTaskItem>(`/translation/tasks/${id}/manual`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
}

export async function listGlossaryTerms(params?: {
  page?: number;
  pageSize?: number;
  q?: string;
}) {
  const search = new URLSearchParams({
    page: String(params?.page ?? 1),
    pageSize: String(params?.pageSize ?? 50),
  });
  if (params?.q) search.set('q', params.q);
  return apiFetch<Paginated<GlossaryTermItem>>(
    `/translation/glossary?${search}`,
  );
}

export async function createGlossaryTerm(data: {
  source: string;
  zh?: string;
  fr?: string;
  en?: string;
  category?: string;
}) {
  return apiFetch<GlossaryTermItem>('/translation/glossary', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteGlossaryTerm(id: string) {
  return apiFetch<{ id: string }>(`/translation/glossary/${id}`, {
    method: 'DELETE',
  });
}
