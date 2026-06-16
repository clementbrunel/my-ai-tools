import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
import { AuthProvider } from './context/AuthContext';
import { GroupAdminCountsProvider } from './context/GroupAdminCountsContext';
import { UserCountsProvider } from './context/UserCountsContext';
import { ToastProvider } from './components/Toast';
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

function App() {
  return (
    <AuthProvider>
      <GroupAdminCountsProvider>
      <UserCountsProvider>
      <ToastProvider>
      <BrowserRouter>
        <ScrollToTop />
        <div className="min-h-screen bg-gray-50 dark:bg-wc-dark">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/*"
              element={
                <PrivateRoute>
                  <div className="flex flex-col min-h-screen">
                    <Navbar />
                    <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl pb-safe">
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/matches" element={<Matches />} />
                        <Route path="/matches/:id" element={<MatchDetail />} />
                        <Route path="/leaderboard" element={<Leaderboard />} />
                        <Route path="/gages" element={<Gages />} />
                        <Route path="/profile" element={<Profile />} />
                        <Route path="/groups" element={<GroupPage />} />
                        <Route path="/open-betting" element={<OpenBetting />} />
                        <Route path="/admin" element={<Admin />} />
                      </Routes>
                    </main>
                  </div>
                </PrivateRoute>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
      </ToastProvider>
      </UserCountsProvider>
      </GroupAdminCountsProvider>
    </AuthProvider>
  );
}

export default App;
