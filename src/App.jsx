import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/roles';

import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Layouts
import AdminLayout from '@/components/layout/AdminLayout';
import AgentLayout from '@/components/layout/AgentLayout';

// Admin pages
import Dashboard from '@/pages/Dashboard';
import Deals from '@/pages/Deals';
import Expenses from '@/pages/Expenses';
import Agents from '@/pages/Agents';
import Reports from '@/pages/Reports';
import FinancialReports from '@/pages/FinancialReports';
import Settings from '@/pages/Settings';
import UploadReceipt from '@/pages/UploadReceipt';
import Statistics from '@/pages/Statistics';
import ActivityLog from '@/pages/ActivityLog';
import Vendors from '@/pages/Vendors';

// Spinner
const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
  </div>
);

// Admin route guard — must be authenticated admin
function AdminRouteGuard() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/" replace />;

  return <Outlet />;
}

// Agent route guard — must be authenticated, non-admin
function AgentRouteGuard() {
  const { user, isAuthenticated, isLoadingAuth, authChecked } = useAuth();

  if (isLoadingAuth || !authChecked) return <Spinner />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (isAdmin(user)) return <Navigate to="/admin/dashboard" replace />;

  return <Outlet />;
}

function AuthenticatedApp() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register" element={<Navigate to="/login" replace />} />

      {/* Admin routes — /admin/* */}
      <Route element={<AdminRouteGuard />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/deals" element={<Deals />} />
          <Route path="/admin/agents" element={<Agents />} />
          <Route path="/admin/expenses" element={<Expenses />} />
          <Route path="/admin/reports" element={<Reports />} />
          <Route path="/admin/financial-reports" element={<FinancialReports />} />
          <Route path="/admin/stats" element={<Statistics />} />
          <Route path="/admin/settings" element={<Settings />} />
          <Route path="/admin/upload" element={<UploadReceipt />} />
          <Route path="/admin/activity" element={<ActivityLog />} />
          <Route path="/admin/vendors" element={<Vendors />} />
        </Route>
      </Route>

      {/* Agent routes — /* */}
      <Route element={<AgentRouteGuard />}>
        <Route element={<AgentLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/upload" element={<UploadReceipt />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
