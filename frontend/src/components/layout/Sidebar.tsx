import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  HardDrive,
  Database,
  Layers,
  Camera,
  Share2,
  ShieldCheck,
  Users,
  Network,
  Cpu,
  ChevronDown,
  ChevronRight,
  Server,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export const Sidebar: React.FC = () => {
  const { t } = useI18n();
  const [storageOpen, setStorageOpen] = useState(true);

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20 dark:bg-brand-600'
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
    }`;

  const subNavItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center space-x-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
      isActive
        ? 'bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400 font-semibold'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0 transition-colors z-40">
      {/* Brand logo header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-slate-800 space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
          <Server className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-brand-600 to-sky-500 bg-clip-text text-transparent">
              StoraWeb
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400">
              NAS
            </span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Enterprise ZFS Engine</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-1.5">
        {/* Dashboard */}
        <NavLink to="/" end className={navItemClass}>
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          <span>{t('nav.dashboard')}</span>
        </NavLink>

        {/* Storage with Submenu */}
        <div className="pt-2">
          <button
            onClick={() => setStorageOpen(!storageOpen)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <Database className="w-4 h-4 flex-shrink-0 text-brand-500" />
              <span>{t('nav.storage')}</span>
            </div>
            {storageOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>

          {storageOpen && (
            <div className="pl-6 pr-1 mt-1 space-y-1 border-l-2 border-slate-100 dark:border-slate-800 ml-4">
              <NavLink to="/storage/pools" className={subNavItemClass}>
                <HardDrive className="w-3.5 h-3.5" />
                <span>{t('nav.pools')}</span>
              </NavLink>
              <NavLink to="/storage/datasets" className={subNavItemClass}>
                <Layers className="w-3.5 h-3.5" />
                <span>{t('nav.datasets')}</span>
              </NavLink>
              <NavLink to="/storage/disks" className={subNavItemClass}>
                <HardDrive className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('nav.disks')}</span>
              </NavLink>
              <NavLink to="/storage/snapshots" className={subNavItemClass}>
                <Camera className="w-3.5 h-3.5" />
                <span>{t('nav.snapshots')}</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Sharing */}
        <NavLink to="/sharing" className={navItemClass}>
          <Share2 className="w-4 h-4 flex-shrink-0" />
          <span>{t('nav.sharing')}</span>
        </NavLink>

        {/* Data Protection */}
        <NavLink to="/data-protection" className={navItemClass}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>{t('nav.dataProtection')}</span>
        </NavLink>

        {/* Users */}
        <NavLink to="/users" className={navItemClass}>
          <Users className="w-4 h-4 flex-shrink-0" />
          <span>{t('nav.users')}</span>
        </NavLink>

        {/* Network */}
        <NavLink to="/network" className={navItemClass}>
          <Network className="w-4 h-4 flex-shrink-0" />
          <span>{t('nav.network')}</span>
        </NavLink>

        {/* System */}
        <NavLink to="/system" className={navItemClass}>
          <Cpu className="w-4 h-4 flex-shrink-0" />
          <span>{t('nav.system')}</span>
        </NavLink>
      </div>

      {/* Footer Info & Setup Shortcut */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <NavLink
          to="/setup"
          className="flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-50/60 dark:bg-brand-950/30 hover:bg-brand-100 dark:hover:bg-brand-900/40 border border-brand-200 dark:border-brand-900/50 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>{t('nav.setup')}</span>
        </NavLink>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
          <span>StoraWeb v1.0</span>
          <span className="font-mono">Linux ZFS</span>
        </div>
      </div>
    </aside>
  );
};
