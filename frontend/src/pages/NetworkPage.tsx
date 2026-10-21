import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { networkApi } from '../api/client';
import { NetworkInterface } from '../types';
import { Modal } from '../components/common/Modal';
import {
  Network,
  RefreshCw,
  Edit2,
  Server,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  Check,
} from 'lucide-react';

export const NetworkPage: React.FC = () => {
  const { t } = useI18n();

  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [hostname, setHostname] = useState<string>('');
  const [dnsServers, setDnsServers] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Edit Interface modal
  const [editModalOpen, setEditModalOpen] = useState<boolean>(false);
  const [selectedIface, setSelectedIface] = useState<NetworkInterface | null>(null);
  const [dhcp, setDhcp] = useState<boolean>(true);
  const [ipv4, setIpv4] = useState<string>('');
  const [netmask, setNetmask] = useState<string>('255.255.255.0');
  const [gateway, setGateway] = useState<string>('');
  const [mtu, setMtu] = useState<number>(1500);
  const [savingIface, setSavingIface] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const [ifaces, hostObj, dnsObj] = await Promise.all([
        networkApi.listInterfaces(),
        networkApi.getHostname(),
        networkApi.getDns(),
      ]);
      setInterfaces(ifaces || []);
      setHostname(hostObj?.hostname || 'storaweb-nas');
      setDnsServers((dnsObj?.servers || ['1.1.1.1', '8.8.8.8']).join(', '));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const updated = await networkApi.scanInterfaces();
      setInterfaces(updated || []);
    } catch (err) {
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const handleSaveHostnameAndDns = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setFeedback(null);
    try {
      const servers = dnsServers.split(',').map((s) => s.trim()).filter(Boolean);
      await Promise.all([
        networkApi.updateHostname(hostname.trim()),
        networkApi.updateDns({ servers, domain: '' }),
      ]);
      setFeedback('Konfigurasi Hostname dan DNS berhasil diperbarui!');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenEdit = (iface: NetworkInterface) => {
    setSelectedIface(iface);
    setDhcp(iface.dhcp);
    setIpv4(iface.ipv4_address || '');
    setNetmask(iface.ipv4_netmask || '255.255.255.0');
    setGateway(iface.gateway || '');
    setMtu(iface.mtu || 1500);
    setEditModalOpen(true);
  };

  const handleSaveInterface = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIface) return;
    setSavingIface(true);
    try {
      await networkApi.updateInterface(selectedIface.id, {
        dhcp,
        ipv4_address: dhcp ? null : ipv4.trim(),
        ipv4_netmask: dhcp ? null : netmask.trim(),
        gateway: dhcp ? null : gateway.trim(),
        mtu,
      });
      setEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah pengaturan antarmuka');
    } finally {
      setSavingIface(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('network.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('network.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{t('network.scanInterfaces')}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-300 text-xs">
          {feedback}
        </div>
      )}

      {/* Network Interfaces Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Network className="w-4 h-4 text-brand-500" />
            <span>{t('network.interfaces')}</span>
          </h3>
          <span className="text-xs text-slate-400">{interfaces.length} Adapter Terdeteksi</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">{t('common.name')}</th>
                <th className="py-3 px-4">{t('network.ipAddress')}</th>
                <th className="py-3 px-4">{t('network.netmask')}</th>
                <th className="py-3 px-4">{t('network.gateway')}</th>
                <th className="py-3 px-4">{t('network.macAddress')}</th>
                <th className="py-3 px-4">{t('network.dhcp')}</th>
                <th className="py-3 px-4">{t('common.status')}</th>
                <th className="py-3 px-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    <p>{t('common.loading')}</p>
                  </td>
                </tr>
              ) : interfaces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                interfaces.map((iface) => (
                  <tr key={iface.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {iface.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-bold">
                      {iface.ipv4_address || 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{iface.ipv4_netmask || '-'}</td>
                    <td className="py-3.5 px-4 text-slate-500">{iface.gateway || '-'}</td>
                    <td className="py-3.5 px-4 text-slate-400 uppercase text-[11px]">
                      {iface.mac_address || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          iface.dhcp
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {iface.dhcp ? 'DHCP' : 'Static'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          iface.state === 'up'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {iface.state || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <button
                        onClick={() => handleOpenEdit(iface)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[11px] inline-flex items-center space-x-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{t('common.edit')}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hostname & DNS Settings Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 max-w-2xl">
        <div className="flex items-center space-x-2.5 mb-4">
          <Globe className="w-5 h-5 text-brand-500" />
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {t('network.hostnameSettings')}
          </h3>
        </div>

        <form onSubmit={handleSaveHostnameAndDns} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('network.systemHostname')}
            </label>
            <input
              type="text"
              required
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('network.dnsServers')} (Dipisahkan tanda koma)
            </label>
            <input
              type="text"
              required
              value={dnsServers}
              onChange={(e) => setDnsServers(e.target.value)}
              placeholder="1.1.1.1, 8.8.8.8"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{t('network.updateDns')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Edit Interface Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Konfigurasi Antarmuka - ${selectedIface?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveInterface} className="space-y-4">
          <label className="flex items-center space-x-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={dhcp}
              onChange={(e) => setDhcp(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Gunakan DHCP Otomatis
            </span>
          </label>

          {!dhcp && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Alamat IPv4 Statis
                </label>
                <input
                  type="text"
                  required={!dhcp}
                  value={ipv4}
                  onChange={(e) => setIpv4(e.target.value)}
                  placeholder="192.168.1.50"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subnet Mask
                </label>
                <input
                  type="text"
                  required={!dhcp}
                  value={netmask}
                  onChange={(e) => setNetmask(e.target.value)}
                  placeholder="255.255.255.0"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Default Gateway
                </label>
                <input
                  type="text"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  placeholder="192.168.1.1"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              MTU (Maximum Transmission Unit)
            </label>
            <input
              type="number"
              min="1500"
              max="9000"
              value={mtu}
              onChange={(e) => setMtu(Number(e.target.value))}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-1">Standar: 1500, Jumbo Frame: 9000</p>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={savingIface}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {savingIface ? 'Menyimpan...' : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
