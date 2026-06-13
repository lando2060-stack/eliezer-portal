import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import BottomNav from './BottomNav';

export default function AgentLayout() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-white border-b border-border">
        <div className="flex items-center justify-between px-4 py-2 max-w-5xl mx-auto">
          <img src="/logo.webp" alt="אליעזר נכסים" className="h-7 object-contain" />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl text-muted-foreground"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-4 h-4" />
              <span className="text-xs">הגדרות</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 rounded-xl text-muted-foreground"
              onClick={() => base44.auth.logout('/login')}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs">יציאה</span>
            </Button>
          </div>
        </div>
      </div>
      <main className="pb-20">
        <div className="px-4 pt-4 w-full max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
