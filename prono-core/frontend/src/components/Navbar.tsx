import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGroupAdminCounts } from '../context/GroupAdminCountsContext';
import { useUserCounts } from '../context/UserCountsContext';
import { useSport } from '../context/SportContext';
import { isAdmin } from '../types';
import { useState } from 'react';
import Avatar from './Avatar';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalBadge } = useGroupAdminCounts();
  const { totalBadge: userTotalBadge } = useUserCounts();
  const { sport, basePath } = useSport();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
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

  const navLinks =
    sport === 'f1'
      ? [
          { to: '/f1', label: '🏎 Accueil' },
          { to: '/groups', label: '👥 Groupe' },
        ]
      : [
          { to: '/foot', label: '🏠 Accueil' },
          { to: '/foot/matches', label: '⚽ Matchs' },
          { to: '/foot/gages', label: '🃏 Gages' },
          { to: '/foot/leaderboard', label: '🏆 Classement' },
          { to: '/groups', label: '👥 Groupe' },
        ];

  return (
    <nav className="wc-header shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo + sport switcher */}
          <div className="flex items-center gap-3">
            <Link to={basePath} className="flex items-center gap-2 text-white font-black text-xl">
              <span className="text-2xl">{sport === 'f1' ? '🏎' : '⚽'}</span>
              <span className="text-wc-gold">Prono</span>Core
            </Link>
            <div className="flex gap-0.5 bg-black/25 rounded-lg p-1">
              <button
                onClick={() => navigate('/foot')}
                className={`px-2.5 py-1 rounded text-sm font-bold transition-colors ${
                  sport === 'foot'
                    ? 'bg-wc-gold text-gray-900'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                ⚽
              </button>
              <button
                onClick={() => navigate('/f1')}
                className={`px-2.5 py-1 rounded text-sm font-bold transition-colors ${
                  sport === 'f1'
                    ? 'bg-wc-gold text-gray-900'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                🏎
              </button>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className={`relative text-sm ${isActive(link.to)}`}>
                {link.label}
                {link.to === '/groups' && totalBadge > 0 && (
                  <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {totalBadge}
                  </span>
                )}
              </Link>
            ))}
            {isAdmin(user) && (
              <Link to="/admin" className={`text-sm ${isActive('/admin')}`}>
                ⚙️ Admin
              </Link>
            )}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
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
          <div className="md:hidden pb-4 border-t border-white/10 mt-2">
            <div className="flex flex-col gap-3 pt-3">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative text-sm px-3 py-3 min-h-[44px] flex items-center ${isActive(link.to)}`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                  {link.to === '/groups' && totalBadge > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold leading-none rounded-full min-w-[16px] h-4 px-1">
                      {totalBadge}
                    </span>
                  )}
                </Link>
              ))}
              {isAdmin(user) && (
                <Link
                  to="/admin"
                  className={`text-sm px-3 py-3 min-h-[44px] flex items-center ${isActive('/admin')}`}
                  onClick={() => setMobileOpen(false)}
                >
                  ⚙️ Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="text-sm px-3 py-3 min-h-[44px] flex items-center gap-2 text-gray-200"
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
