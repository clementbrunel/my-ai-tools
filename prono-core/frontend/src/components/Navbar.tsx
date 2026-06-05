import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGroupAdminCounts } from '../context/GroupAdminCountsContext';
import { isAdmin } from '../types';
import { useState } from 'react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { totalBadge } = useGroupAdminCounts();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname === path
      ? 'text-wc-gold font-bold border-b-2 border-wc-gold'
      : 'text-gray-200 hover:text-wc-gold transition-colors';

  const navLinks = [
    { to: '/dashboard', label: '🏠 Accueil' },
    { to: '/matches', label: '⚽ Matchs' },
    { to: '/gages', label: '🃏 Gages' },
    { to: '/leaderboard', label: '🏆 Classement' },
    { to: '/groups', label: '👥 Groupe' },
  ];

  return (
    <nav className="wc-header shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2 text-white font-black text-xl">
            <span className="text-2xl">⚽</span>
            <span className="text-wc-gold">Prono</span>Core
          </Link>

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
                  className="flex items-center gap-2 text-white hover:text-wc-gold transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-wc-gold text-gray-900 flex items-center justify-center font-bold text-sm">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.username} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      user.username[0].toUpperCase()
                    )}
                  </div>
                  <span className="text-sm font-medium">{user.username}</span>
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
            className="md:hidden text-white p-2"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 border-t border-green-700 mt-2">
            <div className="flex flex-col gap-3 pt-3">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative text-sm px-2 py-1 ${isActive(link.to)}`}
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
                  className={`text-sm px-2 py-1 ${isActive('/admin')}`}
                  onClick={() => setMobileOpen(false)}
                >
                  ⚙️ Admin
                </Link>
              )}
              <Link
                to="/profile"
                className="text-sm px-2 py-1 text-gray-200"
                onClick={() => setMobileOpen(false)}
              >
                👤 Profil ({user?.username})
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm px-2 py-1 text-left text-red-400"
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
