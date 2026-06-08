import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import AdminSidebar from './AdminSidebar';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isAdmin } from '@/lib/roles';

export default function AppLayout() {
  const { user } = useCurrentUser();
  const admin = isAdmin(user);

  if (admin) {
    return (
      <div className="min-h-screen bg-background flex">
        <AdminSidebar />
        <main className="flex-1 min-h-screen pb-20 lg:pb-6 overflow-x-hidden">
          <div className="px-4 pt-6 w-full max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
        {/* Mobile bottom nav for admin */}
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        <div className="px-4 pt-6 w-full max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
