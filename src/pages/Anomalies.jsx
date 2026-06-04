import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/constants';
import { toast } from 'sonner';

export default function Anomalies() {
  const queryClient = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: () => base44.entities.Expense.list('-date', 500),
  });

  const allAnomalies = useMemo(() => {
    const vendorStats = {};
    expenses.forEach(e => {
      if (!e.vendor_name) return;
      if (!vendorStats[e.vendor_name]) vendorStats[e.vendor_name] = { total: 0, count: 0, expenses: [] };
      vendorStats[e.vendor_name].total += e.total_amount || 0;
      vendorStats[e.vendor_name].count++;
      vendorStats[e.vendor_name].expenses.push(e);
    });

    const anomalies = [];
    Object.entries(vendorStats).forEach(([, stats]) => {
      if (stats.count < 2) return;
      const avg = stats.total / stats.count;
      stats.expenses.forEach(e => {
        if (e.total_amount > avg * 2.5 && e.total_amount > 100) {
          anomalies.push({ ...e, avgAmount: avg });
        }
      });
    });

    const markedAnomalies = expenses.filter(e => e.is_anomaly && !anomalies.find(a => a.id === e.id));
    return [...anomalies, ...markedAnomalies];
  }, [expenses]);

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.Expense.update(id, { is_anomaly: false, status: 'approved' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-all'] });
      toast.success('ההוצאה אושרה');
    },
    onError: () => toast.error('שגיאה באישור ההוצאה'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-100 rounded-xl"><AlertTriangle className="w-5 h-5 text-amber-600" /></div>
        <div>
          <h1 className="text-2xl font-bold">הוצאות חריגות</h1>
          <p className="text-muted-foreground text-sm mt-1">{allAnomalies.length} הוצאות חריגות שדורשות בדיקה</p>
        </div>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">ספק</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">ממוצע ספק</TableHead>
              <TableHead className="text-right">חריגה</TableHead>
              <TableHead className="text-right">פעולה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : allAnomalies.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">לא נמצאו הוצאות חריגות 🎉</TableCell></TableRow>
            ) : (
              allAnomalies.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{e.date ? format(new Date(e.date), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="font-medium">{e.vendor_name}</TableCell>
                  <TableCell className="font-semibold text-destructive">{formatCurrency(e.total_amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{e.avgAmount ? formatCurrency(e.avgAmount) : '-'}</TableCell>
                  <TableCell>
                    {e.avgAmount ? (
                      <Badge className="bg-orange-100 text-orange-800">{Math.round((e.total_amount / e.avgAmount - 1) * 100)}% מעל הממוצע</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-800">סומנה ידנית</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => approveMutation.mutate(e.id)}>
                      <CheckCircle2 className="w-4 h-4" /> אשר
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}