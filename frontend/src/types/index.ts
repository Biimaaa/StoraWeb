export type UserRole = 'admin' | 'operator' | 'readonly' | 'share_admin';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  role: UserRole;
  source: string;
  totp_enabled: boolean;
  home_directory?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  source: string;
  created_at: string;
  member_count?: number;
}

export type DiskType = 'NVMe' | 'SSD' | 'HDD' | 'Virtual';
export type DiskStatus = 'ONLINE' | 'AVAILABLE' | 'OFFLINE' | 'FAILED' | 'SPARE';
export type SmartStatus = 'PASSED' | 'FAILED' | 'UNKNOWN' | 'TESTING';

export interface Disk {
  id: number;
  device_name: string;
  serial: string | null;
  model: string | null;
  capacity_bytes: number;
  capacity_human?: string;
  disk_type: string | null;
  temperature: number | null;
  smart_status: string | null;
  pool_id: number | null;
  role: string | null;
  status: string;
}

export type VdevType = 'stripe' | 'mirror' | 'raidz1' | 'raidz2' | 'raidz3';
export type VdevPurpose = 'data' | 'cache' | 'log' | 'spare' | 'special';

export interface VdevConfig {
  vdev_type: VdevType;
  disk_ids: number[];
  purpose?: VdevPurpose;
}

export interface PoolTopology {
  data: VdevConfig[];
  cache?: VdevConfig[];
  log?: VdevConfig[];
  spare?: VdevConfig[];
  special?: VdevConfig[];
}

export type PoolStatus = 'ONLINE' | 'DEGRADED' | 'FAULTED' | 'OFFLINE' | 'UNAVAIL';

export interface Pool {
  id: number;
  name: string;
  topology?: Record<string, any> | null;
  status: string;
  total_bytes: number;
  used_bytes: number;
  free_bytes: number;
  fragmentation?: number | null;
  health: string;
  scrub_schedule?: string | null;
  last_scrub?: string | null;
  scrub_errors?: number | null;
  autotrim?: boolean;
  created_at: string;
  used_percent?: number;
  disk_count?: number;
  live_status?: any;
}

export type DatasetType = 'filesystem' | 'zvol';
export type DatasetPreset = 'general' | 'smb' | 'app' | 'media' | 'iscsi';

export interface Dataset {
  id: number;
  name: string;
  pool_id: number;
  parent_id?: number | null;
  dataset_type: DatasetType | string;
  preset?: DatasetPreset | string | null;
  compression: string;
  dedup: boolean;
  sync_mode: 'standard' | 'always' | 'disabled' | string;
  record_size: number;
  quota_bytes?: number | null;
  reservation_bytes?: number | null;
  encryption: boolean;
  used_bytes: number;
  available_bytes: number;
  mountpoint?: string | null;
  created_at: string;
  children_count?: number;
  snapshot_count?: number;
  shares?: Share[];
}

export interface Snapshot {
  id: number;
  dataset_id: number;
  name: string;
  size_bytes: number;
  referenced_bytes?: number;
  created_at: string;
}

export interface SMBSettings {
  guest_ok: boolean;
  readonly: boolean;
  browsable: boolean;
  recycle_bin: boolean;
  time_machine: boolean;
  allowed_users?: string[] | null;
  denied_users?: string[] | null;
}

export interface NFSSettings {
  hosts: string[];
  maproot_user?: string | null;
  maproot_group?: string | null;
  security: string[];
  nfsv4: boolean;
}

export type ShareProtocol = 'smb' | 'nfs';

export interface Share {
  id: number;
  name: string;
  protocol: ShareProtocol;
  dataset_id: number;
  path?: string | null;
  enabled: boolean;
  settings?: Record<string, any> | null;
  created_at: string;
  network_path?: string;
}

export interface ShareSession {
  session_id: string;
  username: string;
  client_ip: string;
  share_name: string;
  connected_at: string;
  protocol: string;
}

export type AlertLevel = 'info' | 'warning' | 'critical' | 'error';

export interface Alert {
  id: number;
  level: AlertLevel | string;
  source: string;
  message: string;
  detail?: string | null;
  dismissed: boolean;
  dismissed_by?: string | null;
  dismissed_at?: string | null;
  created_at: string;
}

export interface NotificationChannel {
  id: number;
  name: string;
  channel_type: 'email' | 'webhook' | 'telegram' | 'slack' | string;
  config: Record<string, any>;
  enabled: boolean;
  min_level: string;
  created_at: string;
}

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: number;
  job_type: string;
  description: string;
  status: JobStatus | string;
  progress: number;
  result?: Record<string, any> | null;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'error' | string;
  enabled: boolean;
}

export interface NetworkInterfaceSummary {
  name: string;
  ipv4_address?: string | null;
  state: string;
  speed?: string | null;
}

export interface PoolSummary {
  id: number;
  name: string;
  status: string;
  health: string;
  used_percent: number;
  total_bytes: number;
  used_bytes: number;
}

export interface DashboardData {
  hostname: string;
  uptime_seconds: number;
  cpu_usage: number;
  memory_total: number;
  memory_used: number;
  memory_percent: number;
  pools: PoolSummary[];
  alerts_active: number;
  services: ServiceStatus[];
  network_interfaces: NetworkInterfaceSummary[];
}

export interface SystemMetrics {
  timestamp: string;
  cpu_percent: number;
  memory_percent: number;
  memory_used_bytes: number;
  swap_percent: number;
  load_avg: number[];
  disk_io: Record<string, any>;
  network_io: Record<string, any>;
  arc_stats?: Record<string, any> | null;
}

export interface NetworkInterface {
  id: number;
  name: string;
  interface_type: string;
  ipv4_address?: string | null;
  ipv4_netmask?: string | null;
  gateway?: string | null;
  dns_servers: string[];
  mtu: number;
  dhcp: boolean;
  state?: string | null;
  speed?: string | null;
  mac_address?: string | null;
  created_at: string;
}

export interface Certificate {
  id: number;
  name: string;
  cert_type: string;
  issuer?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  san: string[];
  is_default: boolean;
  created_at: string;
}

export interface ScheduledTask {
  id: number;
  name: string;
  task_type: string;
  schedule: string;
  config: Record<string, any>;
  enabled: boolean;
  last_run?: string | null;
  next_run?: string | null;
  last_result?: string | null;
  created_at: string;
}

export interface ReplicationTask {
  id: number;
  name: string;
  source_dataset_id: number;
  direction: 'push' | 'pull';
  transport: 'ssh' | 'local';
  target_host: string;
  target_port: number;
  target_dataset: string;
  recursive: boolean;
  incremental: boolean;
  schedule: string;
  retention_policy: string;
  retention_count: number;
  enabled: boolean;
  last_run?: string | null;
  last_result?: string | null;
  last_snapshot?: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  timestamp: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  detail?: Record<string, any> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SystemInfo {
  app_name: string;
  version: string;
  os_name: string;
  os_release: string;
  os_version: string;
  kernel: string;
  architecture: string;
  processor: string;
  python_version: string;
  uptime_seconds: number;
  hostname: string;
}
