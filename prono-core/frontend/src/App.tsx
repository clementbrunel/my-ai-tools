import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { GroupAdminCountsProvider } from './context/GroupAdminCountsContext';
import { UserCountsProvider } from './context/UserCountsContext';
import { SportProvider } from './context/SportContext';
import { ToastProvider } from './components/Toast';
import { MatchesProvider } from './context/MatchesContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Gages from './pages/Gages';
import GroupPage from './pages/GroupPage';
import OpenBetting from './pages/OpenBetting';
import F1Dashboard from './pages/f1/F1Dashboard';

function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  return null;
}

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <GroupAdminCountsProvider>
      <UserCountsProvider>
      <ToastProvider>
      <MatchesProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen bg-gray-50 dark:bg-wc-dark">
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Private */}
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <SportProvider>
                    <div className="flex flex-col min-h-screen">
                      <Navbar />
                      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl pb-safe">
                        <Routes>
                          {/* Foot */}
                          <Route path="/foot" element={<Dashboard />} />
                          <Route path="/foot/matches" element={<Matches />} />
                          <Route path="/foot/matches/:id" element={<MatchDetail />} />
                          <Route path="/foot/leaderboard" element={<Leaderboard />} />
                          <Route path="/foot/gages" element={<Gages />} />
                          <Route path="/foot/open-betting" element={<OpenBetting />} />

                          {/* F1 */}
                          <Route path="/f1" element={<F1Dashboard />} />

                          {/* Shared */}
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/groups" element={<GroupPage />} />
                          <Route path="/admin" element={<Admin />} />

                          {/* Redirects */}
                          <Route path="/" element={<Navigate to="/foot" replace />} />
                          <Route path="/dashboard" element={<Navigate to="/foot" replace />} />
                          <Route path="/matches" element={<Navigate to="/foot/matches" replace />} />
                          <Route path="/leaderboard" element={<Navigate to="/foot/leaderboard" replace />} />
                          <Route path="/gages" element={<Navigate to="/foot/gages" replace />} />
                        </Routes>
                      </main>
                    </div>
                  </SportProvider>
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
      </MatchesProvider>
      </ToastProvider>
      </UserCountsProvider>
      </GroupAdminCountsProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
