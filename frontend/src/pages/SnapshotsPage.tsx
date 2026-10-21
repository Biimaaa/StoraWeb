import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { snapshotsApi, datasetsApi } from '../api/client';
import { Snapshot, Dataset } from '../types';
import { formatBytes, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import {
  Camera,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Folder,
  Loader2,
  Check,
} from 'lucide-react';

export const SnapshotsPage: React.FC = () => {
  const { t } = useI18n();

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState<boolean>(true);

  // Take snapshot modal
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [createDatasetId, setCreateDatasetId] = useState<number | ''>('');
  const [snapshotName, setSnapshotName] = useState<string>('');
  const [taking, setTaking] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Rollback modal
  const [rollbackModalOpen, setRollbackModalOpen] = useState<boolean>(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);
  const [confirmName, setConfirmName] = useState<string>('');
  const [rollingBack, setRollingBack] = useState<boolean>(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  // Feedback message
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [snapList, dsList] = await Promise.all([
        snapshotsApi.list(selectedDatasetId === 'all' ? undefined : selectedDatasetId),
        datasetsApi.list(),
      ]);
      setSnapshots(snapList || []);
      setDatasets(dsList || []);
      if (dsList && dsList.length > 0 && !createDatasetId) {
        setCreateDatasetId(dsList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDatasetId]);

  const handleTakeSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createDatasetId) return;

    setTaking(true);
    setCreateError(null);
    try {
      await snapshotsApi.create({
        dataset_id: Number(createDatasetId),
        name: snapshotName.trim() || undefined,
      });
      setCreateModalOpen(false);
      setSnapshotName('');
      setMsg({ type: 'success', text: 'Snapshot point-in-time berhasil diambil!' });
      fetchData();
    } catch (err: any) {
      setCreateError(err.message || 'Gagal mengambil snapshot');
    } finally {
      setTaking(false);
    }
  };

  const handleDeleteSnapshot = async (snap: Snapshot) => {
    if (!window.confirm(`Hapus snapshot '${snap.name}'?`)) return;
    try {
      await snapshotsApi.delete(snap.id);
      setMsg({ type: 'success', text: `Snapshot '${snap.name}' berhasil dihapus.` });
      fetchData();
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Gagal menghapus snapshot' });
    }
  };

  const handleConfirmRollback = async () => {
    if (!selectedSnapshot || confirmName.trim() !== selectedSnapshot.name) return;
    setRollingBack(true);
    setRollbackError(null);
    try {
      await snapshotsApi.rollback(selectedSnapshot.id, confirmName.trim());
      setRollbackModalOpen(false);
      setMsg({
        type: 'success',
        text: `Dataset berhasil dikembalikan (rollback) ke snapshot '${selectedSnapshot.name}'.`,
      });
      fetchData();
    } catch (err: any) {
      setRollbackError(err.message || 'Gagal melakukan rollback snapshot');
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('snapshots.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('snapshots.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Dataset filter */}
          <select
            value={selectedDatasetId}
            onChange={(e) =>
              setSelectedDatasetId(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none"
          >
            <option value="all">Semua Dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('snapshots.takeSnapshot')}</span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            msg.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300'
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} className="font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Snapshots Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{t('snapshots.snapshotName')}</th>
                <th className="py-3 px-4">Dataset ID</th>
                <th className="py-3 px-4">{t('common.size')}</th>
                <th className="py-3 px-4">{t('snapshots.createdDate')}</th>
                <th className="py-3 px-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <p>{t('common.loading')}</p>
                  </td>
                </tr>
              ) : snapshots.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                snapshots.map((snap) => (
                  <tr
                    key={snap.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors font-sans"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <Camera className="w-4 h-4 text-brand-500 flex-shrink-0" />
                      <span className="font-mono text-xs">{snap.name}</span>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      Dataset #{snap.dataset_id}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {formatBytes(snap.size_bytes)}
                    </td>

                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {formatDate(snap.created_at)}
                    </td>

                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedSnapshot(snap);
                          setConfirmName('');
                          setRollbackError(null);
                          setRollbackModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 text-[11px] font-semibold inline-flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rollback</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSnapshot(snap)}
                        className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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

      {/* Take Snapshot Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title={t('snapshots.takeSnapshot')}
        maxWidth="md"
      >
        <form onSubmit={handleTakeSnapshot} className="space-y-4">
          {createError && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs">
              {createError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('snapshots.dataset')}
            </label>
            <select
              value={createDatasetId}
              onChange={(e) => setCreateDatasetId(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            >
              <option value="" disabled>Pilih Dataset...</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('snapshots.snapshotName')} (Opsional, otomatis jika kosong)
            </label>
            <input
              type="text"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="auto-2026-10-22_1200"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
          </div>

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
              disabled={taking}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {taking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              <span>{t('snapshots.takeSnapshot')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Rollback Modal */}
      <Modal
        isOpen={rollbackModalOpen}
        onClose={() => setRollbackModalOpen(false)}
        title={t('snapshots.confirmRollback')}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300 space-y-1">
            <div className="flex items-center space-x-2 font-bold text-amber-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Peringatan Rollback Snapshot ZFS</span>
            </div>
            <p>{t('snapshots.confirmRollbackDesc')}</p>
          </div>

          {rollbackError && (
            <div className="p-2.5 rounded-lg bg-rose-100 text-rose-700 text-xs">
              {rollbackError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ketikkan <span className="font-mono font-bold text-amber-600">"{selectedSnapshot?.name}"</span>
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={selectedSnapshot?.name}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setRollbackModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleConfirmRollback}
              disabled={confirmName.trim() !== selectedSnapshot?.name || rollingBack}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 shadow-md shadow-amber-600/20"
            >
              {rollingBack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              <span>{t('snapshots.rollback')}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
