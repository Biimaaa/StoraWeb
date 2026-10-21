import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { systemApi, auditApi } from '../api/client';
import { SystemInfo, ServiceStatus, AuditLog } from '../types';
import { formatUptime, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import {
  Cpu,
  Server,
  Activity,
  RotateCcw,
  Power,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Clock,
  Terminal,
} from 'lucide-react';

export const SystemPage: React.FC = () => {
  const { t } = useI18n();

  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [restartingService, setRestartingService] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Reboot & Shutdown Modals
  const [rebootModalOpen, setRebootModalOpen] = useState<boolean>(false);
  const [shutdownModalOpen, setShutdownModalOpen] = useState<boolean>(false);
  const [executingPower, setExecutingPower] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const [info, srvList, auditRes] = await Promise.all([
        systemApi.getInfo(),
        systemApi.getServices(),
        auditApi.list(1, 20),
      ]);
      setSysInfo(info);
      setServices(srvList || []);
      setAuditLogs(auditRes?.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRestartService = async (serviceName: string) => {
    setRestartingService(serviceName);
    setActionFeedback(null);
    try {
      const res = await systemApi.restartService(serviceName);
      setActionFeedback(res.message);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal me-restart service');
    } finally {
      setRestartingService(null);
    }
  };

  const handleReboot = async () => {
    setExecutingPower(true);
    try {
      await systemApi.reboot();
      setRebootModalOpen(false);
      alert('Sistem sedang melakukan reboot. Halaman akan terputus sesaat.');
    } catch (err: any) {
      alert(err.message || 'Gagal melakukan reboot');
    } finally {
      setExecutingPower(false);
    }
  };

  const handleShutdown = async () => {
    setExecutingPower(true);
    try {
      await systemApi.shutdown();
      setShutdownModalOpen(false);
      alert('Sistem sedang dimatikan (power off).');
    } catch (err: any) {
      alert(err.message || 'Gagal mematikan sistem');
    } finally {
      setExecutingPower(false);
    }
  };

  const handleExportCsv = () => {
    const token = localStorage.getItem('storaweb_token');
    window.open(`/api/v1/audit/export?format=csv&token=${token || ''}`, '_blank');
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('system.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('system.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setRebootModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-400 text-xs font-semibold shadow-sm transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('system.reboot')}</span>
          </button>

          <button
            onClick={() => setShutdownModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 text-xs font-semibold shadow-sm transition-colors"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{t('system.shutdown')}</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs flex justify-between items-center">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* System Specs Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block">{t('system.version')}</span>
          <p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {sysInfo?.app_name || 'StoraWeb'} v{sysInfo?.version || '1.0.0'}
          </p>
          <span className="text-[11px] text-brand-600 dark:text-brand-400 font-medium">Production Build</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block">{t('system.os')} & Host</span>
          <p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {sysInfo?.os_name || 'Linux'} ({sysInfo?.hostname || 'nas'})
          </p>
          <span className="text-[11px] text-slate-500 font-mono">Arch: {sysInfo?.architecture || 'x86_64'}</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block">{t('system.kernel')}</span>
          <p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 truncate">
            {sysInfo?.kernel || '6.1.0-custom'}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">OpenZFS 2.2.x</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400 block">{t('system.uptime')}</span>
          <p className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {formatUptime(sysInfo?.uptime_seconds || 0)}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">System Online</span>
        </div>
      </div>

      {/* Services Status Table */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2.5">
          <Server className="w-5 h-5 text-brand-500" />
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {t('system.services')}
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Nama Layanan</th>
                  <th className="py-3 px-4">{t('common.status')}</th>
                  <th className="py-3 px-4">Auto-Start</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {services.map((srv) => (
                  <tr key={srv.name} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans">
                      {srv.name}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="flex items-center space-x-1.5">
                        {srv.status === 'running' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              Running
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-500">Stopped</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500">Enabled (systemd)</td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        onClick={() => handleRestartService(srv.name)}
                        disabled={restartingService === srv.name}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] inline-flex items-center space-x-1 disabled:opacity-50"
                      >
                        <RotateCcw
                          className={`w-3 h-3 ${restartingService === srv.name ? 'animate-spin' : ''}`}
                        />
                        <span>{t('system.restartService')}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Security Audit Trail Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Terminal className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('system.auditLogs')}
            </h2>
          </div>

          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('system.exportCsv')}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Waktu</th>
                  <th className="py-3 px-4">Aktor / User</th>
                  <th className="py-3 px-4">Aksi</th>
                  <th className="py-3 px-4">Sumber Daya</th>
                  <th className="py-3 px-4">IP Klien</th>
                  <th className="py-3 px-4">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      Belum ada catatan aktivitas.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans">
                        {log.actor}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 uppercase text-[10px] font-bold">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        {log.resource_type} {log.resource_id ? `#${log.resource_id}` : ''}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                      <td className="py-2.5 px-4 text-slate-400 font-sans truncate max-w-xs text-[11px]">
                        {log.detail ? JSON.stringify(log.detail) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Reboot Modal */}
      <Modal
        isOpen={rebootModalOpen}
        onClose={() => setRebootModalOpen(false)}
        title={t('system.reboot')}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('system.confirmReboot')}
          </p>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setRebootModalOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleReboot}
              disabled={executingPower}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20 disabled:opacity-50"
            >
              {executingPower ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>{t('system.reboot')}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Shutdown Modal */}
      <Modal
        isOpen={shutdownModalOpen}
        onClose={() => setShutdownModalOpen(false)}
        title={t('system.shutdown')}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t('system.confirmShutdown')}
          </p>
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShutdownModalOpen(false)}
              className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleShutdown}
              disabled={executingPower}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 disabled:opacity-50"
            >
              {executingPower ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
              <span>{t('system.shutdown')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
