import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { dashboardApi, alertsApi } from '../api/client';
import { DashboardData, Alert } from '../types';
import { formatBytes, formatUptime } from '../utils/formatters';
import { PoolWizardModal } from '../components/wizards/PoolWizardModal';
import { ShareWizardModal } from '../components/wizards/ShareWizardModal';
import {
  Cpu,
  Database,
  HardDrive,
  Activity,
  AlertTriangle,
  AlertCircle,
  Plus,
  Server,
  Share2,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardData | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Wizards
  const [poolWizardOpen, setPoolWizardOpen] = useState<boolean>(false);
  const [shareWizardOpen, setShareWizardOpen] = useState<boolean>(false);

  const fetchDashboard = async () => {
    try {
      const [dash, alerts] = await Promise.all([
        dashboardApi.get(),
        alertsApi.list(true),
      ]);
      setData(dash);
      setCriticalAlerts((alerts || []).filter((a) => a.level === 'critical' || a.level === 'warning'));
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const timer = setInterval(fetchDashboard, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const totalUsedStorage = (data?.pools || []).reduce((acc, p) => acc + (p.used_bytes || 0), 0);
  const totalCapacity = (data?.pools || []).reduce((acc, p) => acc + (p.total_bytes || 0), 0);
  const totalStoragePercent = totalCapacity > 0 ? (totalUsedStorage / totalCapacity) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('dashboard.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('dashboard.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-[11px] text-slate-400 font-medium">{t('dashboard.uptime')}</p>
            <p className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
              {formatUptime(data?.uptime_seconds || 0)}
            </p>
          </div>
          <button
            onClick={handleManualRefresh}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-brand-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlerts.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
              {criticalAlerts.length} Peringatan Sistem Membutuhkan Perhatian
            </h4>
            <div className="mt-1 space-y-1">
              {criticalAlerts.slice(0, 2).map((a) => (
                <p key={a.id} className="text-xs text-amber-800 dark:text-amber-300/90 truncate">
                  • <b>{a.source}</b>: {a.message}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('dashboard.cpuUsage')}
            </span>
            <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {data?.cpu_usage ? data.cpu_usage.toFixed(1) : '0.0'}%
            </span>
            <span className="text-xs text-slate-400 font-medium">Load Active</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                (data?.cpu_usage || 0) > 85 ? 'bg-rose-500' : (data?.cpu_usage || 0) > 65 ? 'bg-amber-500' : 'bg-sky-500'
              }`}
              style={{ width: `${Math.min(100, data?.cpu_usage || 0)}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('dashboard.memoryUsage')}
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {data?.memory_percent ? data.memory_percent.toFixed(1) : '0.0'}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              {formatBytes(data?.memory_used || 0)} / {formatBytes(data?.memory_total || 0)}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, data?.memory_percent || 0)}%` }}
            />
          </div>
        </div>

        {/* Total Storage Used */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('dashboard.totalStorage')}
            </span>
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
              {formatBytes(totalUsedStorage)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              of {formatBytes(totalCapacity)}
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-brand-500 transition-all duration-500"
              style={{ width: `${Math.min(100, totalStoragePercent)}%` }}
            />
          </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-600 to-sky-600 text-white shadow-md flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-sky-100">
              {t('dashboard.quickActions')}
            </h3>
            <p className="text-xs text-sky-100/80 mt-1">Operasi cepat manajemen penyimpanan</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setPoolWizardOpen(true)}
              className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Pool</span>
            </button>
            <button
              onClick={() => setShareWizardOpen(true)}
              className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all flex items-center space-x-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>SMB Share</span>
            </button>
            <button
              onClick={() => navigate('/users')}
              className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all flex items-center space-x-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>User</span>
            </button>
          </div>
        </div>
      </div>

      {/* Storage Pools Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Database className="w-4 h-4 text-brand-500" />
            <span>{t('dashboard.storagePools')}</span>
          </h2>
          <button
            onClick={() => navigate('/storage/pools')}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center space-x-1"
          >
            <span>Lihat Semua Pool</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {(!data?.pools || data.pools.length === 0) ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
            <Database className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t('dashboard.noPools')}
            </p>
            <button
              onClick={() => setPoolWizardOpen(true)}
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>{t('dashboard.createFirstPool')}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pools.map((pool) => {
              const isOnline = pool.health === 'ONLINE' || pool.status === 'ONLINE';
              return (
                <div
                  key={pool.id}
                  onClick={() => navigate('/storage/pools')}
                  className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-brand-500/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {pool.name}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isOnline
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      {pool.health || pool.status}
                    </span>
                  </div>

                  <div className="mt-4 flex justify-between items-baseline text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Terpakai:</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatBytes(pool.used_bytes)} / {formatBytes(pool.total_bytes)} ({pool.used_percent}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        pool.used_percent > 85 ? 'bg-rose-500' : pool.used_percent > 70 ? 'bg-amber-500' : 'bg-brand-500'
                      }`}
                      style={{ width: `${Math.min(100, pool.used_percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two Column Section: Services & Network */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Services Mini-List */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Server className="w-4 h-4 text-brand-500" />
              <span>{t('dashboard.systemServices')}</span>
            </h3>
            <button
              onClick={() => navigate('/system')}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Lihat Semua
            </button>
          </div>

          <div className="space-y-2">
            {(data?.services || []).slice(0, 5).map((srv) => (
              <div
                key={srv.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800/60 text-xs"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                  {srv.name}
                </span>
                <div className="flex items-center space-x-1.5">
                  {srv.status === 'running' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Running
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-[11px] font-semibold text-slate-500">
                        Stopped
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Network Interfaces */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-brand-500" />
              <span>{t('network.interfaces')}</span>
            </h3>
            <button
              onClick={() => navigate('/network')}
              className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
            >
              Konfigurasi
            </button>
          </div>

          <div className="space-y-2">
            {(data?.network_interfaces || []).map((iface) => (
              <div
                key={iface.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800/60 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {iface.name}
                  </span>
                  <span className="ml-2 font-mono text-slate-500 dark:text-slate-400">
                    {iface.ipv4_address || 'No IP'}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    iface.state === 'up'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {iface.state?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wizards */}
      <PoolWizardModal
        isOpen={poolWizardOpen}
        onClose={() => setPoolWizardOpen(false)}
        onSuccess={fetchDashboard}
      />
      <ShareWizardModal
        isOpen={shareWizardOpen}
        onClose={() => setShareWizardOpen(false)}
        onSuccess={fetchDashboard}
      />
    </div>
  );
};
