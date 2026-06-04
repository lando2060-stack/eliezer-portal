import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Receipt, Wallet, Settings, Plus, X, Upload, PenLine, DollarSign } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isAdmin } from '@/lib/roles';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const agentNav = [
  { path: '/', label: 'דשבורד', icon: LayoutDashboard },
  { path: '/deals', label: 'עסקאות', icon: FileText },
  { path: '/expenses', label: 'הוצאות', icon: Receipt },
  { path: '/reports', label: 'כספים', icon: Wallet },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

const adminNav = [
  { path: '/', label: 'דשבורד', icon: LayoutDashboard },
  { path: '/deals', label: 'עסקאות', icon: FileText },
  { path: '/expenses', label: 'הוצאות', icon: Receipt },
  { path: '/reports', label: 'כספים', icon: Wallet },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

const fabActions = [
  { path: '/deals?new=1', label: 'עסקה חדשה', icon: PenLine, color: 'bg-blue-500' },
  { path: '/deals?income=1', label: 'הכנסה חדשה', icon: DollarSign, color: 'bg-emerald-500' },
  { path: '/upload', label: 'העלאת קבלה', icon: Upload, color: 'bg-amber-500' },
  { path: '/expenses?new=1', label: 'הוצאה ידנית', icon: Receipt, color: 'bg-purple-500' },
];

export default function BottomNav() {
  const location = useLocation();
  const [fabOpen, setFabOpen] = useState(false);
  const { user } = useCurrentUser();
  const admin = isAdmin(user);

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-date', 500),
    enabled: admin,
  });
  const pendingCount = admin ? expenses.filter(e => e.status === 'pending_approval').length : 0;

  const navItems = admin ? adminNav : agentNav;

  return (
    <>
      {fabOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setFabOpen(false)} />
      )}

      {fabOpen && (
        <div className="fixed bottom-24 right-1/2 translate-x-1/2 z-50 flex flex-col items-center gap-3">
          {fabActions.map((action, i) => (
            <Link
              key={i}
              to={action.path}
              onClick={() => setFabOpen(false)}
              className="flex items-center gap-3 bg-white shadow-xl rounded-2xl px-5 py-3"
            >
              <div className={`p-2 rounded-xl ${action.color}`}>
                <action.icon className="w-4 h-4 text-white" />
              </div>
              <span className="font-medium text-sm">{action.label}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
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

            const showBadge = admin && item.path === '/expenses' && pendingCount > 0;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <div className="relative">
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
