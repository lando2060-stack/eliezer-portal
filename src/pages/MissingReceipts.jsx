import React, { useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/constants';
import { toast } from 'sonner';

export default function MissingReceipts() {
  const queryClient = useQueryClient();
  const fileInputRefs = useRef({});

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses-missing'],
    queryFn: () => base44.entities.Expense.filter({ has_receipt: false }, '-date', 200),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ expenseId, file }) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Expense.update(expenseId, { receipt_url: file_url, has_receipt: true, status: 'pending_approval' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses-missing'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('הקבלה הועלתה בהצלחה');
    },
    onError: () => toast.error('שגיאה בהעלאת הקבלה — אנא נסה שוב'),
  });

  const handleFileChange = (expenseId, e) => {
    const file = e.target.files[0];
    if (file) uploadMutation.mutate({ expenseId, file });
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-red-100 rounded-xl"><AlertCircle className="w-5 h-5 text-red-600" /></div>
        <div>
          <h1 className="text-2xl font-bold">הוצאות ללא קבלה</h1>
          <p className="text-muted-foreground text-sm mt-1">{expenses.length} הוצאות ממתינות להשלמת מסמך</p>
        </div>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">ספק</TableHead>
              <TableHead className="text-right">קטגוריה</TableHead>
              <TableHead className="text-right">סכום</TableHead>
              <TableHead className="text-right">פעולה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">טוען...</TableCell></TableRow>
            ) : expenses.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">כל ההוצאות מכילות קבלה 🎉</TableCell></TableRow>
            ) : (
              expenses.map(e => (
                <TableRow key={e.id}>
                  <TableCell>{e.date ? format(new Date(e.date), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="font-medium">{e.vendor_name || '-'}</TableCell>
                  <TableCell>{e.category || '-'}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(e.total_amount)}</TableCell>
                  <TableCell>
                    <input
                      type="file"
                      className="hidden"
                      ref={el => fileInputRefs.current[e.id] = el}
                      accept="image/*,.pdf"
                      onChange={(ev) => handleFileChange(e.id, ev)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl"
                      onClick={() => fileInputRefs.current[e.id]?.click()}
                      disabled={uploadMutation.isPending}
                    >
                      <Upload className="w-4 h-4" /> העלה קבלה
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