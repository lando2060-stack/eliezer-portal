import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pb-20">
        <div className="p-4 pt-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}