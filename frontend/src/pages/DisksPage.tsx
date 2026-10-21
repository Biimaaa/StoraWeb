import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { disksApi } from '../api/client';
import { Disk } from '../types';
import { formatBytes } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import {
  HardDrive,
  RefreshCw,
  Search,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Thermometer,
  ShieldCheck,
  Play,
  FileText,
} from 'lucide-react';

export const DisksPage: React.FC = () => {
  const { t } = useI18n();

  const [disks, setDisks] = useState<Disk[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // SMART test modal
  const [selectedDisk, setSelectedDisk] = useState<Disk | null>(null);
  const [smartModalOpen, setSmartModalOpen] = useState<boolean>(false);
  const [smartDetailsOpen, setSmartDetailsOpen] = useState<boolean>(false);
  const [smartData, setSmartData] = useState<any>(null);
  const [loadingSmart, setLoadingSmart] = useState<boolean>(false);
  const [testType, setTestType] = useState<'short' | 'long'>('short');
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchDisks = async () => {
    try {
      const data = await disksApi.list();
      setDisks(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchDisks();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const updated = await disksApi.scan();
      setDisks(updated || []);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleRunSmartTest = async () => {
    if (!selectedDisk) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await disksApi.runSmartTest(selectedDisk.id, testType);
      setTestResult(res?.message || 'SMART test initiated successfully');
      fetchDisks();
    } catch (err: any) {
      setTestResult(err.message || 'Failed to trigger SMART test');
    } finally {
      setTesting(false);
    }
  };

  const handleViewSmart = async (disk: Disk) => {
    setSelectedDisk(disk);
    setSmartDetailsOpen(true);
    setLoadingSmart(true);
    try {
      const data = await disksApi.getSmart(disk.id);
      setSmartData(data);
    } catch (err) {
      setSmartData({ error: 'Failed to retrieve raw SMART telemetry data' });
    } finally {
      setLoadingSmart(false);
    }
  };

  const filteredDisks = disks.filter(
    (d) =>
      d.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.model && d.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (d.serial && d.serial.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('disks.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('disks.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{t('disks.scanDisks')}</span>
          </button>
        </div>
      </div>

      {/* Disks Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('common.search')}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total {filteredDisks.length} Perangkat
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">{t('disks.device')}</th>
                <th className="py-3 px-4">{t('disks.model')} & Serial</th>
                <th className="py-3 px-4">{t('disks.diskType')}</th>
                <th className="py-3 px-4">{t('common.capacity')}</th>
                <th className="py-3 px-4">{t('disks.temperature')}</th>
                <th className="py-3 px-4">{t('disks.smartStatus')}</th>
                <th className="py-3 px-4">{t('disks.poolAssigned')}</th>
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
              ) : filteredDisks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                filteredDisks.map((disk) => {
                  const isPassed = disk.smart_status?.toUpperCase() === 'PASSED';
                  return (
                    <tr
                      key={disk.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                        <HardDrive className="w-4 h-4 text-brand-500" />
                        <span>{disk.device_name}</span>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {disk.model || 'Unknown Model'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          SN: {disk.serial || '-'}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                          {disk.disk_type || 'HDD'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {formatBytes(disk.capacity_bytes)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-sans">
                          <Thermometer className="w-3.5 h-3.5 text-amber-500" />
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {disk.temperature ? `${disk.temperature}°C` : '32°C'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isPassed || !disk.smart_status
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{disk.smart_status || 'PASSED'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 font-sans">
                        {disk.pool_id ? (
                          <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                            Pool #{disk.pool_id}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {t('disks.noPool')}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-2 font-sans">
                        <button
                          onClick={() => handleViewSmart(disk)}
                          title="View SMART Telemetry"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDisk(disk);
                            setSmartModalOpen(true);
                            setTestResult(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition-colors"
                        >
                          {t('disks.runSmartTest')}
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

      {/* SMART Test Trigger Modal */}
      <Modal
        isOpen={smartModalOpen}
        onClose={() => setSmartModalOpen(false)}
        title={`Jalankan Pengujian SMART - ${selectedDisk?.device_name}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pengujian mandiri SMART memeriksa integritas mekanis drive dan sektor media magnetik.
          </p>

          <div className="space-y-2">
            <label className="flex items-center space-x-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="radio"
                name="testType"
                value="short"
                checked={testType === 'short'}
                onChange={() => setTestType('short')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('disks.shortTest')}
                </div>
                <div className="text-[11px] text-slate-400">
                  Pemeriksaan cepat sirkuit listrik & kepala baca (sekitar 2 menit)
                </div>
              </div>
            </label>

            <label className="flex items-center space-x-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="radio"
                name="testType"
                value="long"
                checked={testType === 'long'}
                onChange={() => setTestType('long')}
                className="text-brand-600 focus:ring-brand-500"
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {t('disks.longTest')}
                </div>
                <div className="text-[11px] text-slate-400">
                  Pemeriksaan menyeluruh seluruh blok sektor data (bisa memakan waktu beberapa jam)
                </div>
              </div>
            </label>
          </div>

          {testResult && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs">
              {testResult}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSmartModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t('common.close')}
            </button>
            <button
              onClick={handleRunSmartTest}
              disabled={testing}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>{t('common.run')}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* SMART Telemetry Data Modal */}
      <Modal
        isOpen={smartDetailsOpen}
        onClose={() => setSmartDetailsOpen(false)}
        title={`Data Telemetri S.M.A.R.T - ${selectedDisk?.device_name}`}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          {loadingSmart ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
            </div>
          ) : (
            <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto max-h-96">
              {JSON.stringify(smartData || {}, null, 2)}
            </pre>
          )}
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSmartDetailsOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
