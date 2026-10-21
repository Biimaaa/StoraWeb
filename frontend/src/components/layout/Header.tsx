import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Activity,
  Sun,
  Moon,
  Globe,
  User as UserIcon,
  LogOut,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Check,
  RefreshCw,
  Server,
} from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import { useI18n } from '../../i18n/I18nContext';
import { alertsApi, jobsApi } from '../../api/client';
import { Alert, Job } from '../../types';
import { formatDate } from '../../utils/formatters';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useI18n();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [showJobsDropdown, setShowJobsDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const alertsRef = useRef<HTMLDivElement>(null);
  const jobsRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const fetchAlertsAndJobs = async () => {
    try {
      const [alertsData, jobsData] = await Promise.all([
        alertsApi.list(true),
        jobsApi.list(undefined, 10),
      ]);
      setAlerts(alertsData || []);
      setJobs(jobsData || []);
    } catch {
      // ignore in background polling
    }
  };

  useEffect(() => {
    fetchAlertsAndJobs();
    const interval = setInterval(fetchAlertsAndJobs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setShowAlertsDropdown(false);
      }
      if (jobsRef.current && !jobsRef.current.contains(e.target as Node)) {
        setShowJobsDropdown(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDismissAlert = async (id: number) => {
    try {
      await alertsApi.dismiss(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDismissAllAlerts = async () => {
    try {
      await alertsApi.dismissAll();
      setAlerts([]);
    } catch (err) {
      console.error(err);
    }
  };

  const activeJobs = jobs.filter((j) => j.status === 'running' || j.status === 'pending');

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      {/* Left side: System status badge */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Server className="w-3.5 h-3.5" />
          <span>System Healthy</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-3">
        {/* Language switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setLanguage('id')}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
              language === 'id'
                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            ID
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
              language === 'en'
                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            EN
          </button>
        </div>

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>

        {/* Active Jobs Menu */}
        <div className="relative" ref={jobsRef}>
          <button
            onClick={() => {
              setShowJobsDropdown(!showJobsDropdown);
              setShowAlertsDropdown(false);
              setShowUserDropdown(false);
            }}
            className={`relative p-2 rounded-lg transition-colors ${
              showJobsDropdown
                ? 'bg-slate-100 dark:bg-slate-800 text-brand-600'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className={`w-5 h-5 ${activeJobs.length > 0 ? 'text-brand-500 animate-spin' : ''}`} />
            {activeJobs.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                {activeJobs.length}
              </span>
            )}
          </button>

          {showJobsDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-brand-500" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                    {t('jobs.activeJobs')}
                  </span>
                </div>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
                  {jobs.length} tasks
                </span>
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto space-y-2.5">
                {jobs.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                    {t('jobs.noJobs')}
                  </p>
                ) : (
                  jobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {job.description || job.job_type}
                        </span>
                        <span
                          className={`font-semibold text-[10px] uppercase px-1.5 py-0.5 rounded ${
                            job.status === 'completed'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : job.status === 'failed'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                              : 'bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      {job.status === 'running' && (
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className="bg-brand-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress || 25}%` }}
                          />
                        </div>
                      )}
                      <div className="mt-1 text-[10px] text-slate-400 flex justify-between">
                        <span>{job.job_type}</span>
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alerts Bell Menu */}
        <div className="relative" ref={alertsRef}>
          <button
            onClick={() => {
              setShowAlertsDropdown(!showAlertsDropdown);
              setShowJobsDropdown(false);
              setShowUserDropdown(false);
            }}
            className={`relative p-2 rounded-lg transition-colors ${
              showAlertsDropdown
                ? 'bg-slate-100 dark:bg-slate-800 text-brand-600'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Bell className="w-5 h-5" />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white animate-bounce">
                {alerts.length}
              </span>
            )}
          </button>

          {showAlertsDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-rose-500" />
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                    {t('alerts.title')}
                  </span>
                </div>
                {alerts.length > 0 && (
                  <button
                    onClick={handleDismissAllAlerts}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    {t('alerts.dismissAll')}
                  </button>
                )}
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto space-y-2">
                {alerts.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4">
                    {t('alerts.empty')}
                  </p>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${
                        alert.level === 'critical' || alert.level === 'error'
                          ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                          : alert.level === 'warning'
                          ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50'
                          : 'bg-sky-50/50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/50'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {alert.level === 'critical' || alert.level === 'error' ? (
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        ) : alert.level === 'warning' ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <Info className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {alert.source}: {alert.message}
                        </p>
                        {alert.detail && (
                          <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                            {alert.detail}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-1">{formatDate(alert.created_at)}</p>
                      </div>
                      <button
                        onClick={() => handleDismissAlert(alert.id)}
                        title={t('alerts.dismiss')}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative pl-2 border-l border-slate-200 dark:border-slate-800" ref={userRef}>
          <button
            onClick={() => {
              setShowUserDropdown(!showUserDropdown);
              setShowAlertsDropdown(false);
              setShowJobsDropdown(false);
            }}
            className="flex items-center space-x-2.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm">
              {user?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                {user?.username || 'admin'}
              </p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role || 'administrator'}</p>
            </div>
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-400">{t('auth.loggedAs')}</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {user?.full_name || user?.username}
                </p>
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-400 font-semibold uppercase">
                  {user?.role}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('auth.logout')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
