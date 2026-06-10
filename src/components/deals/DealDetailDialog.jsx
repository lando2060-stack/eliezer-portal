import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, DEAL_STATUS_MAP } from '@/lib/constants';
import { isAdmin } from '@/lib/roles';
import { toast } from 'sonner';
import AddPaymentDialog from './AddPaymentDialog';

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-b-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-left">{value || '-'}</span>
    </div>
  );
}

export default function DealDetailDialog({ deal, agents, currentUser, onEdit, onClose }) {
  const [showAddPayment, setShowAddPayment] = useState(false);
  const queryClient = useQueryClient();
  const admin = isAdmin(currentUser);

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['payments', deal.id],
    queryFn: () => base44.entities.Payment.filter({ deal_id: deal.id }, '-date'),
  });

  const deletePayment = useMutation({
    mutationFn: async (payment) => {
      await base44.entities.Payment.delete(payment.id);
      const allPayments = await base44.entities.Payment.filter({ deal_id: deal.id });
      const newCollected = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
      await base44.entities.Deal.update(deal.id, { collected_actual: newCollected });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', deal.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast.success('ההכנסה נמחקה');
    },
    onError: () => toast.error('שגיאה במחיקת ההכנסה'),
  });

  const st = DEAL_STATUS_MAP[deal.status] || DEAL_STATUS_MAP['פתוחה'];
  const totalPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalCommission = payments.reduce((s, p) => s + (p.commission_amount || 0), 0);

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-lg">{deal.client_name} — {deal.address || 'ללא כתובת'}</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge>
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onEdit}>
                  <Pencil className="w-3 h-3" /> עריכה
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Deal Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/40 rounded-xl p-4 space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground mb-2">פרטי עסקה</p>
              <InfoRow label="לקוח" value={deal.client_name} />
              <InfoRow label="כתובת" value={deal.address} />
              <InfoRow label="אזור" value={deal.area} />
              <InfoRow label="צד" value={deal.side} />
              <InfoRow label="חודש" value={deal.month} />
              <InfoRow label="מקור ליד" value={deal.lead_source} />
              <InfoRow label="מקור עסקה" value={deal.origin} />
            </div>
            <div className="bg-muted/40 rounded-xl p-4 space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground mb-2">נתונים פיננסיים</p>
              <InfoRow label="סכום עסקה" value={formatCurrency(deal.deal_amount)} />
              <InfoRow label="סכום עמלה" value={formatCurrency(deal.commission_amount)} />
              <InfoRow label="נגבה בפועל" value={formatCurrency(totalPayments)} />
              <InfoRow label="עמלת סוכן" value={formatCurrency(deal.agent_commission)} />
              <InfoRow label="עמלת משרד" value={formatCurrency(deal.office_commission)} />
              <InfoRow label="שולם לסוכן" value={formatCurrency(deal.paid_to_agent)} />
              <InfoRow label="אמצעי תשלום" value={deal.payment_method} />
            </div>
          </div>

          {(admin) && (
            <div className="bg-muted/40 rounded-xl p-4 space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground mb-2">פרטים נוספים</p>
              <div className="grid grid-cols-2 gap-x-6">
                <InfoRow label="סוכן" value={deal.agent_name} />
                <InfoRow label="עו״ד" value={deal.lawyer_name} />
                <InfoRow label="סוכן שיתוף" value={deal.cooperation_agent} />
                <InfoRow label="נוהל אחרי עסקה" value={deal.post_deal_procedure} />
              </div>
              {deal.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">{deal.notes}</p>}
            </div>
          )}

          {/* Payments Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">הכנסות מהעסקה</h3>
                {payments.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    סה״כ התקבל: {formatCurrency(totalPayments)} • עמלת חברה: {formatCurrency(totalCommission)}
                  </p>
                )}
              </div>
              <Button size="sm" className="gap-1 rounded-lg text-xs" onClick={() => setShowAddPayment(true)}>
                <Plus className="w-3 h-3" /> הוסף הכנסה
              </Button>
            </div>

            {loadingPayments ? (
              <div className="text-center py-6 text-muted-foreground text-sm">טוען...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                אין הכנסות רשומות עדיין
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right text-xs">תאריך</TableHead>
                      <TableHead className="text-right text-xs">סכום שהתקבל</TableHead>
                      <TableHead className="text-right text-xs">אמצעי תשלום</TableHead>
                      <TableHead className="text-right text-xs">הערות</TableHead>
                      {admin && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{p.date ? format(new Date(p.date), 'dd/MM/yy') : '-'}</TableCell>
                        <TableCell className="text-xs font-semibold text-emerald-700">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.payment_method || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.notes || '-'}</TableCell>
                        {admin && (
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => { if (window.confirm('למחוק הכנסה זו?')) deletePayment.mutate(p); }}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showAddPayment && (
        <AddPaymentDialog
          deal={deal}
          agents={agents}
          onClose={() => setShowAddPayment(false)}
        />
      )}
    </>
  );
}