import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Users, FileText, Wallet,
  Receipt, Settings, LogOut, Building2, Store
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const navItems = [
  { path: '/admin/dashboard', label: 'דשבורד מנהל', icon: LayoutDashboard },
  { path: '/admin/stats',     label: 'סטטיסטיקות',  icon: BarChart3 },
  { path: '/admin/agents',    label: 'סוכנים',       icon: Users },
  { path: '/admin/deals',     label: 'עסקאות',       icon: FileText },
  { path: '/admin/reports',   label: 'הכנסות',       icon: Wallet },
  { path: '/admin/expenses',  label: 'הוצאות',       icon: Receipt },
  { path: '/admin/vendors',   label: 'ספקים',        icon: Store },
  { path: '/admin/settings',  label: 'הגדרות',       icon: Settings },
];

export default function AdminSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 bg-sidebar border-l border-sidebar-border shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm text-sidebar-foreground">אליעזר נכסים</p>
            <p className="text-xs text-sidebar-foreground/60">פורטל ניהול</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group
                ${active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => base44.auth.logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm">התנתק</span>
        </button>
      </div>
    </aside>
  );
}
