import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { poolsApi, disksApi } from '../api/client';
import { Pool, Disk } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import { PoolWizardModal } from '../components/wizards/PoolWizardModal';
import { Modal } from '../components/common/Modal';
import {
  Database,
  Plus,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Trash2,
  Share2,
  Loader2,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const PoolsPage: React.FC = () => {
  const { t } = useI18n();

  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);

  // Destroy confirmation modal
  const [destroyModalOpen, setDestroyModalOpen] = useState<boolean>(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [confirmName, setConfirmName] = useState<string>('');
  const [destroying, setDestroying] = useState<boolean>(false);
  const [destroyError, setDestroyError] = useState<string | null>(null);

  // Replace disk modal
  const [replaceModalOpen, setReplaceModalOpen] = useState<boolean>(false);
  const [allDisks, setAllDisks] = useState<Disk[]>([]);
  const [oldDiskId, setOldDiskId] = useState<number | ''>('');
  const [newDiskId, setNewDiskId] = useState<number | ''>('');
  const [replacing, setReplacing] = useState<boolean>(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const fetchPools = async () => {
    try {
      const data = await poolsApi.list();
      setPools(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, []);

  const handleStartScrub = async (pool: Pool) => {
    try {
      await poolsApi.scrub(pool.id);
      setStatusMsg({
        type: 'success',
        text: `Pemeriksaan Scrub untuk pool '${pool.name}' berhasil dijalankan di latar belakang.`,
      });
      fetchPools();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal memulai scrub' });
    }
  };

  const handleExport = async (pool: Pool) => {
    if (!window.confirm(`Ekspor pool '${pool.name}'? Ini akan melepas mount point pool.`)) return;
    try {
      await poolsApi.export(pool.id);
      setStatusMsg({ type: 'success', text: `Pool '${pool.name}' berhasil diekspor.` });
      fetchPools();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal mengekspor pool' });
    }
  };

  const handleOpenDestroy = (pool: Pool) => {
    setSelectedPool(pool);
    setConfirmName('');
    setDestroyError(null);
    setDestroyModalOpen(true);
  };

  const handleConfirmDestroy = async () => {
    if (!selectedPool || confirmName.trim() !== selectedPool.name) return;
    setDestroying(true);
    setDestroyError(null);
    try {
      await poolsApi.destroy(selectedPool.id, confirmName.trim());
      setDestroyModalOpen(false);
      setStatusMsg({
        type: 'success',
        text: `Pool '${selectedPool.name}' berhasil dihancurkan secara permanen.`,
      });
      fetchPools();
    } catch (err: any) {
      setDestroyError(err.message || 'Gagal menghancurkan pool');
    } finally {
      setDestroying(false);
    }
  };

  const handleOpenReplace = async (pool: Pool) => {
    setSelectedPool(pool);
    setReplaceModalOpen(true);
    setOldDiskId('');
    setNewDiskId('');
    try {
      const disks = await disksApi.list();
      setAllDisks(disks || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmReplace = async () => {
    if (!selectedPool || !oldDiskId || !newDiskId) return;
    setReplacing(true);
    try {
      await poolsApi.replaceDisk(selectedPool.id, Number(oldDiskId), Number(newDiskId));
      setReplaceModalOpen(false);
      setStatusMsg({
        type: 'success',
        text: `Proses penggantian disk pada pool '${selectedPool.name}' telah dijadwalkan (resilvering).`,
      });
      fetchPools();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Gagal mengganti disk' });
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('pools.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('pools.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('pools.createPool')}</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            className="ml-4 font-bold text-slate-500 hover:text-slate-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Pools Grid */}
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-2" />
          <p className="text-xs text-slate-400">{t('common.loading')}</p>
        </div>
      ) : pools.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center">
          <Database className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            {t('dashboard.noPools')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            Buat pool ZFS pertama Anda dengan menggabungkan disk-disk yang tersedia.
          </p>
          <button
            onClick={() => setWizardOpen(true)}
            className="mt-5 inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('pools.createPool')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {pools.map((pool) => {
            const isOnline = pool.health === 'ONLINE' || pool.status === 'ONLINE';
            const usedPercent = pool.used_percent ?? 0;
            return (
              <div
                key={pool.id}
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-5"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {pool.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {t('common.created')}: {formatDate(pool.created_at)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                      isOnline
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {pool.health || pool.status}
                  </span>
                </div>

                {/* Capacity Progress Bar */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5 font-mono">
                    <span className="text-slate-500 font-sans">Kapasitas Terpakai</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatBytes(pool.used_bytes)} / {formatBytes(pool.total_bytes)} ({usedPercent}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        usedPercent > 85 ? 'bg-rose-500' : usedPercent > 70 ? 'bg-amber-500' : 'bg-brand-500'
                      }`}
                      style={{ width: `${Math.min(100, usedPercent)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                    <span>Tersedia: {formatBytes(pool.free_bytes)}</span>
                    <span>Frag: {pool.fragmentation || 0}%</span>
                  </div>
                </div>

                {/* Scrub & Health Meta */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800/60 text-xs font-sans">
                  <div>
                    <span className="text-slate-400 block text-[11px]">{t('pools.lastScrub')}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {formatDate(pool.last_scrub)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">{t('pools.scrubErrors')}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                      {pool.scrub_errors || 0} err
                    </span>
                  </div>
                </div>

                {/* Actions row */}
                <div className="pt-2 flex flex-wrap gap-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleStartScrub(pool)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Activity className="w-3.5 h-3.5 text-brand-500" />
                    <span>{t('pools.scrub')}</span>
                  </button>

                  <button
                    onClick={() => handleOpenReplace(pool)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <HardDrive className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('pools.replaceDisk')}</span>
                  </button>

                  <button
                    onClick={() => handleExport(pool)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>{t('pools.export')}</span>
                  </button>

                  <button
                    onClick={() => handleOpenDestroy(pool)}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center space-x-1.5 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('pools.destroy')}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Destroy Confirmation Modal */}
      <Modal
        isOpen={destroyModalOpen}
        onClose={() => setDestroyModalOpen(false)}
        title={t('pools.confirmDestroy')}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-1.5">
            <div className="flex items-center space-x-2 font-bold text-sm text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Peringatan Bahaya Kehilangan Data</span>
            </div>
            <p>{t('pools.confirmDestroyDesc')}</p>
          </div>

          {destroyError && (
            <div className="p-3 rounded-lg bg-rose-100 text-rose-700 text-xs">
              {destroyError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ketikkan <span className="font-mono font-bold text-rose-600">{selectedPool?.name}</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={selectedPool?.name}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setDestroyModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirmDestroy}
              disabled={confirmName.trim() !== selectedPool?.name || destroying}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-rose-600/20"
            >
              {destroying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span>{t('pools.destroy')}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Replace Disk Modal */}
      <Modal
        isOpen={replaceModalOpen}
        onClose={() => setReplaceModalOpen(false)}
        title={`Ganti Disk Rusak - Pool ${selectedPool?.name}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pilih disk yang rusak dan drive pengganti baru untuk memulai proses resilvering ZFS.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Disk Lama yang Ingin Diganti
            </label>
            <select
              value={oldDiskId}
              onChange={(e) => setOldDiskId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            >
              <option value="" disabled>Pilih Disk Lama...</option>
              {allDisks
                .filter((d) => d.pool_id === selectedPool?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.device_name} ({formatBytes(d.capacity_bytes)}) - {d.status}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Disk Baru Pengganti
            </label>
            <select
              value={newDiskId}
              onChange={(e) => setNewDiskId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            >
              <option value="" disabled>Pilih Disk Baru...</option>
              {allDisks
                .filter((d) => !d.pool_id || d.pool_id !== selectedPool?.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.device_name} ({formatBytes(d.capacity_bytes)}) - {d.model || 'Drive'}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setReplaceModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirmReplace}
              disabled={!oldDiskId || !newDiskId || replacing}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50"
            >
              {replacing ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              <span>Mulai Resilver Disk</span>
            </button>
          </div>
        </div>
      </Modal>

      <PoolWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={fetchPools}
      />
    </div>
  );
};
