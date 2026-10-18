import { Lead, Task, Interaction, Activity, DashboardStats, PipelineSnapshotStage, User } from '../types/crm';

class ApiError extends Error {
  code: string;
  details?: any;
  status: number;

  constructor(message: string, code = 'API_ERROR', status = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export { ApiError };

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const storedToken = localStorage.getItem('emperor_token');
  if (storedToken) {
    headers['Authorization'] = `Bearer ${storedToken}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else if (contentType.includes('text/csv')) {
    data = await response.text();
    return data as T;
  }

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || 'An error occurred';
    const errorCode = data?.error || 'UNKNOWN_ERROR';

    if (errorCode === 'SESSION_EXPIRED' || response.status === 401) {
      window.dispatchEvent(new CustomEvent('emperor:session-expired', { detail: { message: errorMsg } }));
    }

    throw new ApiError(errorMsg, errorCode, response.status, data?.details);
  }

  return data as T;
}

export const api = {
  // Auth
  register: (body: any) => request<{ user: User; token: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request<{ user: User; token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  getSession: () => request<{ user: User }>('/auth/session'),
  forgotPassword: (email: string) => request<{ success: boolean; message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (body: any) => request<{ success: boolean; message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),

  // Leads
  getLeads: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        query.set(k, String(v));
      }
    }
    return request<{ leads: Lead[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>(`/leads?${query.toString()}`);
  },
  getLead: (id: string) => request<Lead & { interactions: Interaction[]; tasks: Task[]; activities: Activity[]; user: User }>(`/leads/${id}`),
  createLead: (data: any) => request<Lead>('/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateLead: (id: string, data: any) => request<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  moveLeadStage: (id: string, body: { stage: string; wonValue?: number; outcomeReason?: string; reopenConfirmed?: boolean }) =>
    request<Lead>(`/leads/${id}/stage`, { method: 'POST', body: JSON.stringify(body) }),
  archiveLead: (id: string) => request<Lead>(`/leads/${id}/archive`, { method: 'POST' }),
  restoreLead: (id: string) => request<Lead>(`/leads/${id}/restore`, { method: 'POST' }),
  updateLeadNotes: (id: string, notes: string) => request<Lead>(`/leads/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),

  // Interactions
  logInteraction: (leadId: string, data: any) => request<Interaction>(`/leads/${leadId}/interactions`, { method: 'POST', body: JSON.stringify(data) }),
  deleteInteraction: (id: string) => request<{ success: boolean }>(`/interactions/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (filter = 'all') => request<{ tasks: Task[]; counts: { overdue: number; today: number; upcoming: number; completed: number; totalOpen: number } }>(`/tasks?filter=${filter}`),
  createTask: (data: any) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  completeTask: (id: string) => request<Task>(`/tasks/${id}/complete`, { method: 'POST' }),
  reopenTask: (id: string) => request<Task>(`/tasks/${id}/reopen`, { method: 'POST' }),
  cancelTask: (id: string) => request<Task>(`/tasks/${id}/cancel`, { method: 'POST' }),
  deleteTask: (id: string) => request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  // Dashboard & Reports
  getDashboard: () =>
    request<{
      stats: DashboardStats;
      todayFollowUps: Task[];
      pipelineSnapshot: PipelineSnapshotStage[];
      recentActivity: Activity[];
    }>('/dashboard'),
  getReports: () => request<any>('/reports'),

  // Settings
  getSettings: () => request<any>('/settings'),
  updateProfile: (data: any) => request<any>('/settings/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (data: any) => request<{ success: boolean; message: string }>('/settings/change-password', { method: 'POST', body: JSON.stringify(data) }),
  updatePreferences: (data: any) => request<any>('/settings/preferences', { method: 'PATCH', body: JSON.stringify(data) }),
  exportData: (format: 'json' | 'csv') => request<any>(`/settings/export?format=${format}`),
  deleteAccount: (data: any) => request<{ success: boolean; message: string }>('/settings/delete-account', { method: 'POST', body: JSON.stringify(data) }),

  // Admin
  getAdminUsers: () => request<any[]>('/admin/users'),
  getAdminAccess: () => request<any[]>('/admin/access'),
  getAdminAudit: () => request<any[]>('/admin/audit'),
};
