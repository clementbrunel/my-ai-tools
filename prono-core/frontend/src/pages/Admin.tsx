import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../types';
import AdminMatchesTab from './admin/AdminMatchesTab';
import AdminCompetitionsTab from './admin/AdminCompetitionsTab';
import AdminForfeitsTab from './admin/AdminForfeitsTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminEmailsTab from './admin/AdminEmailsTab';
import AdminF1Tab from './admin/AdminF1Tab';

type AdminTab = 'competitions' | 'matches' | 'f1' | 'forfeits' | 'users' | 'emails';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');

  useEffect(() => {
    if (!isAdmin(user)) navigate('/dashboard');
  }, [user, navigate]);

  if (!isAdmin(user)) return null;

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'competitions', label: '🏆 Compétitions' },
    { id: 'matches', label: '⚽ Matchs' },
    { id: 'f1', label: '🏎 F1' },
    { id: 'forfeits', label: '🃏 Gages' },
    { id: 'users', label: '👥 Utilisateurs' },
    { id: 'emails', label: '📧 Emails' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="page-title mb-0">⚙️ Administration</h1>
        <span className="badge-admin">ADMIN</span>
      </div>

      {/* Mobile: native select */}
      <div className="md:hidden">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as AdminTab)}
          className="input-field w-full"
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop: tab strip */}
      <div className="hidden md:flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-wc-green text-wc-green'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'competitions' && <AdminCompetitionsTab />}
      {activeTab === 'matches' && <AdminMatchesTab />}
      {activeTab === 'f1' && <AdminF1Tab />}
      {activeTab === 'forfeits' && <AdminForfeitsTab />}
      {activeTab === 'users' && <AdminUsersTab />}
      {activeTab === 'emails' && <AdminEmailsTab />}
    </div>
  );
};

export default Admin;
