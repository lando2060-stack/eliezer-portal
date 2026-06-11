import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Receipt, Wallet, Settings, Plus, X, DollarSign, TrendingUp } from 'lucide-react';
import ReceiptReviewDialog from '@/components/ReceiptReviewDialog';
import { useAgentPermissions } from '@/hooks/useAgentPermissions';

const navItems = [
  { path: '/',         label: 'דשבורד',  icon: LayoutDashboard },
  { path: '/deals',    label: 'עסקאות',  icon: FileText },
  { path: '/',         label: '',         icon: LayoutDashboard },
  { path: '/reports',  label: 'הכנסות',  icon: Wallet },
  { path: '/expenses', label: 'הוצאות',  icon: Receipt },
];

const ALL_FAB_ACTIONS = [
  { key: 'deal',    permKey: 'can_add_deal',     label: 'הוסף עסקה',   icon: FileText,   color: 'bg-blue-500' },
  { key: 'income',  permKey: 'can_add_income',    label: 'הוסף הכנסה',  icon: TrendingUp, color: 'bg-emerald-500' },
  { key: 'expense', permKey: 'can_add_expense',   label: 'הוסף הוצאה',  icon: Receipt,    color: 'bg-amber-500' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [fabOpen, setFabOpen] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const permissions = useAgentPermissions();

  // Detect if we're in the admin area
  const isAdmin = location.pathname.startsWith('/admin');

  // Admins see all actions; agents see only what they're allowed
  const fabActions = isAdmin
    ? ALL_FAB_ACTIONS
    : ALL_FAB_ACTIONS.filter(a => permissions[a.permKey]);
  const prefix = isAdmin ? '/admin' : '';

  const handleFabAction = (key) => {
    setFabOpen(false);
    switch (key) {
      case 'deal':
        navigate(`${prefix}/deals?new=1`);
        break;
      case 'income':
        navigate(`${prefix}/reports`, { state: { openPicker: true } });
        break;
      case 'expense':
        setShowReceiptDialog(true);
        break;
    }
  };

  return (
    <>
      {fabOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setFabOpen(false)} />
      )}

      {fabOpen && (
        <div className="fixed bottom-24 right-1/2 translate-x-1/2 z-50 flex flex-col items-center gap-3">
          {fabActions.map((action) => (
            <button
              key={action.key}
              onClick={() => handleFabAction(action.key)}
              className="flex items-center gap-3 bg-white shadow-xl rounded-2xl px-5 py-3"
            >
              <div className={`p-2 rounded-xl ${action.color}`}>
                <action.icon className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      <ReceiptReviewDialog
        open={showReceiptDialog}
        onClose={() => setShowReceiptDialog(false)}
        isAdminView={isAdmin}
        onSaved={() => setShowReceiptDialog(false)}
      />

      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {navItems.map((item, idx) => {
            const resolvedPath = `${prefix}${item.path === '/' ? (isAdmin ? '/dashboard' : '/') : item.path}`;
            const isActive = location.pathname === resolvedPath || (item.path === '/' && !isAdmin && location.pathname === '/');
            const isMid = idx === Math.floor(navItems.length / 2);

            if (isMid) {
              return (
                <div key="fab" className="flex flex-col items-center -mt-6">
                  <button
                    onClick={() => setFabOpen(!fabOpen)}
                    className="w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center text-white transition-transform active:scale-95"
                  >
                    {fabOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </button>
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={resolvedPath}
                className={`relative flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
