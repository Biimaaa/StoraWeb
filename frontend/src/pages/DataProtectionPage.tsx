import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { tasksApi, datasetsApi } from '../api/client';
import { ScheduledTask, ReplicationTask, Dataset } from '../types';
import { formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import {
  ShieldCheck,
  RefreshCw,
  Plus,
  Play,
  Trash2,
  Clock,
  ArrowRight,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
} from 'lucide-react';

export const DataProtectionPage: React.FC = () => {
  const { t } = useI18n();

  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);
  const [replicationTasks, setReplicationTasks] = useState<ReplicationTask[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Create Scheduled Task Modal
  const [createSchedOpen, setCreateSchedOpen] = useState<boolean>(false);
  const [schedName, setSchedName] = useState<string>('');
  const [taskType, setTaskType] = useState<string>('scrub');
  const [scheduleCron, setScheduleCron] = useState<string>('0 0 * * 0'); // Weekly Sunday midnight
  const [creatingSched, setCreatingSched] = useState<boolean>(false);

  // Create Replication Task Modal
  const [createReplOpen, setCreateReplOpen] = useState<boolean>(false);
  const [replName, setReplName] = useState<string>('');
  const [sourceDsId, setSourceDsId] = useState<number | ''>('');
  const [targetHost, setTargetHost] = useState<string>('192.168.1.100');
  const [targetPort, setTargetPort] = useState<number>(22);
  const [targetDs, setTargetDs] = useState<string>('backup-pool/replicated');
  const [transport, setTransport] = useState<'ssh' | 'local'>('ssh');
  const [direction, setDirection] = useState<'push' | 'pull'>('push');
  const [replCron, setReplCron] = useState<string>('0 2 * * *'); // Daily 2 AM
  const [creatingRepl, setCreatingRepl] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const [schedList, replList, dsList] = await Promise.all([
        tasksApi.listScheduled(),
        tasksApi.listReplication(),
        datasetsApi.list(),
      ]);
      setScheduledTasks(schedList || []);
      setReplicationTasks(replList || []);
      setDatasets(dsList || []);
      if (dsList && dsList.length > 0 && !sourceDsId) {
        setSourceDsId(dsList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunScheduled = async (task: ScheduledTask) => {
    try {
      const job = await tasksApi.runScheduled(task.id);
      setMsg(`Tugas '${task.name}' mulai berjalan di latar belakang (Job #${job.id}).`);
      setTimeout(() => setMsg(null), 3000);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menjalankan tugas');
    }
  };

  const handleDeleteScheduled = async (task: ScheduledTask) => {
    if (!window.confirm(`Hapus tugas terjadwal '${task.name}'?`)) return;
    try {
      await tasksApi.deleteScheduled(task.id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus tugas');
    }
  };

  const handleCreateScheduled = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSched(true);
    try {
      await tasksApi.createScheduled({
        name: schedName.trim(),
        task_type: taskType,
        schedule: scheduleCron.trim(),
        enabled: true,
      });
      setCreateSchedOpen(false);
      setSchedName('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal membuat tugas terjadwal');
    } finally {
      setCreatingSched(false);
    }
  };

  const handleRunReplication = async (task: ReplicationTask) => {
    try {
      const job = await tasksApi.runReplication(task.id);
      setMsg(`Replikasi '${task.name}' dimulai (Job #${job.id}).`);
      setTimeout(() => setMsg(null), 3000);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menjalankan replikasi');
    }
  };

  const handleDeleteReplication = async (task: ReplicationTask) => {
    if (!window.confirm(`Hapus tugas replikasi '${task.name}'?`)) return;
    try {
      await tasksApi.deleteReplication(task.id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus replikasi');
    }
  };

  const handleCreateReplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceDsId) return;
    setCreatingRepl(true);
    try {
      await tasksApi.createReplication({
        name: replName.trim(),
        source_dataset_id: Number(sourceDsId),
        direction,
        transport,
        target_host: targetHost.trim(),
        target_port: targetPort,
        target_dataset: targetDs.trim(),
        schedule: replCron.trim(),
        enabled: true,
      });
      setCreateReplOpen(false);
      setReplName('');
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal membuat tugas replikasi');
    } finally {
      setCreatingRepl(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {t('dataProtection.title')}
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {t('dataProtection.subtitle')}
        </p>
      </div>

      {msg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs">
          {msg}
        </div>
      )}

      {/* 1. Scheduled Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Clock className="w-5 h-5 text-brand-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('dataProtection.scheduledTasks')}
            </h2>
          </div>
          <button
            onClick={() => setCreateSchedOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('dataProtection.createTask')}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">{t('common.name')}</th>
                  <th className="py-3 px-4">{t('dataProtection.taskType')}</th>
                  <th className="py-3 px-4">{t('dataProtection.schedule')}</th>
                  <th className="py-3 px-4">{t('dataProtection.lastRun')}</th>
                  <th className="py-3 px-4">{t('common.status')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {scheduledTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      Belum ada tugas terjadwal.
                    </td>
                  </tr>
                ) : (
                  scheduledTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans">
                        {task.name}
                      </td>
                      <td className="py-3 px-4 uppercase text-[11px] font-bold text-brand-600 dark:text-brand-400">
                        {task.task_type}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {task.schedule}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {formatDate(task.last_run)}
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            task.enabled
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {task.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 font-sans">
                        <button
                          onClick={() => handleRunScheduled(task)}
                          title={t('common.runNow')}
                          className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 hover:bg-brand-100 font-semibold text-[11px] inline-flex items-center space-x-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>{t('common.run')}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteScheduled(task)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Replication Tasks Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <RefreshCw className="w-5 h-5 text-sky-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t('dataProtection.replicationTasks')}
            </h2>
          </div>
          <button
            onClick={() => setCreateReplOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('dataProtection.createReplication')}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">{t('common.name')}</th>
                  <th className="py-3 px-4">Dataset Asal</th>
                  <th className="py-3 px-4">{t('dataProtection.targetHost')}</th>
                  <th className="py-3 px-4">{t('dataProtection.targetDataset')}</th>
                  <th className="py-3 px-4">Jadwal</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {replicationTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      Belum ada tugas replikasi yang dikonfigurasi.
                    </td>
                  </tr>
                ) : (
                  replicationTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans">
                        {task.name}
                      </td>
                      <td className="py-3 px-4 text-brand-600 dark:text-brand-400">
                        Dataset #{task.source_dataset_id}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {task.target_host}:{task.target_port} ({task.transport})
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {task.target_dataset}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{task.schedule || 'Manual'}</td>
                      <td className="py-3 px-4 text-right space-x-2 font-sans">
                        <button
                          onClick={() => handleRunReplication(task)}
                          className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 hover:bg-sky-100 font-semibold text-[11px] inline-flex items-center space-x-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>{t('common.run')}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteReplication(task)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create Scheduled Task Modal */}
      <Modal
        isOpen={createSchedOpen}
        onClose={() => setCreateSchedOpen(false)}
        title={t('dataProtection.createTask')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateScheduled} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Tugas
            </label>
            <input
              type="text"
              required
              value={schedName}
              onChange={(e) => setSchedName(e.target.value)}
              placeholder="Scrub Mingguan Pool Utama"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('dataProtection.taskType')}
            </label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            >
              <option value="scrub">ZFS Pool Scrub</option>
              <option value="snapshot">Periodic Auto-Snapshot</option>
              <option value="smart">SMART Self-Test</option>
              <option value="trim">SSD Autotrim</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('dataProtection.schedule')} (Cron Format)
            </label>
            <input
              type="text"
              required
              value={scheduleCron}
              onChange={(e) => setScheduleCron(e.target.value)}
              placeholder="0 0 * * 0"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">contoh: "0 0 * * 0" = Setiap Minggu tengah malam</p>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCreateSchedOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={creatingSched}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {creatingSched ? 'Menyimpan...' : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Replication Task Modal */}
      <Modal
        isOpen={createReplOpen}
        onClose={() => setCreateReplOpen(false)}
        title={t('dataProtection.createReplication')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateReplication} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Tugas Replikasi
            </label>
            <input
              type="text"
              required
              value={replName}
              onChange={(e) => setReplName(e.target.value)}
              placeholder="Offsite Backup ke Server Disaster Recovery"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('dataProtection.sourceDataset')}
              </label>
              <select
                value={sourceDsId}
                onChange={(e) => setSourceDsId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Transport
              </label>
              <select
                value={transport}
                onChange={(e) => setTransport(e.target.value as 'ssh' | 'local')}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
              >
                <option value="ssh">SSH (Encrypted Remote)</option>
                <option value="local">Local ZFS Pipe</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Host IP / Domain
              </label>
              <input
                type="text"
                required
                value={targetHost}
                onChange={(e) => setTargetHost(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Port SSH
              </label>
              <input
                type="number"
                value={targetPort}
                onChange={(e) => setTargetPort(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target ZFS Dataset Path
            </label>
            <input
              type="text"
              required
              value={targetDs}
              onChange={(e) => setTargetDs(e.target.value)}
              placeholder="remotepool/archive"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Jadwal Otomatis (Cron)
            </label>
            <input
              type="text"
              required
              value={replCron}
              onChange={(e) => setReplCron(e.target.value)}
              placeholder="0 2 * * *"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCreateReplOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={creatingRepl}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/20 disabled:opacity-50"
            >
              {creatingRepl ? 'Menyimpan...' : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
