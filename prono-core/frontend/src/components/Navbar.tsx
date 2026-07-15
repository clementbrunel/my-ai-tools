import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useGroupAdminCounts } from '@/context/GroupAdminCountsContext';
import { useUserCounts } from '@/context/UserCountsContext';
import { useSport } from '@/context/SportContext';
import { isAdmin } from '@/types';
import { useState } from 'react';
import Avatar from './Avatar';
import { getEquivalentPath } from '@/utils/sportPaths';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalBadge } = useGroupAdminCounts();
  const { totalBadge: userTotalBadge } = useUserCounts();
  const { sport, basePath, setSport } = useSport();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // On shared pages (/admin, /profile, /groups) the target path is the same
  // as the current one — navigate() would be a no-op there, so flip the
  // sport directly instead.
  const switchSport = (target: 'foot' | 'f1') => {
    const path = getEquivalentPath(location.pathname, target);
    if (path === location.pathname) setSport(target);
    else navigate(path);
  };

  const isActive = (path: string) => {
    const active =
      path === basePath
        ? location.pathname === basePath
        : location.pathname.startsWith(path);
    return active
      ? 'text-wc-gold font-bold border-b-2 border-wc-gold'
      : 'text-gray-200 hover:text-wc-gold transition-colors';
  };

  const isActiveGlobal = (path: string) =>
    location.pathname.startsWith(path)
      ? 'text-wc-gold font-bold border-b-2 border-wc-gold'
      : 'text-gray-400 hover:text-gray-200 transition-colors';

  const sportLinks =
    sport === 'f1'
      ? [
          { to: '/f1', label: '🏎 Accueil' },
          { to: '/f1/races', label: '🏁 Courses' },
          { to: '/f1/standings', label: '📊 Championnat' },
          { to: '/f1/gages', label: '🃏 Gages' },
          { to: '/f1/leaderboard', label: '🏆 Classement' },
        ]
      : [
          { to: '/foot', label: '🏠 Accueil' },
          { to: '/foot/matches', label: '⚽ Matchs' },
          { to: '/foot/gages', label: '🃏 Gages' },
          { to: '/foot/leaderboard', label: '🏆 Classement' },
        ];

  return (
    <nav className="wc-header shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">

          {/* Logo + sport switcher */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to={basePath} className="flex items-center gap-2 text-white font-black text-xl">
              <span className="text-2xl">{sport === 'f1' ? '🏎' : '⚽'}</span>
              <span className="text-wc-gold">Prono</span>Core
            </Link>
            <div className="flex gap-0.5 bg-black/25 rounded-lg p-1">
              <button
                onClick={() => switchSport('foot')}
                className={`px-2.5 py-1 rounded text-sm font-bold transition-colors ${
                  sport === 'foot' ? 'bg-wc-gold text-gray-900' : 'text-gray-300 hover:text-white'
                }`}
              >
                ⚽
              </button>
              <button
                onClick={() => switchSport('f1')}
                className={`px-2.5 py-1 rounded text-sm font-bold transition-colors ${
                  sport === 'f1' ? 'bg-wc-gold text-gray-900' : 'text-gray-300 hover:text-white'
                }`}
              >
                🏎
              </button>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center">
            {/* Sport-specific links */}
            <div className="flex items-center gap-6 pr-5">
              {sportLinks.map((link) => (
                <Link key={link.to} to={link.to} className={`text-sm ${isActive(link.to)}`}>
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-white/20 mx-1" />

            {/* Global links */}
            <div className="flex items-center gap-5 pl-5">
              <Link to="/groups" className={`relative text-sm ${isActiveGlobal('/groups')}`}>
                👥 Groupe
                {totalBadge > 0 && (
                  <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {totalBadge}
                  </span>
                )}
              </Link>
              {isAdmin(user) && (
                <Link to="/admin" className={`text-sm ${isActiveGlobal('/admin')}`}>
                  ⚙️ Admin
                </Link>
              )}
            </div>
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {user && (
              <>
                <Link
                  to="/profile"
                  className="relative flex items-center gap-2 text-white hover:text-wc-gold transition-colors"
                >
                  <div className="relative w-8 h-8">
                    <Avatar
                      src={user.avatarUrl}
                      alt={user.username}
                      fallbackText={user.username[0].toUpperCase()}
                      sizeClassName="w-8 h-8"
                      containerClassName="bg-wc-gold text-gray-900 font-bold text-sm"
                    />
                    {userTotalBadge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {userTotalBadge}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium">{user.displayName || user.username}</span>
                  {isAdmin(user) && <span className="badge-admin">Admin</span>}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-300 hover:text-wc-red transition-colors"
                >
                  Déconnexion
                </button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-white p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 mt-2">
            {/* Sport-specific */}
            <div className="flex flex-col border-t border-white/10 pt-3">
              {sportLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm px-3 py-3 min-h-[44px] flex items-center ${isActive(link.to)}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Divider + Global */}
            <div className="flex flex-col border-t border-white/20 pt-3 mt-1">
              <p className="text-[10px] text-white/40 uppercase tracking-widest px-3 pb-1">Général</p>
              <Link
                to="/groups"
                className={`relative text-sm px-3 py-3 min-h-[44px] flex items-center gap-2 ${isActiveGlobal('/groups')}`}
                onClick={() => setMobileOpen(false)}
              >
                👥 Groupe
                {totalBadge > 0 && (
                  <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 px-1">
                    {totalBadge}
                  </span>
                )}
              </Link>
              {isAdmin(user) && (
                <Link
                  to="/admin"
                  className={`text-sm px-3 py-3 min-h-[44px] flex items-center ${isActiveGlobal('/admin')}`}
                  onClick={() => setMobileOpen(false)}
                >
                  ⚙️ Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="text-sm px-3 py-3 min-h-[44px] flex items-center gap-2 text-gray-300"
                onClick={() => setMobileOpen(false)}
              >
                👤 Profil ({user?.displayName || user?.username})
                {userTotalBadge > 0 && (
                  <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 px-1">
                    {userTotalBadge}
                  </span>
                )}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm px-3 py-3 min-h-[44px] flex items-center text-left text-red-400"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
