import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, BarChart3, Users, FileText, Wallet,
  Receipt, Settings, LogOut, Building2, Store, BookOpen, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const navItems = [
  { path: '/admin/dashboard',          label: 'ראשי',         icon: LayoutDashboard },
  { path: '/admin/stats',              label: 'סטטיסטיקות',   icon: BarChart3 },
  { path: '/admin/agents',             label: 'סוכנים',        icon: Users },
  { path: '/admin/deals',              label: 'עסקאות',        icon: FileText },
  { path: '/admin/reports',            label: 'הכנסות',        icon: Wallet },
  { path: '/admin/expenses',           label: 'הוצאות',        icon: Receipt },
  { path: '/admin/financial-reports',  label: 'דוחות',         icon: BookOpen },
  { path: '/admin/vendors',            label: 'ספקים',         icon: Store },
  { path: '/admin/settings',           label: 'הגדרות',        icon: Settings },
];

export default function AdminSidebar({ mobileOpen = false, onMobileClose }) {
  const location = useLocation();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm text-sidebar-foreground">אליעזר נכסים</p>
            <p className="text-xs text-sidebar-foreground/60">פורטל ניהול</p>
          </div>
        </div>
        {/* Close button on mobile */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onMobileClose}
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
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 right-0 h-full w-64 bg-sidebar z-50 transform transition-transform duration-300 lg:hidden
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 h-screen sticky top-0 bg-sidebar border-l border-sidebar-border shrink-0">
        {sidebarContent}
      </aside>
    </>
  );
}
