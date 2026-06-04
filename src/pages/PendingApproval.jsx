import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Eye, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/constants';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ExpenseEditDialog from '@/components/expenses/ExpenseEditDialog';

export default function PendingApproval() {
  const queryClient = useQueryClient();
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list('-created_date', 200),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => base44.entities.Category.list(),
  });

  const pending = expenses.filter(e => e.status === 'pending_approval');

  const sendExpenseEmail = async (expense, type, reason = '') => {
    try {
      // מציאת המייל של הסוכן דרך agents
      const agents = await base44.entities.Agent.filter({ id: expense.agent_id });
      const agentEmail = agents?.[0]?.email;
      if (!agentEmail) return;
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: agentEmail,
          type,
          data: { vendor: expense.vendor_name, amount: `₪${expense.total_amount}`, agentName: expense.agent_name, reason },
        }),
      });
    } catch { /* non-fatal */ }
  };

  const approveMutation = useMutation({
    mutationFn: (expense) => base44.entities.Expense.update(expense.id, { status: 'approved' }),
    onSuccess: (_, expense) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('ההוצאה אושרה');
      sendExpenseEmail(expense, 'expense_approved');
    },
    onError: () => toast.error('שגיאה באישור ההוצאה'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ expense, reason }) => base44.entities.Expense.update(expense.id, {
      status: 'rejected',
      ...(reason ? { notes: reason } : {}),
    }),
    onSuccess: (_, { expense, reason }) => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('ההוצאה נדחתה');
      sendExpenseEmail(expense, 'expense_rejected', reason);
      setRejectTarget(null);
      setRejectReason('');
    },
    onError: () => toast.error('שגיאה בדחיית ההוצאה'),
  });

  const handleReject = (expense) => {
    setRejectTarget(expense);
    setRejectReason('');
  };

  const confirmReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate({ expense: rejectTarget, reason: rejectReason });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ממתין לאישור</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pending.length} הוצאות ממתינות לאישורך
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">טוען...</div>
      ) : pending.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="font-semibold text-lg">הכל מאושר!</p>
            <p className="text-muted-foreground text-sm mt-1">אין הוצאות הממתינות לאישור</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map(expense => (
            <Card key={expense.id} className="rounded-2xl hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {expense.receipt_url ? (
                      <img
                        src={expense.receipt_url}
                        alt="קבלה"
                        className="w-14 h-14 rounded-xl object-cover border border-border flex-shrink-0 cursor-pointer"
                        onClick={() => setViewExpense(expense)}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                        <FileText className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{expense.vendor_name || 'לא ידוע'}</p>
                      <p className="text-sm text-muted-foreground">
                        {expense.date ? format(new Date(expense.date), 'dd/MM/yyyy') : '-'}
                        {expense.category && ` • ${expense.category}`}
                        {expense.agent_name && ` • ${expense.agent_name}`}
                      </p>
                      <p className="text-lg font-bold text-primary mt-0.5">
                        {formatCurrency(expense.total_amount, expense.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl text-xs"
                      onClick={() => setViewExpense(expense)}
                    >
                      <Eye className="w-3.5 h-3.5" /> צפה
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-xl text-xs border-destructive text-destructive hover:bg-destructive hover:text-white"
                      onClick={() => handleReject(expense)}
                      disabled={rejectMutation.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5" /> דחה
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 rounded-xl text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => approveMutation.mutate(expense)}
                      disabled={approveMutation.isPending}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> אשר
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject with reason dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={() => setRejectTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>דחיית הוצאה</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              הוצאה: <strong>{rejectTarget?.vendor_name}</strong> — {formatCurrency(rejectTarget?.total_amount)}
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">סיבת הדחייה (אופציונלי)</label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="הסבר לסוכן מדוע ההוצאה נדחתה..."
                rows={3}
                className="rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setRejectTarget(null)}
              >
                ביטול
              </Button>
              <Button
                className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90"
                onClick={confirmReject}
                disabled={rejectMutation.isPending}
              >
                <XCircle className="w-4 h-4 ml-1" /> דחה
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>פרטי הוצאה</DialogTitle>
          </DialogHeader>
          {viewExpense && (
            <div className="space-y-3 text-sm">
              {viewExpense.receipt_url && (
                <div className="bg-muted rounded-xl overflow-hidden mb-4">
                  <img src={viewExpense.receipt_url} alt="קבלה" className="w-full max-h-64 object-contain" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['ספק', viewExpense.vendor_name],
                  ['תאריך', viewExpense.date ? format(new Date(viewExpense.date), 'dd/MM/yyyy') : '-'],
                  ['סכום כולל', formatCurrency(viewExpense.total_amount, viewExpense.currency)],
                  ['קטגוריה', viewExpense.category || '-'],
                  ['סוכן', viewExpense.agent_name || '-'],
                  ['אמצעי תשלום', viewExpense.payment_method || '-'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-muted-foreground text-xs">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {viewExpense.notes && (
                <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground">{viewExpense.notes}</div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 rounded-xl bg-green-600 hover:bg-green-700"
                  onClick={() => { approveMutation.mutate(viewExpense); setViewExpense(null); }}
                >
                  <CheckCircle className="w-4 h-4 ml-2" /> אשר
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-destructive text-destructive hover:bg-destructive hover:text-white"
                  onClick={() => { setViewExpense(null); handleReject(viewExpense); }}
                >
                  <XCircle className="w-4 h-4 ml-2" /> דחה
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setEditExpense(viewExpense); setViewExpense(null); }}>
                  ערוך
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {editExpense !== null && (
        <ExpenseEditDialog
          expense={editExpense}
          categories={categories}
          onClose={() => setEditExpense(null)}
        />
      )}
    </div>
  );
}
