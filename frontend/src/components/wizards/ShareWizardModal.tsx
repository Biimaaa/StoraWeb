import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useI18n } from '../../i18n/I18nContext';
import { datasetsApi, sharesApi } from '../../api/client';
import { Dataset, ShareProtocol } from '../../types';
import { Share2, Folder, HardDrive, Check, Loader2, AlertCircle } from 'lucide-react';

interface ShareWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultProtocol?: ShareProtocol;
}

export const ShareWizardModal: React.FC<ShareWizardModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultProtocol = 'smb',
}) => {
  const { t } = useI18n();

  const [protocol, setProtocol] = useState<ShareProtocol>(defaultProtocol);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | ''>('');
  const [shareName, setShareName] = useState<string>('');

  // SMB options
  const [guestOk, setGuestOk] = useState<boolean>(false);
  const [readonly, setReadonly] = useState<boolean>(false);
  const [browsable, setBrowsable] = useState<boolean>(true);
  const [recycleBin, setRecycleBin] = useState<boolean>(true);
  const [timeMachine, setTimeMachine] = useState<boolean>(false);

  // NFS options
  const [nfsHosts, setNfsHosts] = useState<string>('*');
  const [nfsV4, setNfsV4] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setProtocol(defaultProtocol);
      setShareName('');
      setSelectedDatasetId('');
      setError(null);
      fetchDatasets();
    }
  }, [isOpen, defaultProtocol]);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const data = await datasetsApi.list();
      setDatasets(data || []);
      if (data && data.length > 0) {
        setSelectedDatasetId(data[0].id);
        setShareName(data[0].name.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load datasets');
    } finally {
      setLoading(false);
    }
  };

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    const ds = datasets.find((d) => d.id === id);
    if (ds && !shareName) {
      setShareName(ds.name.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareName.trim() || !selectedDatasetId) {
      setError('Harap isi nama share dan pilih dataset tujuan');
      return;
    }

    setSubmitting(true);
    setError(null);

    const settings =
      protocol === 'smb'
        ? {
            guest_ok: guestOk,
            readonly,
            browsable,
            recycle_bin: recycleBin,
            time_machine: timeMachine,
          }
        : {
            hosts: nfsHosts.split(',').map((h) => h.trim()).filter(Boolean),
            nfsv4: nfsV4,
            security: ['sys'],
          };

    try {
      await sharesApi.create({
        name: shareName.trim(),
        protocol,
        dataset_id: Number(selectedDatasetId),
        enabled: true,
        settings,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create share');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('sharing.createShare')} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Protocol selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Protokol Berbagi
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProtocol('smb')}
              className={`p-3 rounded-lg border text-left flex items-center space-x-2.5 transition-all ${
                protocol === 'smb'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-500/20 text-brand-700 dark:text-brand-300 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Share2 className="w-4 h-4 text-brand-500" />
              <div className="text-xs">
                <div>SMB Share</div>
                <div className="text-[10px] text-slate-400 font-normal">Windows, macOS, Linux</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setProtocol('nfs')}
              className={`p-3 rounded-lg border text-left flex items-center space-x-2.5 transition-all ${
                protocol === 'nfs'
                  ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-2 ring-brand-500/20 text-brand-700 dark:text-brand-300 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Folder className="w-4 h-4 text-brand-500" />
              <div className="text-xs">
                <div>NFS Share</div>
                <div className="text-[10px] text-slate-400 font-normal">UNIX, VMware, Proxmox</div>
              </div>
            </button>
          </div>
        </div>

        {/* Dataset selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Pilih Target ZFS Dataset
          </label>
          {loading ? (
            <div className="flex items-center space-x-2 py-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
              <span>Memuat dataset...</span>
            </div>
          ) : (
            <select
              value={selectedDatasetId}
              onChange={(e) => handleDatasetChange(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="" disabled>Pilih Dataset...</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.mountpoint || `/mnt/${d.name}`})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Share Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t('sharing.shareName')}
          </label>
          <input
            type="text"
            value={shareName}
            onChange={(e) => setShareName(e.target.value)}
            required
            placeholder="contoh: public, documents, backup"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
          />
        </div>

        {/* Protocol-specific parameters */}
        {protocol === 'smb' ? (
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Opsi Protokol SMB
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestOk}
                  onChange={(e) => setGuestOk(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{t('sharing.guestAccess')}</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={readonly}
                  onChange={(e) => setReadonly(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{t('sharing.readOnly')}</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={browsable}
                  onChange={(e) => setBrowsable(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{t('sharing.browsable')}</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recycleBin}
                  onChange={(e) => setRecycleBin(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{t('sharing.recycleBin')}</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer sm:col-span-2">
                <input
                  type="checkbox"
                  checked={timeMachine}
                  onChange={(e) => setTimeMachine(e.target.checked)}
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
                <span className="text-slate-700 dark:text-slate-300">{t('sharing.timeMachine')}</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Opsi Protokol NFS
            </span>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('sharing.nfsHosts')}
              </label>
              <input
                type="text"
                value={nfsHosts}
                onChange={(e) => setNfsHosts(e.target.value)}
                placeholder="* atau 192.168.1.0/24, 10.0.0.5"
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-2 focus:ring-brand-500 outline-none font-mono"
              />
              <p className="text-[10px] text-slate-400 mt-1">Gunakan tanda koma untuk memisahkan beberapa alamat IP/subnet.</p>
            </div>
            <label className="flex items-center space-x-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={nfsV4}
                onChange={(e) => setNfsV4(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="text-slate-700 dark:text-slate-300">{t('sharing.nfsv4')}</span>
            </label>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{t('common.create')}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
