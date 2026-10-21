import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { datasetsApi, poolsApi } from '../api/client';
import { Dataset, Pool } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import {
  Layers,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Folder,
  Lock,
  Zap,
  HardDrive,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  ChevronRight,
  Database,
} from 'lucide-react';

export const DatasetsPage: React.FC = () => {
  const { t } = useI18n();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPoolId, setSelectedPoolId] = useState<number | 'all'>('all');

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [createPoolId, setCreatePoolId] = useState<number | ''>('');
  const [datasetName, setDatasetName] = useState<string>('');
  const [parentId, setParentId] = useState<number | ''>('');
  const [preset, setPreset] = useState<string>('general');
  const [compression, setCompression] = useState<string>('lz4');
  const [recordSize, setRecordSize] = useState<number>(131072);
  const [quotaGB, setQuotaGB] = useState<string>('');
  const [encryption, setEncryption] = useState<boolean>(false);
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [confirmName, setConfirmName] = useState<string>('');
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [dsList, poolList] = await Promise.all([
        datasetsApi.list(selectedPoolId === 'all' ? undefined : selectedPoolId),
        poolsApi.list(),
      ]);
      setDatasets(dsList || []);
      setPools(poolList || []);
      if (poolList && poolList.length > 0 && !createPoolId) {
        setCreatePoolId(poolList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPoolId]);

  const handlePresetChange = (selectedPreset: string) => {
    setPreset(selectedPreset);
    if (selectedPreset === 'smb') {
      setCompression('lz4');
      setRecordSize(131072); // 128k
    } else if (selectedPreset === 'app') {
      setCompression('lz4');
      setRecordSize(16384); // 16k
    } else if (selectedPreset === 'media') {
      setCompression('lz4');
      setRecordSize(1048576); // 1M
    } else {
      setCompression('lz4');
      setRecordSize(131072);
    }
  };

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createPoolId || !datasetName.trim()) return;

    setCreating(true);
    setCreateError(null);

    const quotaBytes = quotaGB ? parseFloat(quotaGB) * 1024 * 1024 * 1024 : undefined;

    try {
      await datasetsApi.create({
        name: datasetName.trim(),
        pool_id: Number(createPoolId),
        parent_id: parentId ? Number(parentId) : undefined,
        dataset_type: 'filesystem',
        preset,
        compression,
        record_size: recordSize,
        quota_bytes: quotaBytes,
        encryption,
      });
      setCreateModalOpen(false);
      setDatasetName('');
      setQuotaGB('');
      fetchData();
    } catch (err: any) {
      setCreateError(err.message || 'Gagal membuat dataset');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDataset || confirmName.trim() !== selectedDataset.name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await datasetsApi.delete(selectedDataset.id, confirmName.trim());
      setDeleteModalOpen(false);
      fetchData();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus dataset');
    } finally {
      setDeleting(false);
    }
  };

  const getPresetBadge = (prs?: string | null) => {
    switch (prs) {
      case 'smb':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">SMB</span>;
      case 'app':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">App (16K)</span>;
      case 'media':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">Media (1M)</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">General</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('datasets.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('datasets.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Pool filter */}
          <select
            value={selectedPoolId}
            onChange={(e) => setSelectedPoolId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="all">Semua Pool</option>
            {pools.map((p) => (
              <option key={p.id} value={p.id}>
                Pool: {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('datasets.createDataset')}</span>
          </button>
        </div>
      </div>

      {/* Datasets Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{t('datasets.datasetName')}</th>
                <th className="py-3 px-4">{t('datasets.preset')}</th>
                <th className="py-3 px-4">{t('common.used')}</th>
                <th className="py-3 px-4">{t('common.free')}</th>
                <th className="py-3 px-4">{t('datasets.compression')}</th>
                <th className="py-3 px-4">{t('datasets.quota')}</th>
                <th className="py-3 px-4">{t('datasets.encryption')}</th>
                <th className="py-3 px-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <p className="font-sans">{t('common.loading')}</p>
                  </td>
                </tr>
              ) : datasets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                datasets.map((ds) => (
                  <tr
                    key={ds.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors font-sans"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">
                            {ds.name}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {ds.mountpoint || `/mnt/${ds.name}`}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {getPresetBadge(ds.preset)}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {formatBytes(ds.used_bytes)}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-500 dark:text-slate-400">
                      {formatBytes(ds.available_bytes)}
                    </td>

                    <td className="py-3 px-4 font-mono">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                        {ds.compression || 'lz4'}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono">
                      {ds.quota_bytes ? (
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatBytes(ds.quota_bytes)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-sans">
                          {t('datasets.unlimited')}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {ds.encryption ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <Lock className="w-3.5 h-3.5" />
                          <span>AES-256</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Tidak</span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedDataset(ds);
                          setConfirmName('');
                          setDeleteError(null);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title={t('datasets.deleteDataset')}
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

      {/* Create Dataset Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={t('datasets.createDataset')}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateDataset} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Pilih Target Storage Pool
            </label>
            <select
              value={createPoolId}
              onChange={(e) => setCreatePoolId(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            >
              <option value="" disabled>Pilih Pool...</option>
              {pools.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatBytes(p.free_bytes)} free)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('datasets.datasetName')}
            </label>
            <input
              type="text"
              value={datasetName}
              onChange={(e) => setDatasetName(e.target.value)}
              required
              placeholder="contoh: media, backups, public"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('datasets.preset')}
            </label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            >
              <option value="general">{t('datasets.presetGeneral')}</option>
              <option value="smb">{t('datasets.presetSmb')}</option>
              <option value="app">{t('datasets.presetApp')}</option>
              <option value="media">{t('datasets.presetMedia')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('datasets.compression')}
              </label>
              <select
                value={compression}
                onChange={(e) => setCompression(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              >
                <option value="lz4">lz4 (Direkomendasikan)</option>
                <option value="zstd">zstd (Rasio Tinggi)</option>
                <option value="gzip">gzip</option>
                <option value="off">off (Tanpa Kompresi)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('datasets.quota')} (GB, Kosongkan jika unlimited)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quotaGB}
                onChange={(e) => setQuotaGB(e.target.value)}
                placeholder="Unlimited"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>

          <label className="flex items-center space-x-2 pt-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={encryption}
              onChange={(e) => setEncryption(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span className="text-slate-700 dark:text-slate-300">{t('datasets.encryption')}</span>
          </label>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{t('common.create')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title={t('datasets.deleteDataset')}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-1">
            <div className="flex items-center space-x-2 font-bold text-rose-600">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Hapus Permanen Dataset ZFS</span>
            </div>
            <p>Seluruh snapshot, share, dan file di dalam dataset ini akan dimusnahkan.</p>
          </div>

          {deleteError && (
            <div className="p-2.5 rounded-lg bg-rose-100 text-rose-700 text-xs">
              {deleteError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('datasets.confirmDelete')} <span className="font-mono font-bold text-rose-600">"{selectedDataset?.name}"</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={selectedDataset?.name}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleDelete}
              disabled={confirmName.trim() !== selectedDataset?.name || deleting}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 shadow-md shadow-rose-600/20"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>{t('common.delete')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
