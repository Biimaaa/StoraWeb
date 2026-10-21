import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { useI18n } from '../../i18n/I18nContext';
import { disksApi, poolsApi } from '../../api/client';
import { Disk, VdevType } from '../../types';
import { formatBytes } from '../../utils/formatters';
import {
  HardDrive,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from 'lucide-react';

interface PoolWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PoolWizardModal: React.FC<PoolWizardModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { t } = useI18n();

  const [step, setStep] = useState<number>(1);
  const [poolName, setPoolName] = useState<string>('');
  const [disks, setDisks] = useState<Disk[]>([]);
  const [selectedDiskIds, setSelectedDiskIds] = useState<number[]>([]);
  const [vdevType, setVdevType] = useState<VdevType>('mirror');
  const [confirmName, setConfirmName] = useState<string>('');
  const [encryption, setEncryption] = useState<boolean>(false);

  const [loadingDisks, setLoadingDisks] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPoolName('');
      setSelectedDiskIds([]);
      setVdevType('mirror');
      setConfirmName('');
      setError(null);
      fetchDisks();
    }
  }, [isOpen]);

  const fetchDisks = async () => {
    setLoadingDisks(true);
    try {
      const data = await disksApi.list();
      setDisks(data || []);
      // Preselect unassigned disks if available
      const free = (data || []).filter((d) => !d.pool_id);
      if (free.length > 0) {
        setSelectedDiskIds(free.map((d) => d.id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load disks');
    } finally {
      setLoadingDisks(false);
    }
  };

  const toggleDiskSelection = (diskId: number) => {
    setSelectedDiskIds((prev) =>
      prev.includes(diskId) ? prev.filter((id) => id !== diskId) : [...prev, diskId]
    );
  };

  const selectedDisks = disks.filter((d) => selectedDiskIds.includes(d.id));

  // Capacity calculations based on VDEV type
  const minDiskCapacity = selectedDisks.length > 0
    ? Math.min(...selectedDisks.map((d) => d.capacity_bytes))
    : 0;

  const totalRawCapacity = selectedDisks.reduce((acc, d) => acc + d.capacity_bytes, 0);

  let effectiveCapacity = 0;
  let faultToleranceText = '';

  const n = selectedDisks.length;
  if (vdevType === 'stripe') {
    effectiveCapacity = totalRawCapacity;
    faultToleranceText = '0 Disk (Tidak ada toleransi)';
  } else if (vdevType === 'mirror') {
    effectiveCapacity = minDiskCapacity * Math.floor(n / 2) || (n === 1 ? minDiskCapacity : 0);
    faultToleranceText = '1 Disk per pasangan Mirror';
  } else if (vdevType === 'raidz1') {
    effectiveCapacity = n >= 3 ? minDiskCapacity * (n - 1) : 0;
    faultToleranceText = '1 Disk Paritas (Min. 3 disk)';
  } else if (vdevType === 'raidz2') {
    effectiveCapacity = n >= 4 ? minDiskCapacity * (n - 2) : 0;
    faultToleranceText = '2 Disk Paritas (Min. 4 disk)';
  } else if (vdevType === 'raidz3') {
    effectiveCapacity = n >= 5 ? minDiskCapacity * (n - 3) : 0;
    faultToleranceText = '3 Disk Paritas (Min. 5 disk)';
  }

  const isStepValid = (): boolean => {
    if (step === 1) {
      return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(poolName.trim());
    }
    if (step === 2) {
      return selectedDiskIds.length > 0;
    }
    if (step === 3) {
      if (vdevType === 'mirror' && selectedDiskIds.length < 2) return false;
      if (vdevType === 'raidz1' && selectedDiskIds.length < 3) return false;
      if (vdevType === 'raidz2' && selectedDiskIds.length < 4) return false;
      return true;
    }
    if (step === 4) {
      return confirmName.trim() === poolName.trim();
    }
    return false;
  };

  const handleCreatePool = async () => {
    if (!isStepValid()) return;
    setSubmitting(true);
    setError(null);
    try {
      await poolsApi.create({
        name: poolName.trim(),
        topology: {
          data: [
            {
              vdev_type: vdevType,
              disk_ids: selectedDiskIds,
              purpose: 'data',
            },
          ],
        },
        encryption,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create storage pool');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('wizard.poolTitle')} maxWidth="2xl">
      <div className="space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center space-x-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                    : step > s
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              <span
                className={`text-xs hidden sm:inline font-medium ${
                  step === s
                    ? 'text-brand-600 dark:text-brand-400 font-semibold'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {s === 1
                  ? t('wizard.step1Title')
                  : s === 2
                  ? t('wizard.step2Title')
                  : s === 3
                  ? t('wizard.step3Title')
                  : t('wizard.step4Title')}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Pool Name */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('wizard.poolNameLabel')}
              </label>
              <input
                type="text"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder={t('wizard.poolNamePlaceholder')}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {t('wizard.step1Desc')}
              </p>
            </div>

            <div className="pt-2">
              <label className="flex items-center space-x-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={encryption}
                  onChange={(e) => setEncryption(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                />
                <span>Aktifkan Enkripsi ZFS Asli (ZFS Native Encryption AES-256-GCM)</span>
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Select Disks */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('wizard.step2Desc')}</p>

            {loadingDisks ? (
              <div className="py-8 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
              </div>
            ) : disks.length === 0 ? (
              <p className="text-xs text-amber-500 py-4 text-center">
                Tidak ada disk yang terdeteksi di sistem.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-850/50">
                {disks.map((disk) => {
                  const isSelected = selectedDiskIds.includes(disk.id);
                  const isAssigned = !!disk.pool_id;
                  return (
                    <div
                      key={disk.id}
                      onClick={() => toggleDiskSelection(disk.id)}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-brand-50 dark:bg-brand-950/40 border-brand-300 dark:border-brand-700'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                        />
                        <HardDrive className={`w-5 h-5 ${isSelected ? 'text-brand-500' : 'text-slate-400'}`} />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {disk.device_name} ({disk.model || 'Generic Drive'})
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            SN: {disk.serial || '-'} | {disk.disk_type || 'HDD'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                          {formatBytes(disk.capacity_bytes)}
                        </span>
                        {isAssigned && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            Digunakan di Pool #{disk.pool_id}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between items-center text-xs text-slate-600 dark:text-slate-400 pt-1">
              <span>{t('wizard.selectedDisks')}: <b>{selectedDiskIds.length}</b> disk</span>
              <span>Total Raw: <b>{formatBytes(totalRawCapacity)}</b></span>
            </div>
          </div>
        )}

        {/* Step 3: VDEV Topology */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('wizard.step3Desc')}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { type: 'mirror', title: 'Mirror (RAID1)', desc: t('wizard.mirrorDesc'), min: 2 },
                { type: 'raidz1', title: 'RAID-Z1 (RAID5)', desc: t('wizard.raidz1Desc'), min: 3 },
                { type: 'raidz2', title: 'RAID-Z2 (RAID6)', desc: t('wizard.raidz2Desc'), min: 4 },
                { type: 'stripe', title: 'Stripe (RAID0)', desc: t('wizard.stripeDesc'), min: 1 },
              ].map((opt) => {
                const disabled = selectedDiskIds.length < opt.min;
                return (
                  <div
                    key={opt.type}
                    onClick={() => !disabled && setVdevType(opt.type as VdevType)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      vdevType === opt.type
                        ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 ring-2 ring-brand-500/20'
                        : disabled
                        ? 'opacity-40 bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                        {opt.title}
                      </span>
                      {vdevType === opt.type && (
                        <CheckCircle className="w-4 h-4 text-brand-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Capacity gauge summary */}
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{t('wizard.effectiveCapacity')}:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {formatBytes(effectiveCapacity)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{t('wizard.faultTolerance')}:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {faultToleranceText}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Destructive Confirmation */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-sm text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>Peringatan Penghancuran Disk!</span>
              </div>
              <p>{t('wizard.step4Desc')}</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Nama Pool:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{poolName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tipe VDEV:</span>
                <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{vdevType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Disk Terpilih:</span>
                <span className="font-medium">{selectedDiskIds.length} Drives ({formatBytes(effectiveCapacity)} usable)</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('wizard.typeToConfirm')} <span className="font-mono font-bold text-rose-600 dark:text-rose-400">"{poolName}"</span>
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={poolName}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-rose-500 outline-none font-mono"
              />
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-800">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('common.back')}</span>
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!isStepValid()}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-500/20"
            >
              <span>{t('common.next')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreatePool}
              disabled={!isStepValid() || submitting}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-rose-600/20"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              <span>Buat & Format Storage Pool</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
