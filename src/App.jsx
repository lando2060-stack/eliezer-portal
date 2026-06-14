import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

// Layout
import AdminLayout from '@/components/layout/AdminLayout';

// Auth pages
import Login from '@/pages/Login';

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

function RequireAuth() {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
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
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
