import React from 'react';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function AwaitingApproval() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm space-y-6">
        <img src="/logo.webp" alt="אליעזר נכסים" className="h-16 mx-auto object-contain" />
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">ממתין לאישור</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            החשבון שלך נוצר בהצלחה.<br />
            מנהל המשרד יאשר את הגישה שלך בקרוב.<br />
            לאחר האישור תוכל להיכנס למערכת.
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-xl w-full" onClick={() => base44.auth.logout('/login')}>
          <LogOut className="w-4 h-4" /> יציאה
        </Button>
      </div>
    </div>
  );
}
