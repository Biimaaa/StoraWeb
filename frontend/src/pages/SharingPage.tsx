import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { sharesApi } from '../api/client';
import { Share, ShareSession } from '../types';
import { formatDate } from '../utils/formatters';
import { ShareWizardModal } from '../components/wizards/ShareWizardModal';
import {
  Share2,
  Folder,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Power,
  Users,
  Laptop,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';

export const SharingPage: React.FC = () => {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'smb' | 'nfs' | 'sessions'>('smb');
  const [shares, setShares] = useState<Share[]>([]);
  const [sessions, setSessions] = useState<ShareSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [wizardOpen, setWizardOpen] = useState<boolean>(false);
  const [reloadingService, setReloadingService] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      if (activeTab === 'sessions') {
        const sessList = await sharesApi.sessions('smb');
        setSessions(sessList || []);
      } else {
        const shareList = await sharesApi.list(activeTab);
        setShares(shareList || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [activeTab]);

  const handleCopyUnc = (share: Share) => {
    const unc = share.network_path || `\\\\SERVER\\${share.name}`;
    navigator.clipboard.writeText(unc);
    setCopiedId(share.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleEnable = async (share: Share) => {
    try {
      if (share.enabled) {
        await sharesApi.disable(share.id);
      } else {
        await sharesApi.enable(share.id);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah status share');
    }
  };

  const handleDeleteShare = async (share: Share) => {
    if (!window.confirm(`Hapus konfigurasi share '${share.name}'? Data file pada dataset tetap aman.`)) return;
    try {
      await sharesApi.delete(share.id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus share');
    }
  };

  const handleReloadDaemons = async () => {
    setReloadingService(true);
    try {
      const res = await sharesApi.reload();
      setMsg(res.message);
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal me-reload service sharing');
    } finally {
      setReloadingService(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('sharing.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('sharing.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleReloadDaemons}
            disabled={reloadingService}
            className="flex items-center space-x-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reloadingService ? 'animate-spin text-brand-500' : ''}`} />
            <span>Reload Daemons</span>
          </button>

          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('sharing.createShare')}</span>
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('smb')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'smb'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>{t('sharing.tabs.smb')}</span>
        </button>

        <button
          onClick={() => setActiveTab('nfs')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'nfs'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span>{t('sharing.tabs.nfs')}</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'sessions'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('sharing.tabs.sessions')}</span>
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'sessions' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">{t('sharing.clientIp')}</th>
                  <th className="py-3 px-4">Target Share</th>
                  <th className="py-3 px-4">Protokol</th>
                  <th className="py-3 px-4">{t('sharing.connectedAt')}</th>
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
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                      Tidak ada koneksi klien yang aktif saat ini.
                    </td>
                  </tr>
                ) : (
                  sessions.map((sess, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-sans">
                        {sess.username}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{sess.client_ip}</td>
                      <td className="py-3 px-4 font-bold text-brand-600 dark:text-brand-400 font-sans">
                        {sess.share_name}
                      </td>
                      <td className="py-3 px-4 uppercase text-[11px] font-bold">{sess.protocol}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {formatDate(sess.connected_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">{t('common.name')}</th>
                  <th className="py-3 px-4">{t('sharing.uncPath')}</th>
                  <th className="py-3 px-4">Dataset ID</th>
                  <th className="py-3 px-4">Fitur / Pengaturan</th>
                  <th className="py-3 px-4">{t('common.status')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                      <p>{t('common.loading')}</p>
                    </td>
                  </tr>
                ) : shares.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  shares.map((share) => {
                    const unc = share.network_path || `\\\\SERVER\\${share.name}`;
                    return (
                      <tr
                        key={share.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                          {share.protocol === 'smb' ? (
                            <Share2 className="w-4 h-4 text-brand-500 flex-shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 text-sky-500 flex-shrink-0" />
                          )}
                          <span>{share.name}</span>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          <button
                            onClick={() => handleCopyUnc(share)}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-xs"
                            title="Klik untuk salin jalur jaringan"
                          >
                            <span>{unc}</span>
                            {copiedId === share.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-500">
                          Dataset #{share.dataset_id}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {share.settings?.guest_ok && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold">
                                Guest OK
                              </span>
                            )}
                            {share.settings?.recycle_bin && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold">
                                Recycle Bin
                              </span>
                            )}
                            {share.settings?.time_machine && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                                Time Machine
                              </span>
                            )}
                            {share.settings?.readonly && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                                Read Only
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleEnable(share)}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                              share.enabled
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{share.enabled ? t('common.enabled') : t('common.disabled')}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteShare(share)}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ShareWizardModal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={fetchData}
        defaultProtocol={activeTab === 'nfs' ? 'nfs' : 'smb'}
      />
    </div>
  );
};
