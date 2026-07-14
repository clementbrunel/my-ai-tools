import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSport } from '../context/SportContext';
import { isAdmin } from '../types';
import type { Sport } from '../types';
import AdminMatchesTab from './admin/AdminMatchesTab';
import AdminCompetitionsTab from './admin/AdminCompetitionsTab';
import AdminForfeitsTab from './admin/AdminForfeitsTab';
import AdminUsersTab from './admin/AdminUsersTab';
import AdminEmailsTab from './admin/AdminEmailsTab';
import AdminF1Tab from './admin/AdminF1Tab';

type AdminTab = 'competitions' | 'events' | 'forfeits' | 'users' | 'emails';

const Admin: React.FC = () => {
  const { user } = useAuth();
  const { sport } = useSport();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');
  // The whole admin page is scoped to one sport: competitions are filtered
  // and the events tab shows either matches or races. Defaults to the
  // universe the admin navigated from.
  const [adminSport, setAdminSport] = useState<Sport>(sport === 'f1' ? 'F1' : 'FOOT');

  useEffect(() => {
    if (!isAdmin(user)) navigate('/dashboard');
  }, [user, navigate]);

  if (!isAdmin(user)) return null;

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'competitions', label: '🏆 Compétitions' },
    { id: 'events', label: adminSport === 'F1' ? '🏁 Courses' : '⚽ Matchs' },
    { id: 'forfeits', label: '🃏 Gages' },
    { id: 'users', label: '👥 Utilisateurs' },
    { id: 'emails', label: '📧 Emails' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="page-title mb-0">⚙️ Administration</h1>
        <span className="badge-admin">ADMIN</span>

        {/* Sport scope — conditions competitions and the events tab */}
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 ml-auto">
          {(
            [
              ['FOOT', '⚽ Foot'],
              ['F1', '🏎 F1'],
            ] as [Sport, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setAdminSport(value)}
              className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
                adminSport === value
                  ? 'bg-white dark:bg-wc-dark-secondary text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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

      {activeTab === 'competitions' && <AdminCompetitionsTab sport={adminSport} />}
      {activeTab === 'events' && (adminSport === 'F1' ? <AdminF1Tab /> : <AdminMatchesTab />)}
      {activeTab === 'forfeits' && <AdminForfeitsTab />}
      {activeTab === 'users' && <AdminUsersTab />}
      {activeTab === 'emails' && <AdminEmailsTab />}
    </div>
  );
};

export default Admin;
