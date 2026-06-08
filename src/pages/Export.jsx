import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Receipt, Users } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCSV } from '@/lib/csv';

export default function Export() {
  const { data: deals = [], isLoading: loadingDeals } = useQuery({ queryKey: ['deals'], queryFn: () => base44.entities.Deal.list('-created_date', 1000) });
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-date', 1000) });
  const { data: agents = [], isLoading: loadingAgents } = useQuery({ queryKey: ['agents'], queryFn: () => base44.entities.Agent.list() });

  const exports = [
    {
      label: 'עסקאות',
      desc: `${deals.length} רשומות`,
      icon: FileText,
      color: 'bg-blue-100 text-blue-600',
      loading: loadingDeals,
      onExport: () => {
        downloadCSV('עסקאות.csv', deals, {
          month: 'חודש', client_name: 'לקוח', address: 'כתובת', area: 'אזור',
          agent_name: 'סוכן', side: 'צד', deal_amount: 'סכום עסקה',
          commission_amount: 'עמלה', collected_actual: 'נגבה',
          agent_commission: 'עמלת סוכן', office_commission: 'עמלת משרד',
          paid_to_agent: 'שולם לסוכן', status: 'סטטוס',
          lawyer_name: 'עו"ד', cooperation_agent: 'שיתוף', lead_source: 'מקור',
        });
        toast.success('קובץ עסקאות יוצא בהצלחה');
      },
    },
    {
      label: 'הוצאות',
      desc: `${expenses.length} רשומות`,
      icon: Receipt,
      color: 'bg-purple-100 text-purple-600',
      loading: loadingExpenses,
      onExport: () => {
        downloadCSV('הוצאות.csv', expenses, {
          date: 'תאריך', vendor_name: 'ספק', category: 'קטגוריה',
          total_amount: 'סכום', currency: 'מטבע', payment_method: 'אמצעי תשלום',
          agent_name: 'סוכן', scope: 'שיוך', status: 'סטטוס', notes: 'הערות',
        });
        toast.success('קובץ הוצאות יוצא בהצלחה');
      },
    },
    {
      label: 'סוכנים',
      desc: `${agents.length} רשומות`,
      icon: Users,
      color: 'bg-emerald-100 text-emerald-600',
      loading: loadingAgents,
      onExport: () => {
        downloadCSV('סוכנים.csv', agents, {
          name: 'שם', email: 'מייל', phone: 'טלפון',
          commission_percent: 'אחוז עמלה', is_active: 'פעיל',
        });
        toast.success('קובץ סוכנים יוצא בהצלחה');
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Download className="w-6 h-6 text-primary" /> הפקת דוחות</h1>
        <p className="text-muted-foreground text-sm mt-1">ייצוא נתונים לקובץ CSV לפתיחה ב-Excel</p>
      </div>

      <div className="space-y-3 max-w-xl">
        {exports.map(({ label, desc, icon: Icon, color, loading, onExport }) => (
          <Card key={label} className="rounded-2xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
                <div>
                  <p className="font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground">{loading ? 'טוען...' : desc}</p>
                </div>
              </div>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={onExport} disabled={loading}>
                <Download className="w-4 h-4" /> ייצוא CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
