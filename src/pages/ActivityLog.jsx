import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Pencil, Trash2, CheckCircle2, XCircle, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_CONFIG = {
  upload: { label: 'העלאה', icon: Upload, color: 'bg-blue-100 text-blue-700' },
  edit: { label: 'עריכה', icon: Pencil, color: 'bg-amber-100 text-amber-700' },
  delete: { label: 'מחיקה', icon: Trash2, color: 'bg-red-100 text-red-700' },
  approve: { label: 'אישור', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  reject: { label: 'דחייה', icon: XCircle, color: 'bg-red-100 text-red-700' },
  export: { label: 'ייצוא', icon: Download, color: 'bg-purple-100 text-purple-700' },
  view: { label: 'צפייה', icon: Eye, color: 'bg-gray-100 text-gray-600' },
};

export default function ActivityLogPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['activity-logs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 200),
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">יומן פעילות</h1>
        <p className="text-muted-foreground text-sm mt-1">היסטוריית פעולות במערכת</p>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-12">טוען...</p>
      ) : logs.length === 0 ? (
        <Card className="rounded-2xl p-12 text-center text-muted-foreground">אין פעילות עדיין</Card>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.view;
            const Icon = config.icon;
            return (
              <Card key={log.id} className="rounded-2xl p-4 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <div className={`p-2 rounded-xl ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{log.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {log.user_name || 'משתמש'} • {log.created_date ? format(new Date(log.created_date), 'dd/MM/yyyy HH:mm') : ''}
                  </p>
                </div>
                <Badge variant="secondary" className={`text-xs ${config.color}`}>{config.label}</Badge>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}