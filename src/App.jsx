import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Deals from '@/pages/Deals';
import Expenses from '@/pages/Expenses';
import Agents from '@/pages/Agents';
import Reports from '@/pages/Reports';
import Categories from '@/pages/Categories';
import Settings from '@/pages/Settings';
import UploadReceipt from '@/pages/UploadReceipt';
import AdminPanel from '@/pages/AdminPanel';
import PendingApproval from '@/pages/PendingApproval';
import MissingReceipts from '@/pages/MissingReceipts';
import ActivityLog from '@/pages/ActivityLog';
import Documents from '@/pages/Documents';
import ClientsProjects from '@/pages/ClientsProjects';
import Anomalies from '@/pages/Anomalies';
import AwaitingApproval from '@/pages/AwaitingApproval';
import Vendors from '@/pages/Vendors';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'auth_required') {
    navigateToLogin();
    return null;
  }

  // Authenticated agent waiting for admin approval
  if (isAuthenticated && user && user.role === 'agent' && user.is_approved === false) {
    return <AwaitingApproval />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/upload" element={<UploadReceipt />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/pending" element={<PendingApproval />} />
          <Route path="/missing-receipts" element={<MissingReceipts />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/clients" element={<ClientsProjects />} />
          <Route path="/anomalies" element={<Anomalies />} />
          <Route path="/vendors" element={<Vendors />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App