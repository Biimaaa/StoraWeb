import {
  User,
  Group,
  Disk,
  Pool,
  Dataset,
  Snapshot,
  Share,
  ShareSession,
  Alert,
  Job,
  DashboardData,
  SystemMetrics,
  NetworkInterface,
  Certificate,
  ScheduledTask,
  ReplicationTask,
  AuditLog,
  PaginatedResult,
  SystemInfo,
  ServiceStatus,
  VdevConfig,
} from '../types';

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('storaweb_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      ...this.getHeaders(),
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      localStorage.removeItem('storaweb_token');
      localStorage.removeItem('storaweb_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.detail || errorData.message || errorData.error || errorMsg;
      } catch {
        errorMsg = await response.text();
      }
      throw new Error(errorMsg);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }
    return (await response.text()) as unknown as T;
  }

  public get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' });
  }

  public post<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public put<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }

  public delete<T>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'DELETE',
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  }
}

export const api = new ApiClient();

// API Helper Endpoints
export const authApi = {
  login: (credentials: { username: string; password: string }) =>
    api.post<{ access_token: string; token_type: string }>('/api/v1/auth/login', credentials),
  me: () => api.get<User>('/api/v1/auth/me'),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post<{ message: string }>('/api/v1/auth/change-password', data),
  setupTotp: () => api.post<{ secret: string; uri: string }>('/api/v1/auth/totp/setup'),
  verifyTotp: (code: string) => api.post<{ valid: boolean; message: string }>('/api/v1/auth/totp/verify', { code }),
};

export const usersApi = {
  listUsers: () => api.get<User[]>('/api/v1/users/'),
  createUser: (data: any) => api.post<User>('/api/v1/users/', data),
  getUser: (id: number) => api.get<User>(`/api/v1/users/${id}`),
  updateUser: (id: number, data: any) => api.put<User>(`/api/v1/users/${id}`, data),
  deleteUser: (id: number) => api.delete<{ message: string }>(`/api/v1/users/${id}`),
  listGroups: () => api.get<Group[]>('/api/v1/users/groups/'),
  createGroup: (data: { name: string; description?: string }) => api.post<Group>('/api/v1/users/groups/', data),
  updateGroup: (id: number, data: { name?: string; description?: string }) =>
    api.put<Group>(`/api/v1/users/groups/${id}`, data),
  deleteGroup: (id: number) => api.delete<{ message: string }>(`/api/v1/users/groups/${id}`),
};

export const disksApi = {
  list: () => api.get<Disk[]>('/api/v1/disks/'),
  scan: () => api.post<Disk[]>('/api/v1/disks/scan'),
  get: (id: number) => api.get<Disk>(`/api/v1/disks/${id}`),
  getSmart: (id: number) => api.get<any>(`/api/v1/disks/${id}/smart`),
  runSmartTest: (id: number, testType: 'short' | 'long' = 'short') =>
    api.post<any>(`/api/v1/disks/${id}/smart-test?test_type=${testType}`, { test_type: testType }),
};

export const poolsApi = {
  list: () => api.get<Pool[]>('/api/v1/pools/'),
  create: (data: { name: string; topology: { data: VdevConfig[] }; encryption?: boolean }) =>
    api.post<Pool>('/api/v1/pools/', data),
  get: (id: number) => api.get<Pool>(`/api/v1/pools/${id}`),
  update: (id: number, data: any) => api.put<Pool>(`/api/v1/pools/${id}`, data),
  destroy: (id: number, confirmName: string) =>
    api.delete<{ message: string }>(`/api/v1/pools/${id}`, { confirm_name: confirmName }),
  scrub: (id: number) => api.post<Job>(`/api/v1/pools/${id}/scrub`),
  expand: (id: number, vdev: VdevConfig) => api.post<Pool>(`/api/v1/pools/${id}/expand`, vdev),
  replaceDisk: (id: number, oldDiskId: number, newDiskId: number) =>
    api.post<Job>(`/api/v1/pools/${id}/replace-disk`, { old_disk_id: oldDiskId, new_disk_id: newDiskId }),
  export: (id: number) => api.post<{ message: string }>(`/api/v1/pools/${id}/export`),
};

export const datasetsApi = {
  list: (poolId?: number) =>
    api.get<Dataset[]>(poolId ? `/api/v1/datasets/?pool_id=${poolId}` : '/api/v1/datasets/'),
  create: (data: any) => api.post<Dataset>('/api/v1/datasets/', data),
  get: (id: number) => api.get<Dataset>(`/api/v1/datasets/${id}`),
  update: (id: number, data: any) => api.put<Dataset>(`/api/v1/datasets/${id}`, data),
  delete: (id: number, confirmName: string) =>
    api.delete<{ message: string }>(`/api/v1/datasets/${id}`, { confirm_name: confirmName }),
};

export const snapshotsApi = {
  list: (datasetId?: number) =>
    api.get<Snapshot[]>(datasetId ? `/api/v1/snapshots/?dataset_id=${datasetId}` : '/api/v1/snapshots/'),
  create: (data: { dataset_id: number; name?: string }) => api.post<Snapshot>('/api/v1/snapshots/', data),
  delete: (id: number) => api.delete<{ message: string }>(`/api/v1/snapshots/${id}`),
  rollback: (id: number, confirmName: string) =>
    api.post<{ message: string }>(`/api/v1/snapshots/${id}/rollback`, { confirm_name: confirmName }),
};

export const sharesApi = {
  list: (protocol?: 'smb' | 'nfs') =>
    api.get<Share[]>(protocol ? `/api/v1/shares/?protocol=${protocol}` : '/api/v1/shares/'),
  create: (data: any) => api.post<Share>('/api/v1/shares/', data),
  get: (id: number) => api.get<Share>(`/api/v1/shares/${id}`),
  update: (id: number, data: any) => api.put<Share>(`/api/v1/shares/${id}`, data),
  delete: (id: number) => api.delete<{ message: string }>(`/api/v1/shares/${id}`),
  enable: (id: number) => api.post<Share>(`/api/v1/shares/${id}/enable`),
  disable: (id: number) => api.post<Share>(`/api/v1/shares/${id}/disable`),
  sessions: (protocol: 'smb' | 'nfs' = 'smb') =>
    api.get<ShareSession[]>(`/api/v1/shares/sessions?protocol=${protocol}`),
  reload: (protocol?: 'smb' | 'nfs') =>
    api.post<{ message: string }>(protocol ? `/api/v1/shares/reload?protocol=${protocol}` : '/api/v1/shares/reload'),
};

export const dashboardApi = {
  get: () => api.get<DashboardData>('/api/v1/dashboard/'),
  metrics: () => api.get<SystemMetrics>('/api/v1/dashboard/metrics'),
  metricsHistory: () => api.get<{ cpu: any[]; memory: any[] }>('/api/v1/dashboard/metrics/history'),
};

export const alertsApi = {
  list: (activeOnly = true, level?: string) => {
    let url = `/api/v1/alerts/?active_only=${activeOnly}`;
    if (level) url += `&level=${level}`;
    return api.get<Alert[]>(url);
  },
  dismiss: (id: number) => api.post<Alert>(`/api/v1/alerts/${id}/dismiss`),
  dismissAll: () => api.post<{ message: string }>('/api/v1/alerts/dismiss-all'),
};

export const jobsApi = {
  list: (status?: string, limit = 50) => {
    let url = `/api/v1/jobs/?limit=${limit}`;
    if (status) url += `&status=${status}`;
    return api.get<Job[]>(url);
  },
  get: (id: number) => api.get<Job>(`/api/v1/jobs/${id}`),
};

export const tasksApi = {
  listScheduled: () => api.get<ScheduledTask[]>('/api/v1/tasks/scheduled'),
  createScheduled: (data: any) => api.post<ScheduledTask>('/api/v1/tasks/scheduled', data),
  updateScheduled: (id: number, data: any) => api.put<ScheduledTask>(`/api/v1/tasks/scheduled/${id}`, data),
  deleteScheduled: (id: number) => api.delete<{ message: string }>(`/api/v1/tasks/scheduled/${id}`),
  runScheduled: (id: number) => api.post<Job>(`/api/v1/tasks/scheduled/${id}/run`),

  listReplication: () => api.get<ReplicationTask[]>('/api/v1/tasks/replication'),
  createReplication: (data: any) => api.post<ReplicationTask>('/api/v1/tasks/replication', data),
  updateReplication: (id: number, data: any) => api.put<ReplicationTask>(`/api/v1/tasks/replication/${id}`, data),
  deleteReplication: (id: number) => api.delete<{ message: string }>(`/api/v1/tasks/replication/${id}`),
  runReplication: (id: number) => api.post<Job>(`/api/v1/tasks/replication/${id}/run`),
};

export const networkApi = {
  listInterfaces: () => api.get<NetworkInterface[]>('/api/v1/network/interfaces'),
  scanInterfaces: () => api.post<NetworkInterface[]>('/api/v1/network/interfaces/scan'),
  updateInterface: (id: number, data: any) => api.put<NetworkInterface>(`/api/v1/network/interfaces/${id}`, data),
  getDns: () => api.get<{ servers: string[]; domain: string }>('/api/v1/network/dns'),
  updateDns: (data: { servers: string[]; domain: string }) =>
    api.put<{ message: string }>('/api/v1/network/dns', data),
  getHostname: () => api.get<{ hostname: string }>('/api/v1/network/hostname'),
  updateHostname: (hostname: string) =>
    api.put<{ message: string }>('/api/v1/network/hostname', { hostname }),
  listCertificates: () => api.get<Certificate[]>('/api/v1/network/certificates'),
  createCertificate: (data: any) => api.post<Certificate>('/api/v1/network/certificates', data),
  deleteCertificate: (id: number) => api.delete<{ message: string }>(`/api/v1/network/certificates/${id}`),
};

export const systemApi = {
  getInfo: () => api.get<SystemInfo>('/api/v1/system/info'),
  getServices: () => api.get<ServiceStatus[]>('/api/v1/system/services'),
  restartService: (name: string) => api.post<{ message: string }>(`/api/v1/system/services/${name}/restart`),
  reboot: () => api.post<{ message: string }>('/api/v1/system/reboot'),
  shutdown: () => api.post<{ message: string }>('/api/v1/system/shutdown'),
  setup: (data: any) => api.post<{ message: string }>('/api/v1/system/setup', data),
  getConfig: () => api.get<Record<string, any>>('/api/v1/system/config'),
  updateConfig: (key: string, value: any) =>
    api.put<{ message: string }>(`/api/v1/system/config/${key}`, { value }),
};

export const auditApi = {
  list: (page = 1, perPage = 50, filters: Record<string, any> = {}) => {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: perPage.toString(),
      ...filters,
    });
    return api.get<PaginatedResult<AuditLog>>(`/api/v1/audit/?${params.toString()}`);
  },
  exportUrl: (format = 'csv') => `/api/v1/audit/export?format=${format}`,
};
