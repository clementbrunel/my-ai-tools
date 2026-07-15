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
import TeamDetail from './pages/TeamDetail';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Gages from './pages/Gages';
import GroupPage from './pages/GroupPage';
import OpenBetting from './pages/OpenBetting';
import F1Dashboard from './pages/f1/F1Dashboard';
import F1Races from './pages/f1/F1Races';
import F1RaceDetail from './pages/f1/F1RaceDetail';
import F1Standings from './pages/f1/F1Standings';
import DriverDetail from './pages/f1/DriverDetail';
import F1OpenBetting from './pages/f1/F1OpenBetting';
import F1Bets from './pages/f1/F1Bets';

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
                          <Route path="/foot/teams/:id" element={<TeamDetail />} />
                          <Route path="/foot/leaderboard" element={<Leaderboard />} />
                          <Route path="/foot/gages" element={<Gages />} />
                          <Route path="/foot/open-betting" element={<OpenBetting />} />

                          {/* F1 */}
                          <Route path="/f1" element={<F1Dashboard />} />
                          <Route path="/f1/races" element={<F1Races />} />
                          <Route path="/f1/races/:id" element={<F1RaceDetail />} />
                          <Route path="/f1/standings" element={<F1Standings />} />
                          <Route path="/f1/drivers/:id" element={<DriverDetail />} />
                          <Route path="/f1/leaderboard" element={<Leaderboard />} />
                          <Route path="/f1/open-betting" element={<F1OpenBetting />} />
                          <Route path="/f1/bets" element={<F1Bets />} />

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
                          <Route path="/open-betting" element={<Navigate to="/foot/open-betting" replace />} />
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
