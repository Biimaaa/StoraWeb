import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { systemApi } from '../api/client';
import {
  Server,
  Globe,
  Network,
  Lock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export const SetupWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useI18n();

  const [step, setStep] = useState<number>(1);
  const [selectedLang, setSelectedLang] = useState<'id' | 'en'>(language);
  const [timezone, setTimezone] = useState<string>('Asia/Jakarta');
  const [hostname, setHostname] = useState<string>('storaweb-nas');
  const [dhcp, setDhcp] = useState<boolean>(true);
  const [ipv4, setIpv4] = useState<string>('192.168.1.100');
  const [netmask, setNetmask] = useState<string>('255.255.255.0');
  const [gateway, setGateway] = useState<string>('192.168.1.1');
  const [dns, setDns] = useState<string>('1.1.1.1, 8.8.8.8');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLanguageSelect = (lang: 'id' | 'en') => {
    setSelectedLang(lang);
    setLanguage(lang);
  };

  const isStepValid = () => {
    if (step === 1) return true;
    if (step === 2) {
      if (!hostname.trim()) return false;
      if (!dhcp && (!ipv4.trim() || !netmask.trim())) return false;
      return true;
    }
    if (step === 3) {
      return adminPassword.length >= 8 && adminPassword === confirmPassword;
    }
    return true;
  };

  const handleFinishSetup = async () => {
    setSubmitting(true);
    setError(null);

    const dnsList = dns.split(',').map((s) => s.trim()).filter(Boolean);

    try {
      await systemApi.setup({
        language: selectedLang,
        timezone,
        hostname: hostname.trim(),
        network: {
          dhcp,
          ipv4_address: dhcp ? null : ipv4.trim(),
          ipv4_netmask: dhcp ? null : netmask.trim(),
          gateway: dhcp ? null : gateway.trim(),
          dns_servers: dnsList,
        },
        admin_password: adminPassword,
      });
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Gagal menyelesaikan penyiapan awal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 p-8 sm:p-10 space-y-8">
        {/* Brand header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white shadow-xl shadow-brand-500/25 mb-3">
            <Server className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('wizard.setupTitle')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi parameter dasar server NAS Anda dalam 4 langkah mudah
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-5">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center space-x-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s
                    ? 'bg-brand-500 text-white ring-4 ring-brand-500/20'
                    : step > s
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}
              >
                {step > s ? '✓' : s}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  step === s ? 'text-brand-600 dark:text-brand-400 font-bold' : 'text-slate-400'
                }`}
              >
                {s === 1
                  ? t('wizard.setupStep1')
                  : s === 2
                  ? t('wizard.setupStep2')
                  : s === 3
                  ? t('wizard.setupStep3')
                  : t('wizard.setupStep4')}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* Step 1: Language & Timezone */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Pilih Bahasa Antarmuka (Language)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleLanguageSelect('id')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    selectedLang === 'id'
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 ring-2 ring-brand-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">🇮🇩 Bahasa Indonesia</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Bahasa Utama Sistem</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleLanguageSelect('en')}
                  className={`p-3.5 rounded-xl border text-left transition-all ${
                    selectedLang === 'en'
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 ring-2 ring-brand-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">🇬🇧 English</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Standard English</p>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Zona Waktu Server (Timezone)
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              >
                <option value="Asia/Jakarta">Asia/Jakarta (WIB, UTC+7)</option>
                <option value="Asia/Makassar">Asia/Makassar (WITA, UTC+8)</option>
                <option value="Asia/Jayapura">Asia/Jayapura (WIT, UTC+9)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 2: Network & Hostname */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Host Server (Hostname)
              </label>
              <input
                type="text"
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="storaweb-nas"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>

            <label className="flex items-center space-x-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={dhcp}
                onChange={(e) => setDhcp(e.target.checked)}
                className="rounded text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Gunakan DHCP Otomatis untuk Antarmuka Utama
              </span>
            </label>

            {!dhcp && (
              <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Alamat IPv4
                  </label>
                  <input
                    type="text"
                    value={ipv4}
                    onChange={(e) => setIpv4(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gateway
                  </label>
                  <input
                    type="text"
                    value={gateway}
                    onChange={(e) => setGateway(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Admin Password */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tetapkan kata sandi baru untuk akun administrator utama (<span className="font-mono font-bold">admin</span>).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kata Sandi Baru (Min. 8 karakter)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ulangi Kata Sandi Baru
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* Step 4: Completion */}
        {step === 4 && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t('wizard.setupComplete')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Konfigurasi NAS berhasil disimpan. Anda dapat langsung mengelola storage pools, datasets, dan fitur sharing.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 px-6 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-sky-500 hover:from-brand-500 hover:to-sky-400 text-white font-semibold text-xs shadow-lg shadow-brand-500/25 transition-all"
            >
              {t('wizard.goToDashboard')}
            </button>
          </div>
        )}

        {/* Footer Navigation */}
        {step < 4 && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-800">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t('common.back')}</span>
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!isStepValid()}
                className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 disabled:opacity-50"
              >
                <span>{t('common.next')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishSetup}
                disabled={!isStepValid() || submitting}
                className="flex items-center space-x-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>Selesaikan Penyiapan</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
