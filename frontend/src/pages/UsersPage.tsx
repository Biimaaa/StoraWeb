import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { usersApi } from '../api/client';
import { User, Group, UserRole } from '../types';
import { formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  FolderPlus,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Create User modal
  const [createUserOpen, setCreateUserOpen] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole>('operator');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Create Group modal
  const [createGroupOpen, setCreateGroupOpen] = useState<boolean>(false);
  const [groupName, setGroupName] = useState<string>('');
  const [groupDesc, setGroupDesc] = useState<string>('');
  const [creatingGroup, setCreatingGroup] = useState<boolean>(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      if (activeTab === 'users') {
        const list = await usersApi.listUsers();
        setUsers(list || []);
      } else {
        const list = await usersApi.listGroups();
        setGroups(list || []);
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserError(null);
    try {
      await usersApi.createUser({
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        password,
        role,
      });
      setCreateUserOpen(false);
      setUsername('');
      setFullName('');
      setEmail('');
      setPassword('');
      fetchData();
    } catch (err: any) {
      setUserError(err.message || 'Gagal membuat pengguna');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (!window.confirm(`Hapus pengguna '${u.username}'?`)) return;
    try {
      await usersApi.deleteUser(u.id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus pengguna');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingGroup(true);
    setGroupError(null);
    try {
      await usersApi.createGroup({
        name: groupName.trim(),
        description: groupDesc.trim() || undefined,
      });
      setCreateGroupOpen(false);
      setGroupName('');
      setGroupDesc('');
      fetchData();
    } catch (err: any) {
      setGroupError(err.message || 'Gagal membuat grup');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (g: Group) => {
    if (!window.confirm(`Hapus grup '${g.name}'?`)) return;
    try {
      await usersApi.deleteGroup(g.id);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus grup');
    }
  };

  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 uppercase">
            Admin
          </span>
        );
      case 'operator':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 dark:bg-brand-950/60 text-brand-700 dark:text-brand-300 uppercase">
            Operator
          </span>
        );
      case 'share_admin':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 uppercase">
            Share Admin
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
            Read Only
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {t('users.title')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('users.subtitle')}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {activeTab === 'users' ? (
            <button
              onClick={() => {
                setCreateUserOpen(true);
                setUserError(null);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('users.createUser')}</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setCreateGroupOpen(true);
                setGroupError(null);
              }}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold shadow-md shadow-brand-500/20 transition-all"
            >
              <FolderPlus className="w-4 h-4" />
              <span>{t('users.createGroup')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'users'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('users.tabs.users')}</span>
        </button>

        <button
          onClick={() => setActiveTab('groups')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'groups'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FolderPlus className="w-4 h-4" />
          <span>{t('users.tabs.groups')}</span>
        </button>
      </div>

      {/* Content */}
      {activeTab === 'users' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">{t('auth.username')}</th>
                  <th className="py-3 px-4">{t('users.fullName')}</th>
                  <th className="py-3 px-4">{t('users.role')}</th>
                  <th className="py-3 px-4">{t('users.totp')}</th>
                  <th className="py-3 px-4">{t('common.status')}</th>
                  <th className="py-3 px-4">{t('common.created')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                      <p>{t('common.loading')}</p>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {u.username}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {u.full_name || '-'}
                      </td>
                      <td className="py-3 px-4">{getRoleBadge(u.role)}</td>
                      <td className="py-3 px-4">
                        {u.totp_enabled ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Enabled</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Disabled</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.is_active
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {formatDate(u.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {u.username !== 'admin' && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
                  <th className="py-3 px-4">{t('users.description')}</th>
                  <th className="py-3 px-4">{t('users.memberCount')}</th>
                  <th className="py-3 px-4">{t('common.created')}</th>
                  <th className="py-3 px-4 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                      <p>{t('common.loading')}</p>
                    </td>
                  </tr>
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {g.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {g.description || '-'}
                      </td>
                      <td className="py-3 px-4 font-bold font-mono text-slate-800 dark:text-slate-200">
                        {g.member_count || 0}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {formatDate(g.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteGroup(g)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
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
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title={t('users.createUser')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {userError && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{userError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.username')}
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="operator01"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('users.fullName')}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email (Opsional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@internal.lan"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.password')} (Min. 8 karakter)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('users.role')}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            >
              <option value="operator">{t('users.roleOperator')}</option>
              <option value="admin">{t('users.roleAdmin')}</option>
              <option value="readonly">{t('users.roleReadonly')}</option>
              <option value="share_admin">{t('users.roleShareAdmin')}</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCreateUserOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={creatingUser}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {creatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>{t('common.create')}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        isOpen={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        title={t('users.createGroup')}
        maxWidth="md"
      >
        <form onSubmit={handleCreateGroup} className="space-y-4">
          {groupError && (
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{groupError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Grup
            </label>
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="storage-operators"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t('users.description')}
            </label>
            <input
              type="text"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="Grup hak akses staf penyimpanan"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setCreateGroupOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={creatingGroup}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 disabled:opacity-50"
            >
              {creatingGroup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
              <span>{t('common.create')}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
