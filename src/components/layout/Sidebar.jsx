import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Receipt, Upload, FolderOpen, Tag, Building2, 
  Users, FileText, BarChart3, Settings, LogOut, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';

const navItems = [
  { path: '/', label: 'דשבורד', icon: LayoutDashboard },
  { path: '/expenses', label: 'הוצאות', icon: Receipt },
  { path: '/upload', label: 'העלאת קבלה', icon: Upload },
  { path: '/vendors', label: 'ספקים', icon: Building2 },
  { path: '/categories', label: 'קטגוריות', icon: Tag },
  { path: '/clients', label: 'לקוחות ופרויקטים', icon: Users },
  { path: '/documents', label: 'מרכז מסמכים', icon: FolderOpen },
  { path: '/missing-receipts', label: 'ללא קבלה', icon: Clock },
  { path: '/anomalies', label: 'הוצאות חריגות', icon: AlertTriangle },
  { path: '/reports', label: 'דוחות', icon: BarChart3 },
  { path: '/activity', label: 'יומן פעילות', icon: FileText },
  { path: '/settings', label: 'הגדרות', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 flex items-center justify-between border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
              <Receipt className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-sidebar-foreground">ניהול הוצאות</span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
        <button 
          onClick={() => setMobileOpen(false)}
          className="lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group
                ${isActive 
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20' 
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
              {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="text-sm">התנתק</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle - hidden, navigation via BottomNav */}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed top-0 right-0 h-full w-64 bg-sidebar z-50 transform transition-transform lg:hidden
        ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:block h-screen sticky top-0 bg-sidebar transition-all duration-300
        ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        {sidebarContent}
      </aside>
    </>
  );
}